"use strict";

const { metersBetween, validCoordinates } = require("./geo-utils");
const { evaluateInterestMatch, normalise } = require("./interest-mapping");

/**
 * Explainable, rule-based scoring for places that have already passed the
 * route engine's data-verification policy. Unknown data is represented by
 * null and is never treated as zero, free, open, or nearby.
 */

const SCORE_WEIGHTS = Object.freeze({
  interest: 30,
  budget: 25,
  distance: 15,
  time: 15,
  openingHours: 10,
  weather: 3,
  meal: 2,
});

const WALKING_DISTANCE_LIMITS_METERS = Object.freeze({
  low: { preferred: 750, maximum: 4000 },
  normal: { preferred: 1500, maximum: 6000 },
  high: { preferred: 3000, maximum: 10000 },
});

const MEAL_TAGS = new Set([
  "kahvaltı",
  "öğle-yemeği",
  "akşam-yemeği",
  "yemek",
  "restoran",
  "sokak-lezzeti",
]);

const OUTDOOR_TAGS = new Set([
  "açık-hava",
  "sahil",
  "park",
  "yürüyüş",
  "piknik",
]);
const INDOOR_TAGS = new Set(["kapalı-mekân", "müze"]);

function collectPlaceTerms(place) {
  const categoryTerms = normalise(place.category).split("-").filter(Boolean);
  const activityTerms = (place.activities || []).flatMap((activity) => {
    if (typeof activity === "string") return [activity];
    return [activity.name, ...(activity.tags || [])];
  });
  return new Set(
    [...(place.tags || []), ...activityTerms, ...categoryTerms].map(
      normalise,
    ),
  );
}

function hasVerifiedCoordinates(place) {
  const coordinates = place.coordinates;
  return Boolean(
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    place.geocodeStatus === "verified" &&
    place.autoRouteEligible === true,
  );
}

function estimatedCostRange(place) {
  if (Number.isFinite(place.costTRY)) {
    return { min: place.costTRY, max: place.costTRY };
  }

  if (Number.isFinite(place.costMinTRY) && Number.isFinite(place.costMaxTRY)) {
    return { min: place.costMinTRY, max: place.costMaxTRY };
  }

  if (Array.isArray(place.costRangeTRY) && place.costRangeTRY.length === 2) {
    return { min: place.costRangeTRY[0], max: place.costRangeTRY[1] };
  }

  const ranges = Object.values(place.estimatedSpendTRY || {}).filter(
    (range) =>
      Array.isArray(range) &&
      range.length === 2 &&
      range.every(Number.isFinite),
  );
  if (ranges.length === 0) return null;

  return {
    min: Math.min(...ranges.map((range) => range[0])),
    max: Math.max(...ranges.map((range) => range[1])),
  };
}

function budgetScore(range, remainingBudgetTRY) {
  if (!Number.isFinite(remainingBudgetTRY) || !range) return null;
  if (range.max <= remainingBudgetTRY) return 100;
  if (range.min > remainingBudgetTRY) return 0;
  const affordableFraction =
    (remainingBudgetTRY - range.min) / (range.max - range.min);
  return Math.round(Math.max(0, Math.min(1, affordableFraction)) * 100);
}

function distanceScore(distanceMeters, walkingPreference) {
  if (!Number.isFinite(distanceMeters)) return null;
  const limits =
    WALKING_DISTANCE_LIMITS_METERS[walkingPreference] ||
    WALKING_DISTANCE_LIMITS_METERS.normal;
  if (distanceMeters <= limits.preferred) return 100;
  if (distanceMeters >= limits.maximum) return 0;
  return Math.round(
    100 *
      (1 -
        (distanceMeters - limits.preferred) /
          (limits.maximum - limits.preferred)),
  );
}

function timeScore(durationMinutes, availableMinutes) {
  if (!Number.isFinite(durationMinutes) || !Number.isFinite(availableMinutes))
    return null;
  if (durationMinutes > availableMinutes) return 0;
  return Math.round(
    50 + 50 * (1 - durationMinutes / Math.max(availableMinutes, 1)),
  );
}

function environmentScore(placeTerms, weather) {
  if (weather !== "rain") return null;
  const indoor = [...INDOOR_TAGS].some((tag) => placeTerms.has(tag));
  const outdoor = [...OUTDOOR_TAGS].some((tag) => placeTerms.has(tag));
  if (indoor && !outdoor) return 100;
  if (outdoor && !indoor) return 20;
  return null;
}

function mealScore(placeTerms, wantsMeal, mealWindowActive) {
  if (!wantsMeal || !mealWindowActive) return null;
  return [...MEAL_TAGS].some((tag) => placeTerms.has(tag)) ? 100 : 0;
}

