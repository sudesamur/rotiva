"use strict";

const { metersBetween, validCoordinates } = require("./geo-utils");
const { estimatedCostRange, scorePlace } = require("./place-suitability-score");
const { expandSelectedActivities } = require("./activity-candidate-adapter");

const WALKING_SPEED_METERS_PER_HOUR = 4800;
const MINUTES_PER_HOUR = 60;
const METERS_PER_KILOMETER = 1000;
const TARGET_TIME_UTILISATION = 0.75;
const UNKNOWN_COST_BUDGET_FIT = 50;
const MAX_SCORE = 100;

const ROUTE_SELECTION_WEIGHTS = Object.freeze({
  suitability: 42,
  distanceEfficiency: 28,
  timeFit: 14,
  budgetFit: 9,
  diversity: 7,
});

const LEGACY_ROUTE_SELECTION_WEIGHTS = Object.freeze({
  suitability: 45,
  distanceEfficiency: 30,
  timeFit: 15,
  budgetFit: 10,
});

const ROUTE_SCORE_WEIGHTS = Object.freeze({
  placeQuality: 42,
  distanceEfficiency: 28,
  budgetFit: 14,
  timeUtilisation: 9,
  categoryDiversity: 7,
});

const LEGACY_ROUTE_SCORE_WEIGHTS = Object.freeze({
  placeQuality: 45,
  distanceEfficiency: 30,
  budgetFit: 15,
  timeUtilisation: 10,
});

const CATEGORY_DIVERSITY_CONFIG = Object.freeze({
  repeatCategoryPenalty: 20,
  consecutiveCategoryPenalty: 15,
  preferredCategoryPenaltyMultiplier: 0.35,
  unknownCategoryScore: 50,
});

const CATEGORY_FAMILY_RULES = Object.freeze([
  { family: "cafe", matches: ["cafe", "coffee"] },
  { family: "restaurant", matches: ["restaurant", "meyhane"] },
  { family: "museum", matches: ["museum", "müze"] },
  { family: "historical", matches: ["historic", "historical", "tarihi"] },
  { family: "park", matches: ["park", "garden"] },
  { family: "cultural", matches: ["cultural", "culture", "cultural"] },
  { family: "viewpoint", matches: ["view", "manzara"] },
  { family: "market", matches: ["market", "çarşı", "pazar"] },
]);

const CATEGORY_INTEREST_TERMS = Object.freeze({
  cafe: ["cafe", "kafe", "coffee", "kahve", "kahvaltı"],
  restaurant: ["restaurant", "food", "yemek", "öğle-yemeği", "akşam-yemeği", "meyhane"],
  museum: ["museum", "müze"],
  historical: ["history", "historical", "tarih", "tarihi"],
  park: ["park", "bahçe", "garden"],
  cultural: ["culture", "cultural", "kültür"],
  viewpoint: ["view", "viewpoint", "manzara"],
  market: ["market", "pazar", "çarşı"],
});

const WALKING_DISTANCE_TARGETS_METERS = Object.freeze({
  low: { preferred: 500, maximum: 3000 },
  normal: { preferred: 1200, maximum: 6000 },
  high: { preferred: 2500, maximum: 10000 },
});

function coordinateRouteEligible(place) {
  return Boolean(
    validCoordinates(place.coordinates) &&
      place.geocodeStatus === "verified" &&
      place.autoRouteEligible === true,
  );
}

function normalise(value) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/_/g, "-");
}

function categoryFamily(place) {
  const terms = [place.category, ...(place.tags || []), ...(place.activities || [])]
    .map(normalise)
    .join(" ");
  const rule = CATEGORY_FAMILY_RULES.find(({ matches }) => matches.some((term) => terms.includes(term)));
  return rule ? rule.family : "unknown";
}

function categoryMatchesInterest(category, interests) {
  const interestTerms = new Set((interests || []).map(normalise));
  return (CATEGORY_INTEREST_TERMS[category] || []).some((term) => interestTerms.has(term));
}

