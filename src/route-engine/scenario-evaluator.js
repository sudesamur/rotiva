"use strict";

const { evaluateInterestMatch } = require("./interest-mapping");
const { buildItinerary, coordinateRouteEligible, scheduleEligibility } = require("./route-optimizer");

const WEIGHT_TOTAL = 100;
const HIGH_SCORE_THRESHOLD = 75;
const EVALUATION_TARGET_TIME_USAGE = 0.75;

const EVALUATION_SCORE_WEIGHTS = Object.freeze({
  interestMatch: 35,
  routeEfficiency: 25,
  budgetCompliance: 15,
  timeUsage: 15,
  diversity: 10,
});

const WEIGHT_SETS = Object.freeze({
  baseline: Object.freeze({ suitability: 42, distanceEfficiency: 28, timeFit: 14, budgetFit: 9, diversity: 7 }),
  userPreferenceHeavy: Object.freeze({ suitability: 50, distanceEfficiency: 20, timeFit: 13, budgetFit: 10, diversity: 7 }),
  routeEfficiencyHeavy: Object.freeze({ suitability: 35, distanceEfficiency: 35, timeFit: 15, budgetFit: 8, diversity: 7 }),
  balanced: Object.freeze({ suitability: 40, distanceEfficiency: 25, timeFit: 15, budgetFit: 10, diversity: 10 }),
  budgetAware: Object.freeze({ suitability: 38, distanceEfficiency: 24, timeFit: 13, budgetFit: 18, diversity: 7 }),
});

function sumWeights(weights) {
  return Object.values(weights).reduce((total, weight) => total + weight, 0);
}

function routeScoreWeights(selectionWeights) {
  return {
    placeQuality: selectionWeights.suitability,
    distanceEfficiency: selectionWeights.distanceEfficiency,
    timeUtilisation: selectionWeights.timeFit,
    budgetFit: selectionWeights.budgetFit,
    categoryDiversity: selectionWeights.diversity,
  };
}

function allOpenStatus(places) {
  return Object.fromEntries(places.map((place) => [place.id, "open"]));
}

function standardDurations(places) {
  return Object.fromEntries(places.map((place) => [place.id, 45]));
}

function createProfiles(places) {
  const startCoordinates = { lat: 41.03, lng: 28.95 };
  const shared = {
    startCoordinates,
    currentCoordinates: startCoordinates,
    startTime: "10:00",
    visitMinutesByPlace: standardDurations(places),
    // Scenario fixtures explicitly mark availability; live opening status is not inferred from text.
    openingStatusByPlace: allOpenStatus(places),
  };
  return [
    { id: "history-explorer", name: "History Explorer", context: { ...shared, totalMinutes: 360, budgetTRY: 1300, walkingPreference: "normal", interests: ["history", "historical", "museum", "historic", "tarihi-yapı"] } },
    { id: "coffee-food", name: "Coffee & Food", context: { ...shared, totalMinutes: 300, budgetTRY: 1800, walkingPreference: "normal", interests: ["coffee", "cafe", "restaurant", "food", "kahve", "yemek", "öğle-yemeği"] } },
    { id: "budget-traveler", name: "Budget Traveler", context: { ...shared, totalMinutes: 360, budgetTRY: 600, walkingPreference: "normal", interests: ["bütçe-dostu", "kahve", "öğle-yemeği"] } },
    { id: "low-walking", name: "Low Walking", context: { ...shared, totalMinutes: 300, budgetTRY: 1300, walkingPreference: "low", interests: ["kahve", "fotoğraf"] } },
    { id: "short-trip", name: "Short Trip", context: { ...shared, totalMinutes: 150, budgetTRY: 1200, walkingPreference: "normal", interests: ["kahve", "fotoğraf", "öğle-yemeği"] } },
    { id: "full-day", name: "Full Day", context: { ...shared, totalMinutes: 480, budgetTRY: 2200, walkingPreference: "normal", interests: [] } },
    { id: "balanced", name: "Balanced", context: { ...shared, totalMinutes: 360, budgetTRY: 1300, walkingPreference: "normal", interests: [] } },
  ];
}

const REGION_START_COORDINATES = Object.freeze({
  "sultanahmet-eminonu": Object.freeze({ lat: 41.0056, lng: 28.9769 }),
});

