"use strict";

const assert = require("node:assert/strict");
const { rankPlaces, scorePlace } = require("../src/route-engine/place-suitability-score");
const fenerVenues = require("../outputs/fener-balat-eyup-food-coffee-venues.json").venues;

const baseContext = {
  availableMinutes: 180,
  remainingBudgetTRY: 800,
  interests: ["kahve", "fotoğraf"],
  currentCoordinates: { lat: 41.0300, lng: 28.9500 },
  walkingPreference: "normal",
  weather: "rain",
  wantsMeal: false,
  mealWindowActive: false,
  openingStatus: "open",
};

const suitableCafe = {
  id: "test-cafe",
  name: "Test Cafe",
  coordinates: { lat: 41.0304, lng: 28.9504 },
  geocodeStatus: "verified",
  autoRouteEligible: true,
  category: "specialty_coffee",
  tags: ["kahve", "fotoğraf", "kapalı-mekân"],
  estimatedSpendTRY: { coffee: [150, 300] },
  durationMinutes: 45,
};

const unknownCostCafe = {
  ...suitableCafe,
  id: "unknown-cost-cafe",
  estimatedSpendTRY: undefined,
};

const unverifiedCafe = {
  ...suitableCafe,
  id: "unverified-cafe",
  geocodeStatus: "address_verified",
  autoRouteEligible: false,
};

const tooExpensiveRestaurant = {
  ...suitableCafe,
  id: "too-expensive",
  tags: ["akşam-yemeği", "restoran"],
  estimatedSpendTRY: { meal: [1000, 1500] },
};

const farOutdoorRestaurant = {
  ...suitableCafe,
  id: "far-outdoor-restaurant",
  coordinates: { lat: 41.0800, lng: 29.0400 },
  tags: ["akşam-yemeği", "restoran", "açık-hava"],
  estimatedSpendTRY: { meal: [300, 600] },
  durationMinutes: 70,
};

const suitableResult = scorePlace(suitableCafe, baseContext);
assert.equal(suitableResult.eligible, true);
assert.ok(suitableResult.suitabilityScore >= 80);
assert.equal(suitableResult.scoreBreakdown.weather, 100);

const unknownCostResult = scorePlace(unknownCostCafe, baseContext);
assert.equal(unknownCostResult.eligible, true);
assert.equal(unknownCostResult.scoreBreakdown.budget, null);
assert.ok(unknownCostResult.unknownFactors.includes("budget"));
assert.ok(unknownCostResult.scoreCoverage < suitableResult.scoreCoverage);

const unverifiedResult = scorePlace(unverifiedCafe, baseContext);
assert.equal(unverifiedResult.eligible, false);
assert.equal(unverifiedResult.hardFilter, "unverified_coordinates");

const closedResult = scorePlace(suitableCafe, { ...baseContext, openingStatus: "closed" });
assert.equal(closedResult.eligible, false);
assert.equal(closedResult.hardFilter, "closed_at_planned_time");

const expensiveResult = scorePlace(tooExpensiveRestaurant, baseContext);
assert.equal(expensiveResult.eligible, false);
assert.equal(expensiveResult.hardFilter, "minimum_cost_exceeds_remaining_budget");

const mealResult = scorePlace(farOutdoorRestaurant, {
  ...baseContext,
  walkingPreference: "low",
  wantsMeal: true,
  mealWindowActive: true,
  weather: "rain",
});
assert.equal(mealResult.eligible, true);
assert.equal(mealResult.scoreBreakdown.meal, 100);
assert.equal(mealResult.scoreBreakdown.weather, 20);
assert.ok(mealResult.scoreBreakdown.distance < suitableResult.scoreBreakdown.distance);

const unknownOpeningResult = scorePlace(suitableCafe, { ...baseContext, openingStatus: "unknown" });
assert.equal(unknownOpeningResult.eligible, true);
assert.equal(unknownOpeningResult.scoreBreakdown.openingHours, null);

const ranked = rankPlaces([unverifiedCafe, unknownCostCafe, suitableCafe, tooExpensiveRestaurant], baseContext);
assert.equal(ranked[0].placeId, "test-cafe");
assert.equal(ranked[1].placeId, "unknown-cost-cafe");
assert.equal(ranked[3].placeId, "too-expensive");

const ferm = fenerVenues.find((venue) => venue.id === "ferm-caffee-bakery-fener");
const tantuni = fenerVenues.find((venue) => venue.id === "tantuni-istanbul-balat");
const actualCoffeeResult = scorePlace({ ...ferm, durationMinutes: 45 }, {
  availableMinutes: 180,
  budgetTRY: 600,
  interests: ["kahve", "fotoğraf"],
  currentCoordinates: { lat: 41.0300, lng: 28.9500 },
  walkingPreference: "low",
  openingStatus: "open",
});
const actualLunchResult = scorePlace({ ...tantuni, durationMinutes: 60 }, {
  availableMinutes: 180,
  budgetTRY: 600,
  interests: ["tantuni", "öğle-yemeği", "yemek"],
  currentCoordinates: { lat: 41.0320, lng: 28.9480 },
  walkingPreference: "normal",
  weather: "rain",
  wantsMeal: true,
  mealWindowActive: true,
  openingStatus: "open",
});
assert.equal(actualCoffeeResult.eligible, true);
assert.equal(actualLunchResult.eligible, true);
assert.equal(actualLunchResult.scoreBreakdown.meal, 100);

console.log(JSON.stringify({
  suitableCafe: { score: suitableResult.suitabilityScore, breakdown: suitableResult.scoreBreakdown },
  unknownCostCafe: { score: unknownCostResult.suitabilityScore, coverage: unknownCostResult.scoreCoverage, breakdown: unknownCostResult.scoreBreakdown },
  rainyMealProfile: { score: mealResult.suitabilityScore, breakdown: mealResult.scoreBreakdown },
  actualVenueProfiles: {
    fermCoffee: { score: actualCoffeeResult.suitabilityScore, breakdown: actualCoffeeResult.scoreBreakdown },
    tantuniLunch: { score: actualLunchResult.suitabilityScore, breakdown: actualLunchResult.scoreBreakdown },
  },
  excluded: [unverifiedResult.hardFilter, closedResult.hardFilter, expensiveResult.hardFilter],
}));