function categoryDiversity(candidate, state, context) {
  const category = candidate.category;
  if (category === "unknown") {
    return { score: CATEGORY_DIVERSITY_CONFIG.unknownCategoryScore, category, isNewCategory: false, interestAligned: false, consecutiveCount: 0 };
  }
  const previousCount = state.categoryCounts[category] || 0;
  const consecutiveCount = state.lastCategory === category ? state.consecutiveCategoryCount : 0;
  const interestAligned = categoryMatchesInterest(category, context.interests);
  const penaltyMultiplier = interestAligned ? CATEGORY_DIVERSITY_CONFIG.preferredCategoryPenaltyMultiplier : 1;
  const penalty = (previousCount * CATEGORY_DIVERSITY_CONFIG.repeatCategoryPenalty + consecutiveCount * CATEGORY_DIVERSITY_CONFIG.consecutiveCategoryPenalty) * penaltyMultiplier;
  return {
    score: Math.round(Math.max(0, MAX_SCORE - penalty)),
    category,
    isNewCategory: previousCount === 0,
    interestAligned,
    consecutiveCount,
  };
}

function visitDuration(place, context) {
  const override = context.visitMinutesByPlace?.[place.id];
  return Number.isFinite(override) ? override : place.durationMinutes;
}

function openingStatus(place, context) {
  return context.openingStatusByPlace?.[place.id] || "unknown";
}

// true means safely schedulable, false means definitely not schedulable, and
// null keeps an unknown opening state distinct from an affirmative answer.
function scheduleEligibility(place, context) {
  const durationMinutes = visitDuration(place, context);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return false;
  const status = openingStatus(place, context);
  if (status === "closed") return false;
  if (status === "open") return true;
  return null;
}

function walkingMinutes(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return null;
  return Math.ceil((distanceMeters / WALKING_SPEED_METERS_PER_HOUR) * MINUTES_PER_HOUR);
}

function distanceEfficiency(distanceMeters, walkingPreference) {
  if (!Number.isFinite(distanceMeters)) return 0;
  const target = WALKING_DISTANCE_TARGETS_METERS[walkingPreference] || WALKING_DISTANCE_TARGETS_METERS.normal;
  if (distanceMeters <= target.preferred) return 100;
  if (distanceMeters >= target.maximum) return 0;
  return Math.round(100 * (1 - (distanceMeters - target.preferred) / (target.maximum - target.preferred)));
}

function costClassification(range) {
  if (!range) return { type: "unknownCost", minimum: 0, range: null };
  if (range.min === range.max) return { type: "knownCost", minimum: range.min, range };
  return { type: "uncertainCost", minimum: range.min, range };
}

function weightedScore(breakdown, weights) {
  const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0);
  const score = Object.entries(weights).reduce(
    (total, [key, weight]) => total + breakdown[key] * weight,
    0,
  );
  return Math.round(score / totalWeight);
}

function diversityEnabled(context) {
  return context.enableCategoryDiversity !== false;
}

function selectionWeights(context) {
  if (context.routeSelectionWeights) return context.routeSelectionWeights;
  return diversityEnabled(context) ? ROUTE_SELECTION_WEIGHTS : LEGACY_ROUTE_SELECTION_WEIGHTS;
}

function routeScoreWeights(context) {
  if (context.routeScoreWeights) return context.routeScoreWeights;
  return diversityEnabled(context) ? ROUTE_SCORE_WEIGHTS : LEGACY_ROUTE_SCORE_WEIGHTS;
}

function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  if (!match) throw new Error("startTime must use HH:MM format");
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % (24 * MINUTES_PER_HOUR)) + 24 * MINUTES_PER_HOUR) % (24 * MINUTES_PER_HOUR);
  return `${String(Math.floor(normalized / MINUTES_PER_HOUR)).padStart(2, "0")}:${String(normalized % MINUTES_PER_HOUR).padStart(2, "0")}`;
}

