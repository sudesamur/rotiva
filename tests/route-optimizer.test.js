"use strict";

const assert = require("node:assert/strict");
const { metersBetween } = require("../src/route-engine/geo-utils");
const { buildItinerary, walkingMinutes } = require("../src/route-engine/route-optimizer");
const fenerVenues = require("../outputs/fener-balat-eyup-food-coffee-venues.json").venues;

const startCoordinates = { lat: 41.03, lng: 28.95 };
const baseContext = {
  startCoordinates,
  startTime: "10:00",
  totalMinutes: 120,
  budgetTRY: 500,
  walkingPreference: "low",
  openingStatusByPlace: {},
};

function place(id, suitabilityScore, coordinates, costTRY = 100, durationMinutes = 40) {
  return {
    id,
    name: id,
    coordinates,
    geocodeStatus: "verified",
    autoRouteEligible: true,
    durationMinutes,
    costTRY,
    suitabilityScore,
  };
}

const closeFirst = place("close-first", 87, { lat: 41.031, lng: 28.9502 });
const closeSecond = place("close-second", 84, { lat: 41.0314, lng: 28.9508 });
const farHighest = place("far-highest", 98, { lat: 41.06, lng: 28.95 });
const efficientRoute = buildItinerary([farHighest, closeSecond, closeFirst], baseContext);
assert.deepEqual(efficientRoute.stops.map((stop) => stop.placeId), ["close-first", "close-second"]);
assert.equal(efficientRoute.summary.totalVisitMinutes, 80);

const timeOverflow = buildItinerary([place("too-long", 90, startCoordinates, 100, 121)], baseContext);
assert.equal(timeOverflow.stops.length, 0);
assert.ok(timeOverflow.warnings.some((warning) => warning.includes("duration_exceeds_remaining_time")));

const budgetOverflow = buildItinerary([place("too-expensive", 90, startCoordinates, 501)], baseContext);
assert.equal(budgetOverflow.stops.length, 0);
assert.ok(budgetOverflow.warnings.some((warning) => warning.includes("minimum_cost_exceeds_remaining_budget")));

const closed = place("closed", 90, startCoordinates);
const closedRoute = buildItinerary([closed], { ...baseContext, openingStatusByPlace: { closed: "closed" } });
assert.equal(closedRoute.stops.length, 0);
assert.ok(closedRoute.warnings.some((warning) => warning.includes("closed_at_planned_time")));

const unverified = { ...closeFirst, id: "unverified", geocodeStatus: "address_verified", autoRouteEligible: false };
const unverifiedRoute = buildItinerary([unverified], baseContext);
assert.equal(unverifiedRoute.stops.length, 0);
assert.ok(unverifiedRoute.warnings.some((warning) => warning.includes("unverified_coordinates")));

const unknownCost = { ...closeFirst, id: "unknown-cost", costTRY: undefined };
const unknownCostRoute = buildItinerary([unknownCost], baseContext);
assert.equal(unknownCostRoute.stops[0].costType, "unknownCost");
assert.deepEqual(unknownCostRoute.summary.unknownCostPlaceIds, ["unknown-cost"]);
assert.equal(unknownCostRoute.summary.budgetReservedMinimumTRY, 0);
assert.ok(unknownCostRoute.warnings.some((warning) => warning.includes("ücretsiz kabul edilmedi")));
assert.equal(unknownCostRoute.routeScoreBreakdown.budgetFit, 50);

const oneDegreeDistance = metersBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
assert.ok(oneDegreeDistance > 111000 && oneDegreeDistance < 112500);
assert.equal(walkingMinutes(4800), 60);

const walkingPlace = place("walking-place", 90, { lat: 41.055, lng: 28.95 });
const lowWalking = buildItinerary([walkingPlace], baseContext);
const highWalking = buildItinerary([walkingPlace], { ...baseContext, walkingPreference: "high" });
assert.ok(lowWalking.stops[0].routeCandidateScore < highWalking.stops[0].routeCandidateScore);

const repeatedRoute = buildItinerary([farHighest, closeSecond, closeFirst], baseContext);
assert.deepEqual(repeatedRoute, efficientRoute);

function categoryPlace(id, category, suitabilityScore) {
  return { ...place(id, suitabilityScore, { lat: 41.0305, lng: 28.9505 }, 100, 30), category };
}

const threeCafesAndMuseum = [
  categoryPlace("cafe-one", "specialty_coffee", 90),
  categoryPlace("cafe-two", "neighborhood_cafe", 89),
  categoryPlace("cafe-three", "coffee_bakery", 88),
  categoryPlace("museum", "museum", 87),
];
const diverseRoute = buildItinerary(threeCafesAndMuseum, { ...baseContext, totalMinutes: 120 });
assert.ok(diverseRoute.stops.some((stop) => stop.category === "museum"));
assert.ok(diverseRoute.stops.filter((stop) => stop.category === "cafe").length < 3);
const museumStop = diverseRoute.stops.find((stop) => stop.category === "museum");
assert.ok(museumStop.selectionReasons.includes("adds_category_diversity"));
assert.equal(museumStop.selectionBreakdown.diversity, 100);

