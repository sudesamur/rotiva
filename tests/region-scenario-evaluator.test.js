"use strict";

const assert = require("node:assert/strict");
const { scorePlace } = require("../src/route-engine/place-suitability-score");
const { evaluateInterestMatch, INTEREST_MATCH_SCORES } = require("../src/route-engine/interest-mapping");
const { buildItinerary, scheduleEligibility } = require("../src/route-engine/route-optimizer");
const { evaluateRegionHistoryExplorer } = require("../src/route-engine/scenario-evaluator");

const sultanahmet = require("../outputs/normalized/sultanahmet-eminonu.json").places;
const fener = require("../outputs/normalized/fener-balat-eyup-venues.json").places;
const allPlaces = [...sultanahmet, ...fener];

const sultanahmetEvaluation = evaluateRegionHistoryExplorer("sultanahmet-eminonu", allPlaces);
assert.deepEqual(sultanahmetEvaluation.profile.context.interests, ["history", "museum", "culture"]);
assert.equal(sultanahmetEvaluation.route.debug.candidateCount, sultanahmet.length);
assert.equal(sultanahmetEvaluation.route.debug.excludedByRegionCount, fener.length);
const sultanahmetIds = new Set(sultanahmet.map((place) => place.id));
assert.ok(sultanahmetEvaluation.route.stops.every((stop) => sultanahmetIds.has(stop.placeId)));

const topkapi = sultanahmet.find((place) => place.id === "topkapi-palace");
assert.equal(topkapi.geocodeStatus, "verified");
assert.equal(topkapi.autoRouteEligible, true);
assert.equal(topkapi.durationMinutes, null);
assert.deepEqual(topkapi.activities.map((activity) => activity.durationMinutes), [180, 60]);
const topkapiAudit = sultanahmetEvaluation.hardFilterReport.find((entry) => entry.placeId === topkapi.id);
assert.equal(topkapiAudit.coordinateRouteEligible, true);
assert.equal(topkapiAudit.scheduleEligible, false);
assert.equal(topkapiAudit.decision, "missing_visit_duration");

const fenerRoute = buildItinerary(allPlaces, {
  region: "fener-balat",
  startCoordinates: { lat: 41.03, lng: 28.95 },
  startTime: "10:00",
  totalMinutes: 300,
  budgetTRY: 1800,
  walkingPreference: "normal",
  visitMinutesByPlace: Object.fromEntries(fener.map((place) => [place.id, 45])),
  openingStatusByPlace: Object.fromEntries(fener.map((place) => [place.id, "open"])),
  interests: ["cafe", "restaurant"],
});
assert.ok(fenerRoute.stops.length > 0);
const fenerIds = new Set(fener.map((place) => place.id));
assert.ok(fenerRoute.stops.every((stop) => fenerIds.has(stop.placeId)));
assert.equal(fenerRoute.debug.candidateCount, fener.length);
assert.equal(fenerRoute.debug.excludedByRegionCount, sultanahmet.length);

function interestMatch(category, tags, interest, type) {
  return evaluateInterestMatch({
    id: `${category}-${interest}`,
    name: category,
    category,
    type,
    tags,
    activities: [],
  }, [interest]).primary;
}

const museumExact = interestMatch("museum", [], "museum");
const historicalFamily = interestMatch("historical", [], "history");
const palaceFamily = interestMatch("palace", [], "history", "palace_museum");
const culturalFamily = interestMatch("cultural", [], "culture");
const coffeeFamily = interestMatch("cafe", [], "coffee");
const unrelated = interestMatch("park", [], "museum");
assert.equal(museumExact.interestMatchType, "exact");
assert.equal(museumExact.interestMatchScore, INTEREST_MATCH_SCORES.exact);
assert.equal(historicalFamily.interestMatchType, "family");
assert.equal(palaceFamily.interestMatchType, "family");
assert.equal(culturalFamily.interestMatchType, "family");
assert.equal(coffeeFamily.interestMatchType, "family");
assert.equal(unrelated.interestMatchType, "none");
const topkapiInterest = evaluateInterestMatch(topkapi, ["history", "museum", "culture"]);
assert.equal(topkapiInterest.score > 0, true);
assert.deepEqual(topkapiInterest.matches.map((match) => [match.matchedInterest, match.matchedField, match.interestMatchType]), [
  ["history", "category", "family"],
  ["museum", "type", "family"],
  ["culture", "category", "family"],
]);
const topkapiScore = scorePlace(topkapi, {
  interests: ["history", "museum", "culture"],
  currentCoordinates: { lat: 41.0056, lng: 28.9769 },
  availableMinutes: 360,
  budgetTRY: 1300,
  walkingPreference: "normal",
  openingStatus: "unknown",
});
assert.equal(topkapiScore.interestMatch.interestMatchType, "family");
assert.equal(topkapiScore.interestMatches.length, 3);
assert.equal(scheduleEligibility(topkapi, {}), false);
assert.equal(scheduleEligibility(sultanahmet.find((place) => place.id === "turkish-islamic-arts-museum"), {}), null);

console.log(JSON.stringify({
  regional: {
    selected: sultanahmetEvaluation.result.selectedPlaces,
    hardFilterPassedCount: sultanahmetEvaluation.result.hardFilterPassedCount,
    totalDistanceKm: sultanahmetEvaluation.result.totalDistanceKm,
  },
  topkapi: topkapiAudit,
  semanticInterestMatches: {
    museumExact,
    historicalFamily,
    palaceFamily,
    culturalFamily,
    coffeeFamily,
    unrelated,
    topkapiInterest,
    topkapiScore: topkapiScore.interestMatch,
  },
}));