function candidateScore(candidate, state, context) {
  const parentPlaceId = candidate.place.placeId || candidate.place.id;
  if (state.selectedPlaceIds.has(parentPlaceId) && !candidate.place.allowSamePlaceMultiple) {
    return { excluded: "duplicate_place_already_selected", breakdown: {} };
  }
  const distanceMeters = Math.round(metersBetween(state.currentCoordinates, candidate.place.coordinates));
  const travelMinutes = walkingMinutes(distanceMeters);
  const totalMinutes = travelMinutes + candidate.visitMinutes;
  const remainingAfter = state.remainingMinutes - totalMinutes;
  const cost = candidate.cost;
  const diversity = categoryDiversity(candidate, state, context);

  if (totalMinutes > state.remainingMinutes) {
    return {
      excluded: "duration_exceeds_remaining_time",
      distanceMeters,
      travelMinutes,
      diversity,
      breakdown: { distanceEfficiency: distanceEfficiency(distanceMeters, context.walkingPreference) },
    };
  }
  if (cost.range && Number.isFinite(state.remainingBudgetTRY) && cost.minimum > state.remainingBudgetTRY) {
    return {
      excluded: "minimum_cost_exceeds_remaining_budget",
      distanceMeters,
      travelMinutes,
      diversity,
      breakdown: { distanceEfficiency: distanceEfficiency(distanceMeters, context.walkingPreference) },
    };
  }

  const budgetFit = !Number.isFinite(state.remainingBudgetTRY)
    ? UNKNOWN_COST_BUDGET_FIT
    : !cost.range
      ? UNKNOWN_COST_BUDGET_FIT
      : Math.round(Math.max(0, Math.min(1, 1 - cost.minimum / Math.max(state.remainingBudgetTRY, 1))) * 100);
  const breakdown = {
    suitability: candidate.suitabilityScore,
    distanceEfficiency: distanceEfficiency(distanceMeters, context.walkingPreference),
    timeFit: Math.round((remainingAfter / state.remainingMinutes) * 100),
    budgetFit,
    diversity: diversity.score,
  };
  return {
    score: weightedScore(
      breakdown,
      selectionWeights(context),
    ),
    breakdown,
    distanceMeters,
    travelMinutes,
    diversity,
  };
}

function selectionReasons(candidate, evaluation, includeDiversity) {
  const reasons = [];
  if (evaluation.breakdown.suitability >= 75) reasons.push("high_suitability_score");
  if (evaluation.breakdown.distanceEfficiency >= 75) reasons.push("close_to_previous_stop");
  if (evaluation.breakdown.timeFit >= 25) reasons.push("fits_remaining_time");
  if (evaluation.breakdown.budgetFit >= 75) reasons.push("fits_remaining_budget");
  if (includeDiversity && evaluation.diversity.isNewCategory) reasons.push("adds_category_diversity");
  if (evaluation.diversity.interestAligned) reasons.push("matches_preferred_category");
  return reasons.length > 0 ? reasons : ["best_available_route_candidate"];
}

function notSelectedReasons(candidate, evaluation) {
  const reasons = [evaluation.excluded];
  if (evaluation.breakdown?.distanceEfficiency === 0) reasons.push("too_far_from_current_route");
  if (evaluation.diversity?.score < MAX_SCORE) reasons.push("category_repetition_penalty");
  return reasons;
}

function sourceCandidate(source, context) {
  const place = source.place || source;
  const durationMinutes = visitDuration(place, context);
  const status = openingStatus(place, context);
  const coordinatesEligible = coordinateRouteEligible(place);
  const schedulable = scheduleEligibility(place, context);
  if (!coordinatesEligible) return { place, excluded: "unverified_coordinates" };
  if (status === "closed") return { place, excluded: "closed_at_planned_time" };
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return { place, excluded: "missing_visit_duration" };

  const scoredPlace = Number.isFinite(source.suitabilityScore)
    ? null
    : scorePlace({ ...place, durationMinutes }, {
      ...context,
      availableMinutes: context.totalMinutes,
      budgetTRY: context.budgetTRY,
      openingStatus: status,
    });
  const suitability = Number.isFinite(source.suitabilityScore)
    ? source.suitabilityScore
    : scoredPlace.suitabilityScore;
  if (!Number.isFinite(suitability)) return { place, excluded: "missing_suitability_score" };
  return {
    place,
    suitabilityScore: suitability,
    visitMinutes: durationMinutes,
    openingStatus: status,
    coordinateRouteEligible: coordinatesEligible,
    scheduleEligible: schedulable,
    itineraryAutoEligible: coordinatesEligible && schedulable === true,
    interestMatch: scoredPlace?.interestMatch || null,
    interestMatches: scoredPlace?.interestMatches || [],
    unknownFactors: scoredPlace?.unknownFactors || place.unknownFactors || [],
    category: categoryFamily(place),
    cost: costClassification(estimatedCostRange(place)),
  };
}