const coffeeFocusedRoute = buildItinerary(threeCafesAndMuseum, {
  ...baseContext,
  totalMinutes: 90,
  interests: ["coffee"],
});
assert.deepEqual(coffeeFocusedRoute.stops.slice(0, 2).map((stop) => stop.category), ["cafe", "cafe"]);

const farMuseum = { ...categoryPlace("far-museum", "museum", 87), coordinates: { lat: 41.07, lng: 28.95 } };
const distanceFirstRoute = buildItinerary([
  categoryPlace("near-cafe-one", "specialty_coffee", 90),
  categoryPlace("near-cafe-two", "neighborhood_cafe", 89),
  categoryPlace("near-cafe-three", "coffee_bakery", 88),
  farMuseum,
], { ...baseContext, totalMinutes: 100 });
assert.equal(distanceFirstRoute.stops.some((stop) => stop.placeId === "far-museum"), false);
assert.ok(distanceFirstRoute.debug.notSelected.find((place) => place.placeId === "far-museum").notSelectedReasons.includes("too_far_from_current_route"));

const ferm = fenerVenues.find((venue) => venue.id === "ferm-caffee-bakery-fener");
const rincon = fenerVenues.find((venue) => venue.id === "rincon-coffee-balat");
const nava = fenerVenues.find((venue) => venue.id === "nava-house-balat");
const fenerRoute = buildItinerary([
  { place: ferm, suitabilityScore: 72 },
  { place: rincon, suitabilityScore: 76 },
  { place: nava, suitabilityScore: 88 },
], {
  startCoordinates,
  startTime: "10:00",
  totalMinutes: 240,
  budgetTRY: 1200,
  walkingPreference: "normal",
  visitMinutesByPlace: {
    "ferm-caffee-bakery-fener": 45,
    "rincon-coffee-balat": 45,
    "nava-house-balat": 60,
  },
  openingStatusByPlace: {
    "ferm-caffee-bakery-fener": "open",
    "rincon-coffee-balat": "open",
    "nava-house-balat": "open",
  },
});
assert.equal(fenerRoute.stops.length, 3);
assert.ok(fenerRoute.summary.totalDistanceKm > 0);

const fenerDurations = Object.fromEntries(fenerVenues.map((venue) => [venue.id, 45]));
const fenerOpenStatus = Object.fromEntries(fenerVenues.map((venue) => [venue.id, "open"]));
const fenerComparisonContext = {
  startCoordinates,
  startTime: "10:00",
  totalMinutes: 300,
  budgetTRY: 1500,
  walkingPreference: "normal",
  interests: ["kahve", "öğle-yemeği", "fotoğraf"],
  currentCoordinates: startCoordinates,
  visitMinutesByPlace: fenerDurations,
  openingStatusByPlace: fenerOpenStatus,
};
const fenerLegacyRoute = buildItinerary(fenerVenues, { ...fenerComparisonContext, enableCategoryDiversity: false });
const fenerDiverseRoute = buildItinerary(fenerVenues, fenerComparisonContext);
assert.equal(fenerLegacyRoute.stops.length, fenerDiverseRoute.stops.length);
assert.ok(fenerDiverseRoute.stops.every((stop) => ["cafe", "restaurant"].includes(stop.category)));
assert.ok(fenerLegacyRoute.stops.every((stop) => ["cafe", "restaurant"].includes(stop.category)));
assert.equal(fenerDiverseRoute.summary.categoryDiversityScore, fenerLegacyRoute.summary.categoryDiversityScore);

console.log(JSON.stringify({
  efficientRoute: efficientRoute.stops.map((stop) => ({ id: stop.placeId, score: stop.routeCandidateScore })),
  fenerRoute: fenerRoute.stops.map((stop) => ({ name: stop.name, arrival: stop.arrivalTime, departure: stop.departureTime })),
  fenerSummary: fenerRoute.summary,
  fenerRouteScore: fenerRoute.routeScore,
  diversityRoute: {
    categories: diverseRoute.summary.categorySummary,
    score: diverseRoute.summary.categoryDiversityScore,
  },
  fenerComparison: {
    legacy: {
      selected: fenerLegacyRoute.stops.map((stop) => stop.placeId),
      categories: fenerLegacyRoute.summary.categorySummary,
      routeScore: fenerLegacyRoute.routeScore,
    },
    diverse: {
      selected: fenerDiverseRoute.stops.map((stop) => stop.placeId),
      categories: fenerDiverseRoute.summary.categorySummary,
      routeScore: fenerDiverseRoute.routeScore,
    },
  },
}));