function createRegionHistoryExplorerProfile(region) {
  const startCoordinates = REGION_START_COORDINATES[region];
  if (!startCoordinates) throw new Error(`No regional start coordinates configured for ${region}`);
  return {
    id: `${region}-history-explorer`,
    name: "Sultanahmet–Eminönü History Explorer",
    context: {
      region,
      startCoordinates,
      currentCoordinates: startCoordinates,
      startTime: "10:00",
      totalMinutes: 360,
      budgetTRY: 1300,
      walkingPreference: "normal",
      interests: ["history", "museum", "culture"],
      // Unlike synthetic scenario fixtures, this profile deliberately keeps
      // duration and opening-status uncertainty from the normalized records.
    },
  };
}

function auditRegionalHardFilters(route, scopedPlaces, context) {
  const selectedById = new Map(route.stops.map((stop) => [stop.placeId, stop]));
  const excludedById = new Map(route.debug.notSelected.map((entry) => [entry.placeId, entry]));
  return scopedPlaces.map((place) => {
    const selected = selectedById.get(place.id);
    const coordinateEligible = coordinateRouteEligible(place);
    const selectedActivity = selected?.candidateType === "activity";
    const durationKnown = selectedActivity
      ? Number.isFinite(selected.visitMinutes) && selected.visitMinutes > 0
      : Number.isFinite(place.durationMinutes) && place.durationMinutes > 0;
    const scheduleEligible = selectedActivity ? selected.scheduleEligible : scheduleEligibility(place, context);
    const excluded = excludedById.get(place.id);
    return {
      placeId: place.id,
      coordinateRouteEligible: coordinateEligible,
      scheduleEligible,
      durationKnown,
      autoRouteEligible: place.autoRouteEligible === true,
      selected: Boolean(selected),
      decision: selected ? "selected" : (excluded?.notSelectedReasons?.[0] || "passed_initial_filters_not_selected"),
      openingHoursStatus: place.openingHoursStatus,
      costConfidence: place.costConfidence,
    };
  });
}

function interestMatchRate(stops, placesById, interests) {
    if (!Array.isArray(interests) || interests.length === 0 || stops.length === 0) return null;
  const matched = stops.filter((stop) => {
    return evaluateInterestMatch(placesById.get(stop.placeId), interests).score > 0;
  });
  return Math.round((matched.length / stops.length) * WEIGHT_TOTAL);
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(3));
}

function evaluationScore(metrics) {
  const breakdown = {
    interestMatch: metrics.interestMatchRate ?? 50,
    routeEfficiency: Math.round((1 - (metrics.travelTimeRatio ?? 0)) * WEIGHT_TOTAL),
    budgetCompliance: metrics.unknownCostCount > 0 ? 50 : (metrics.remainingBudgetTRY === null || metrics.remainingBudgetTRY >= 0 ? 100 : 0),
    timeUsage: Math.round(Math.min(1, (metrics.timeUsageRatio ?? 0) / EVALUATION_TARGET_TIME_USAGE) * WEIGHT_TOTAL),
    diversity: metrics.categoryDiversityScore,
  };
  return {
    score: Math.round(Object.entries(EVALUATION_SCORE_WEIGHTS).reduce(
      (total, [factor, weight]) => total + breakdown[factor] * weight,
      0,
    ) / WEIGHT_TOTAL),
    breakdown,
  };
}

