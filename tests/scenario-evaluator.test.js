"use strict";

const assert = require("node:assert/strict");
const {
  WEIGHT_SETS,
  createProfiles,
  evaluateProfile,
  evaluateScenarios,
  sumWeights,
} = require("../src/route-engine/scenario-evaluator");
const fenerVenues = require("../outputs/fener-balat-eyup-food-coffee-venues.json").venues;

for (const weights of Object.values(WEIGHT_SETS)) assert.equal(sumWeights(weights), 100);

const profiles = createProfiles(fenerVenues);
const firstRun = evaluateScenarios(fenerVenues, profiles);
const secondRun = evaluateScenarios(fenerVenues, profiles);
assert.deepEqual(secondRun, firstRun);

function result(profileId, weightSet = "baseline") {
  return firstRun.profiles.find((profile) => profile.profileId === profileId).results.find((item) => item.weightSet === weightSet);
}

const history = result("history-explorer");
assert.ok(history.selectedPlaces.includes("nava-house-balat"));

const lowWalkingProfile = profiles.find((profile) => profile.id === "low-walking");
const lowWalking = evaluateProfile(lowWalkingProfile, fenerVenues).results.find((item) => item.weightSet === "baseline");
const normalWalking = evaluateProfile({
  ...lowWalkingProfile,
  context: { ...lowWalkingProfile.context, walkingPreference: "normal" },
}, fenerVenues).results.find((item) => item.weightSet === "baseline");
assert.ok(lowWalking.totalDistanceKm <= normalWalking.totalDistanceKm);

const walkingEdgePlaces = [
  {
    id: "near-stop", name: "Near stop", category: "cafe", suitabilityScore: 50,
    coordinates: { lat: 41.0305, lng: 28.95 }, geocodeStatus: "verified", autoRouteEligible: true, costTRY: 50,
  },
  {
    id: "far-stop", name: "Far stop", category: "museum", suitabilityScore: 100,
    coordinates: { lat: 41.052, lng: 28.95 }, geocodeStatus: "verified", autoRouteEligible: true, costTRY: 50,
  },
];
const walkingEdgeContext = {
  startCoordinates: { lat: 41.03, lng: 28.95 }, currentCoordinates: { lat: 41.03, lng: 28.95 }, startTime: "10:00",
  totalMinutes: 70, budgetTRY: 300, visitMinutesByPlace: { "near-stop": 30, "far-stop": 30 },
  openingStatusByPlace: { "near-stop": "open", "far-stop": "open" }, interests: [],
};
const syntheticLowWalking = evaluateProfile({ id: "synthetic-low", name: "Synthetic Low", context: { ...walkingEdgeContext, walkingPreference: "low" } }, walkingEdgePlaces).results[0];
const syntheticNormalWalking = evaluateProfile({ id: "synthetic-normal", name: "Synthetic Normal", context: { ...walkingEdgeContext, walkingPreference: "normal" } }, walkingEdgePlaces).results[0];
assert.ok(syntheticLowWalking.totalDistanceKm < syntheticNormalWalking.totalDistanceKm);

const budgetTraveler = result("budget-traveler");
assert.ok(budgetTraveler.uncertainCostRange.min <= 600);
assert.ok(budgetTraveler.remainingBudgetTRY >= 0);

const shortTrip = result("short-trip");
assert.ok(shortTrip.remainingMinutes >= 0);
assert.ok(shortTrip.totalVisitMinutes + shortTrip.totalTravelMinutes <= 150);

const coffeeFood = result("coffee-food");
assert.equal(coffeeFood.interestMatchRate, 100);
assert.ok((coffeeFood.categoryDistribution.cafe || 0) + (coffeeFood.categoryDistribution.restaurant || 0) >= 2);

const allHardFiltersRemainApplied = firstRun.profiles.every((profile) => profile.results.every((item) => item.hardFilterPassedCount <= item.candidatePlaceCount));
assert.equal(allHardFiltersRemainApplied, true);

console.log(JSON.stringify({
  weightSetSummary: firstRun.weightSetSummary,
  history: { stops: history.selectedStopCount, interestMatchRate: history.interestMatchRate },
  lowWalking: { distanceKm: lowWalking.totalDistanceKm, normalDistanceKm: normalWalking.totalDistanceKm },
  syntheticWalking: { lowDistanceKm: syntheticLowWalking.totalDistanceKm, normalDistanceKm: syntheticNormalWalking.totalDistanceKm },
  budgetTraveler: { minimumCost: budgetTraveler.uncertainCostRange.min, remainingBudget: budgetTraveler.remainingBudgetTRY },
  shortTrip: { stops: shortTrip.selectedStopCount, remainingMinutes: shortTrip.remainingMinutes },
  coffeeFood: { interestMatchRate: coffeeFood.interestMatchRate, categories: coffeeFood.categoryDistribution },
}));