function buildItinerary(places, context) {
  if (!validCoordinates(context.startCoordinates)) throw new Error("startCoordinates must contain verified latitude and longitude");
  if (!Number.isFinite(context.totalMinutes) || context.totalMinutes <= 0) throw new Error("totalMinutes must be a positive number");

  const startMinute = timeToMinutes(context.startTime || "10:00");
  const warnings = [];
  const scopedPlaces = context.region
    ? places.filter((source) => (source.place || source).region === context.region)
    : places;
  const scopedRawPlaces = scopedPlaces.map((source) => source.place || source);
  const activityCandidates = expandSelectedActivities(scopedRawPlaces, context.selectedActivities);
  const selectedActivityPlaceIds = new Set(activityCandidates.map((candidate) => candidate.placeId));
  const routeSources = [
    ...scopedPlaces.filter((source) => !selectedActivityPlaceIds.has((source.place || source).id)),
    ...activityCandidates,
  ];
  const candidates = routeSources.map((source) => sourceCandidate(source, context));
  const excluded = candidates.filter((candidate) => candidate.excluded);
  const remaining = candidates.filter((candidate) => !candidate.excluded);
  const notSelected = excluded.map((candidate) => ({
    placeId: candidate.place.placeId || candidate.place.id,
    candidateId: candidate.place.id,
    name: candidate.place.name,
    candidateType: candidate.place.candidateType || "place",
    activityId: candidate.place.activityId || null,
    activityName: candidate.place.activityName || null,
    suitabilityScore: candidate.suitabilityScore ?? null,
    notSelectedReasons: [candidate.excluded],
  }));
  excluded.forEach((candidate) => warnings.push(`${candidate.place.name || candidate.place.id}: ${candidate.excluded}`));

  const initialBudget = Number.isFinite(context.budgetTRY) ? context.budgetTRY : null;
  const state = {
    currentCoordinates: context.startCoordinates,
    remainingMinutes: context.totalMinutes,
    remainingBudgetTRY: initialBudget,
    elapsedMinutes: 0,
    knownCostTRY: 0,
    uncertainCostMinTRY: 0,
    uncertainCostMaxTRY: 0,
    unknownCostPlaceIds: [],
    totalDistanceMeters: 0,
    totalTravelMinutes: 0,
    totalVisitMinutes: 0,
    distanceEfficiencyScores: [],
    categoryCounts: {},
    selectedPlaceIds: new Set(),
    lastCategory: null,
    consecutiveCategoryCount: 0,
  };
  const stops = [];

  while (remaining.length > 0) {
    const evaluations = remaining.map((candidate) => ({ candidate, evaluation: candidateScore(candidate, state, context) }));
    evaluations
      .filter(({ evaluation }) => evaluation.excluded)
      .forEach(({ candidate, evaluation }) => {
        warnings.push(`${candidate.place.name || candidate.place.id}: ${evaluation.excluded}`);
        notSelected.push({
          placeId: candidate.place.placeId || candidate.place.id,
          candidateId: candidate.place.id,
          name: candidate.place.name,
          candidateType: candidate.place.candidateType || "place",
          activityId: candidate.place.activityId || null,
          activityName: candidate.place.activityName || null,
          suitabilityScore: candidate.suitabilityScore,
          notSelectedReasons: notSelectedReasons(candidate, evaluation),
        });
        remaining.splice(remaining.indexOf(candidate), 1);
      });
    const evaluated = evaluations
      .filter(({ evaluation }) => !evaluation.excluded)
      .sort((first, second) => {
        const scoreDifference = second.evaluation.score - first.evaluation.score;
        if (scoreDifference !== 0) return scoreDifference;
        const suitabilityDifference = second.candidate.suitabilityScore - first.candidate.suitabilityScore;
        if (suitabilityDifference !== 0) return suitabilityDifference;
        return String(first.candidate.place.id).localeCompare(String(second.candidate.place.id), "tr");
      });

    if (evaluated.length === 0) break;
    const { candidate, evaluation } = evaluated[0];
    const index = remaining.indexOf(candidate);
    remaining.splice(index, 1);

    const arrivalMinute = startMinute + state.elapsedMinutes + evaluation.travelMinutes;
    const departureMinute = arrivalMinute + candidate.visitMinutes;
    stops.push({
      order: stops.length + 1,
      placeId: candidate.place.placeId || candidate.place.id,
      candidateId: candidate.place.id,
      name: candidate.place.name,
      placeName: candidate.place.name,
      candidateType: candidate.place.candidateType || "place",
      activityId: candidate.place.activityId || null,
      activityName: candidate.place.activityName || null,
      arrivalTime: minutesToTime(arrivalMinute),
      departureTime: minutesToTime(departureMinute),
      visitMinutes: candidate.visitMinutes,
      distanceFromPreviousKm: Number((evaluation.distanceMeters / METERS_PER_KILOMETER).toFixed(2)),
      travelMinutesFromPrevious: evaluation.travelMinutes,
      suitabilityScore: candidate.suitabilityScore,
      routeCandidateScore: evaluation.score,
      category: candidate.category,
      costType: candidate.cost.type,
      cost: candidate.cost.range,
      scheduleEligible: candidate.scheduleEligible,
      itineraryAutoEligible: candidate.itineraryAutoEligible,
      interestMatch: candidate.interestMatch,
      interestMatches: candidate.interestMatches,
      unknownFactors: candidate.unknownFactors,
      selectionReasons: selectionReasons(candidate, evaluation, diversityEnabled(context)),
      selectionBreakdown: {
        suitability: evaluation.breakdown.suitability,
        proximity: evaluation.breakdown.distanceEfficiency,
        timeFit: evaluation.breakdown.timeFit,
        budgetFit: evaluation.breakdown.budgetFit,
        diversity: evaluation.breakdown.diversity,
      },
    });

    state.currentCoordinates = candidate.place.coordinates;
    state.elapsedMinutes += evaluation.travelMinutes + candidate.visitMinutes;
    state.remainingMinutes -= evaluation.travelMinutes + candidate.visitMinutes;
    state.totalDistanceMeters += evaluation.distanceMeters;
    state.totalTravelMinutes += evaluation.travelMinutes;
    state.totalVisitMinutes += candidate.visitMinutes;
    state.distanceEfficiencyScores.push(evaluation.breakdown.distanceEfficiency);
    state.categoryCounts[candidate.category] = (state.categoryCounts[candidate.category] || 0) + 1;
    state.selectedPlaceIds.add(candidate.place.placeId || candidate.place.id);
    state.consecutiveCategoryCount = state.lastCategory === candidate.category ? state.consecutiveCategoryCount + 1 : 1;
    state.lastCategory = candidate.category;
    if (candidate.cost.type === "knownCost") state.knownCostTRY += candidate.cost.minimum;
    if (candidate.cost.type === "uncertainCost") {
      state.uncertainCostMinTRY += candidate.cost.range.min;
      state.uncertainCostMaxTRY += candidate.cost.range.max;
    }
    if (candidate.cost.type === "unknownCost") state.unknownCostPlaceIds.push(candidate.place.id);
    if (Number.isFinite(state.remainingBudgetTRY) && candidate.cost.range) state.remainingBudgetTRY -= candidate.cost.minimum;
    if (candidate.openingStatus === "unknown") warnings.push(`${candidate.place.name}: açık saat durumu kesin değil`);
  }

  remaining.forEach((candidate) => {
    warnings.push(`${candidate.place.name || candidate.place.id}: kalan süre, bütçe veya mesafe nedeniyle eklenmedi`);
    notSelected.push({
      placeId: candidate.place.placeId || candidate.place.id,
      candidateId: candidate.place.id,
      name: candidate.place.name,
      candidateType: candidate.place.candidateType || "place",
      activityId: candidate.place.activityId || null,
      activityName: candidate.place.activityName || null,
      suitabilityScore: candidate.suitabilityScore,
      notSelectedReasons: ["not_selected_by_route_heuristic"],
    });
  });
  if (state.unknownCostPlaceIds.length > 0) warnings.push("Bilinmeyen maliyetli mekanlar toplam maliyete dahil edilmedi; ücretsiz kabul edilmedi.");

  const remainingBudgetFit = !Number.isFinite(initialBudget)
    ? UNKNOWN_COST_BUDGET_FIT
    : Math.round(Math.max(0, state.remainingBudgetTRY / Math.max(initialBudget, 1)) * 100);
  const categoryDiversityScore = stops.length === 0
    ? 0
    : Math.round((Object.keys(state.categoryCounts).length / stops.length) * MAX_SCORE);
  const routeBreakdown = {
    placeQuality: stops.length === 0 ? 0 : Math.round(stops.reduce((total, stop) => total + stop.suitabilityScore, 0) / stops.length),
    distanceEfficiency: state.distanceEfficiencyScores.length === 0 ? 0 : Math.round(state.distanceEfficiencyScores.reduce((total, score) => total + score, 0) / state.distanceEfficiencyScores.length),
    budgetFit: state.unknownCostPlaceIds.length > 0
      ? Math.min(remainingBudgetFit, UNKNOWN_COST_BUDGET_FIT)
      : remainingBudgetFit,
    timeUtilisation: Math.round(Math.min(1, state.elapsedMinutes / (context.totalMinutes * TARGET_TIME_UTILISATION)) * 100),
    categoryDiversity: categoryDiversityScore,
  };

  return {
    startTime: minutesToTime(startMinute),
    endTime: minutesToTime(startMinute + state.elapsedMinutes),
    stops,
    summary: {
      totalVisitMinutes: state.totalVisitMinutes,
      totalTravelMinutes: state.totalTravelMinutes,
      totalDistanceKm: Number((state.totalDistanceMeters / METERS_PER_KILOMETER).toFixed(2)),
      knownCostTRY: state.knownCostTRY,
      uncertainCostTRY: state.uncertainCostMaxTRY === 0 ? null : { min: state.uncertainCostMinTRY, max: state.uncertainCostMaxTRY },
      unknownCostPlaceIds: state.unknownCostPlaceIds,
      budgetReservedMinimumTRY: state.knownCostTRY + state.uncertainCostMinTRY,
      remainingBudgetTRY: state.remainingBudgetTRY,
      remainingMinutes: state.remainingMinutes,
      categorySummary: state.categoryCounts,
      categoryDiversityScore,
    },
    routeScore: stops.length === 0
      ? 0
      : weightedScore(
        routeBreakdown,
        routeScoreWeights(context),
      ),
    routeScoreBreakdown: routeBreakdown,
    warnings,
    debug: {
      candidateCount: routeSources.length,
      excludedByRegionCount: places.length - scopedPlaces.length,
      activityCandidateCount: activityCandidates.length,
      hardFilterEligibleCount: candidates.length - excluded.length,
      notSelected,
    },
  };
}

module.exports = {
  METERS_PER_KILOMETER,
  ROUTE_SCORE_WEIGHTS,
  ROUTE_SELECTION_WEIGHTS,
  CATEGORY_DIVERSITY_CONFIG,
  WALKING_SPEED_METERS_PER_HOUR,
  buildItinerary,
  coordinateRouteEligible,
  scheduleEligibility,
  walkingMinutes,
};