function weightedScore(breakdown) {
  let numerator = 0;
  let denominator = 0;
  for (const [factor, weight] of Object.entries(SCORE_WEIGHTS)) {
    if (Number.isFinite(breakdown[factor])) {
      numerator += breakdown[factor] * weight;
      denominator += weight;
    }
  }
  return denominator === 0 ? null : Math.round(numerator / denominator);
}

function scoreCoverage(breakdown) {
  const totalWeight = Object.values(SCORE_WEIGHTS).reduce(
    (total, weight) => total + weight,
    0,
  );
  const knownWeight = Object.entries(SCORE_WEIGHTS).reduce(
    (total, [factor, weight]) =>
      total + (Number.isFinite(breakdown[factor]) ? weight : 0),
    0,
  );
  return Math.round((knownWeight / totalWeight) * 100);
}

function hardFilterReason(place, context, range, remainingBudgetTRY) {
  if (!hasVerifiedCoordinates(place)) return "unverified_coordinates";
  if (context.openingStatus === "closed") return "closed_at_planned_time";
  if (
    Number.isFinite(place.durationMinutes) &&
    Number.isFinite(context.availableMinutes) &&
    place.durationMinutes > context.availableMinutes
  ) {
    return "duration_exceeds_available_time";
  }
  if (
    range &&
    Number.isFinite(remainingBudgetTRY) &&
    range.min > remainingBudgetTRY
  ) {
    return "minimum_cost_exceeds_remaining_budget";
  }
  return null;
}

function scorePlace(place, context = {}) {
  const range = estimatedCostRange(place);
  const remainingBudgetTRY = Number.isFinite(context.remainingBudgetTRY)
    ? context.remainingBudgetTRY
    : context.budgetTRY;
  const hardFilter = hardFilterReason(
    place,
    context,
    range,
    remainingBudgetTRY,
  );
  const placeTerms = collectPlaceTerms(place);
  const interestMatch = evaluateInterestMatch(place, context.interests);
  const distanceMeters =
    validCoordinates(context.currentCoordinates) &&
    validCoordinates(place.coordinates)
      ? Math.round(metersBetween(context.currentCoordinates, place.coordinates))
      : null;

  const breakdown = {
    interest: interestMatch.score,
    budget: budgetScore(range, remainingBudgetTRY),
    distance: distanceScore(distanceMeters, context.walkingPreference),
    time: timeScore(place.durationMinutes, context.availableMinutes),
    openingHours: context.openingStatus === "open" ? 100 : null,
    weather: environmentScore(placeTerms, context.weather),
    meal: mealScore(placeTerms, context.wantsMeal, context.mealWindowActive),
  };

  const unknownFactors = Object.entries(breakdown)
    .filter(([, value]) => value === null)
    .map(([factor]) => factor);

  return {
    placeId: place.id,
    eligible: hardFilter === null,
    hardFilter,
    suitabilityScore: hardFilter ? null : weightedScore(breakdown),
    scoreCoverage: scoreCoverage(breakdown),
    interestMatch: interestMatch.primary,
    interestMatches: interestMatch.matches,
    scoreBreakdown: breakdown,
    distanceMeters,
    estimatedCostRangeTRY: range,
    unknownFactors,
    explanations: buildExplanations(
      place,
      hardFilter,
      breakdown,
      range,
      distanceMeters,
    ),
  };
}

function buildExplanations(
  place,
  hardFilter,
  breakdown,
  range,
  distanceMeters,
) {
  if (hardFilter) return [`${place.name || place.id}: ${hardFilter}`];
  const notes = [];
  if (breakdown.interest !== null)
    notes.push(`ilgi uyumu ${breakdown.interest}/100`);
  if (range) notes.push(`tahmini maliyet ${range.min}–${range.max} TRY`);
  else notes.push("maliyet bilinmiyor; ücretsiz kabul edilmedi");
  if (distanceMeters !== null)
    notes.push(`başlangıç noktasına uzaklık ${distanceMeters} m`);
  if (breakdown.openingHours === null)
    notes.push("açık saat durumu kesin değil");
  return notes;
}

function rankPlaces(places, context) {
  return places
    .map((place) => scorePlace(place, context))
    .sort((first, second) => {
      if (first.eligible !== second.eligible) return first.eligible ? -1 : 1;
      const scoreDifference =
        (second.suitabilityScore ?? -1) - (first.suitabilityScore ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      return second.scoreCoverage - first.scoreCoverage;
    });
}

module.exports = {
  SCORE_WEIGHTS,
  estimatedCostRange,
  normalise,
  rankPlaces,
  scorePlace,
};