function summarizeRoute(route, profile, placesById, weightSet) {
  const summary = route.summary;
  const metrics = {
    candidatePlaceCount: route.debug.candidateCount,
    hardFilterPassedCount: route.debug.hardFilterEligibleCount,
    selectedStopCount: route.stops.length,
    selectedPlaces: route.stops.map((stop) => stop.placeId),
    selectedActivities: route.stops
      .filter((stop) => stop.candidateType === "activity")
      .map((stop) => ({ placeId: stop.placeId, activityId: stop.activityId, activityName: stop.activityName })),
    selectedCategories: route.stops.map((stop) => stop.category),
    averageSuitabilityScore: route.stops.length === 0 ? null : Math.round(route.stops.reduce((total, stop) => total + stop.suitabilityScore, 0) / route.stops.length),
    routeScore: route.routeScore,
    categoryDiversityScore: summary.categoryDiversityScore,
    totalDistanceKm: summary.totalDistanceKm,
    totalTravelMinutes: summary.totalTravelMinutes,
    totalVisitMinutes: summary.totalVisitMinutes,
    knownCostTRY: summary.knownCostTRY,
    uncertainCostRange: summary.uncertainCostTRY,
    unknownCostCount: summary.unknownCostPlaceIds.length,
    remainingBudgetTRY: summary.remainingBudgetTRY,
    remainingMinutes: summary.remainingMinutes,
    interestMatchRate: interestMatchRate(route.stops, placesById, profile.context.interests),
    categoryDistribution: summary.categorySummary,
    distancePerStopKm: route.stops.length === 0 ? null : Number((summary.totalDistanceKm / route.stops.length).toFixed(3)),
    travelTimeRatio: ratio(summary.totalTravelMinutes, profile.context.totalMinutes),
    visitTimeRatio: ratio(summary.totalVisitMinutes, profile.context.totalMinutes),
    budgetUsageRatio: ratio(summary.budgetReservedMinimumTRY, profile.context.budgetTRY),
    timeUsageRatio: ratio(profile.context.totalMinutes - summary.remainingMinutes, profile.context.totalMinutes),
    highScorePlacesNotSelected: route.debug.notSelected.filter((place) => place.suitabilityScore !== null && place.suitabilityScore >= HIGH_SCORE_THRESHOLD),
  };
  const evaluation = evaluationScore(metrics);
  return { weightSet, ...metrics, evaluationScore: evaluation.score, evaluationBreakdown: evaluation.breakdown };
}

function evaluateProfile(profile, places, weightSets = WEIGHT_SETS) {
  const placesById = new Map(places.map((place) => [place.id, place]));
  return {
    profile: profile.name,
    profileId: profile.id,
    results: Object.entries(weightSets).map(([weightSet, weights]) => {
      if (sumWeights(weights) !== WEIGHT_TOTAL) throw new Error(`${weightSet} weights must total ${WEIGHT_TOTAL}`);
      const route = buildItinerary(places, {
        ...profile.context,
        routeSelectionWeights: weights,
        routeScoreWeights: routeScoreWeights(weights),
      });
      return summarizeRoute(route, profile, placesById, weightSet);
    }),
  };
}

function evaluateScenarios(places, profiles = createProfiles(places), weightSets = WEIGHT_SETS) {
  const profileResults = profiles.map((profile) => evaluateProfile(profile, places, weightSets));
  const weightSetSummary = Object.keys(weightSets).map((weightSet) => {
    const results = profileResults.map((profile) => profile.results.find((result) => result.weightSet === weightSet));
    return {
      weightSet,
      averageEvaluationScore: Math.round(results.reduce((total, result) => total + result.evaluationScore, 0) / results.length),
      averageInterestMatchRate: Math.round(results.reduce((total, result) => total + (result.interestMatchRate ?? 50), 0) / results.length),
      averageDistanceKm: Number((results.reduce((total, result) => total + result.totalDistanceKm, 0) / results.length).toFixed(2)),
    };
  });
  return { profiles: profileResults, weightSetSummary };
}

function evaluateRegionHistoryExplorer(region, places, weights = WEIGHT_SETS.baseline, options = {}) {
  if (sumWeights(weights) !== WEIGHT_TOTAL) throw new Error("regional weights must total 100");
  const profile = createRegionHistoryExplorerProfile(region);
  const placesById = new Map(places.map((place) => [place.id, place]));
  const route = buildItinerary(places, {
    ...profile.context,
    selectedActivities: options.selectedActivities,
    routeSelectionWeights: weights,
    routeScoreWeights: routeScoreWeights(weights),
  });
  const scopedPlaces = places.filter((place) => place.region === region);
  return {
    profile,
    result: summarizeRoute(route, profile, placesById, "baseline"),
    route,
    hardFilterReport: auditRegionalHardFilters(route, scopedPlaces, profile.context),
  };
}

module.exports = {
  EVALUATION_SCORE_WEIGHTS,
  WEIGHT_SETS,
  createProfiles,
  createRegionHistoryExplorerProfile,
  evaluateRegionHistoryExplorer,
  evaluateProfile,
  evaluateScenarios,
  sumWeights,
};
