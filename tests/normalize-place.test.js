"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizePlace } = require("../src/data/normalize-place");
const { createProfiles, evaluateProfile } = require("../src/route-engine/scenario-evaluator");

const verified = normalizePlace({
  id: "verified", name: "Verified", type: "museum", coordinates: { lat: 41, lng: 29 },
  geocodeStatus: "verified", autoRouteEligible: true, activities: [{ name: "Visit", durationMinutes: 60, costTRY: 100, costConfidence: "official", tags: ["müze"] }],
  openingHours: "10:00–18:00",
});
assert.equal(verified.geocodeStatus, "verified");
assert.equal(verified.autoRouteEligible, true);
assert.equal(verified.category, "museum");
assert.equal(verified.type, "museum");

const approximate = normalizePlace({
  id: "approximate", name: "Approximate", type: "museum", coordinates: { lat: 41, lng: 29 },
  geocodeStatus: "approximate", autoRouteEligible: true, activities: [],
});
assert.equal(approximate.autoRouteEligible, false);

const unknownCoordinate = normalizePlace({ id: "unknown-coordinate", name: "Unknown", type: "museum", activities: [] });
assert.equal(unknownCoordinate.geocodeStatus, "unknown");
assert.equal(unknownCoordinate.autoRouteEligible, false);

const unknownCost = normalizePlace({
  id: "unknown-cost", name: "Unknown cost", type: "museum", activities: [{ name: "Visit" }],
});
assert.equal(unknownCost.costTRY, null);
assert.equal(unknownCost.costRangeTRY, null);
assert.ok(unknownCost.unknownFactors.includes("cost"));

const estimated = normalizePlace({
  id: "estimated", name: "Estimated", category: "cafe", activities: ["coffee"],
  estimatedSpendTRY: { coffee: [150, 300] },
});
assert.deepEqual(estimated.costRangeTRY, [150, 300]);
assert.equal(estimated.costConfidence, "estimated");
assert.equal(estimated.durationMinutes, null);

const unknownOpening = normalizePlace({ id: "unknown-opening", name: "Unknown opening", type: "museum", activities: [] });
assert.equal(unknownOpening.openingHours, null);
assert.equal(unknownOpening.openingHoursStatus, "unknown");

const sultanahmet = require("../outputs/sultanahmet-eminonu-seed-data.json");
const topkapi = sultanahmet.places.find((place) => place.id === "topkapi-palace");
const normalizedTopkapi = normalizePlace(topkapi, { sourceType: "seed" });
assert.equal(normalizedTopkapi.category, "palace");
assert.equal(normalizedTopkapi.type, "palace_museum");
assert.equal(normalizedTopkapi.durationMinutes, null);
assert.equal(normalizedTopkapi.autoRouteEligible, false);

const normalizedDirectory = path.join(__dirname, "..", "outputs", "normalized");
const normalizedPlaces = fs.readdirSync(normalizedDirectory)
  .filter((file) => file.endsWith(".json") && file !== "validation-report.json")
  .flatMap((file) => JSON.parse(fs.readFileSync(path.join(normalizedDirectory, file), "utf8")).places);
const rawFenerVenues = require("../outputs/fener-balat-eyup-food-coffee-venues.json").venues;
const historyProfile = (places) => createProfiles(places).find((profile) => profile.id === "history-explorer");
const rawHistory = evaluateProfile(historyProfile(rawFenerVenues), rawFenerVenues).results.find((result) => result.weightSet === "baseline");
const normalizedHistory = evaluateProfile(historyProfile(normalizedPlaces), normalizedPlaces).results.find((result) => result.weightSet === "baseline");
assert.equal(normalizedHistory.candidatePlaceCount, normalizedPlaces.length);
assert.equal(normalizedHistory.hardFilterPassedCount, rawHistory.hardFilterPassedCount + 3);
assert.ok(normalizedHistory.selectedCategories.includes("historical"));
assert.ok(normalizedHistory.categoryDiversityScore > rawHistory.categoryDiversityScore);

const normalizedSultanahmet = JSON.parse(fs.readFileSync(path.join(normalizedDirectory, "sultanahmet-eminonu.json"), "utf8")).places;
assert.equal(normalizedSultanahmet.filter((place) => place.geocodeStatus === "verified").length, 3);
assert.equal(normalizedSultanahmet.find((place) => place.id === "topkapi-palace").autoRouteEligible, true);

console.log(JSON.stringify({
  normalizedPlaceCount: normalizedPlaces.length,
  topkapi: { category: normalizedTopkapi.category, eligible: normalizedTopkapi.autoRouteEligible },
  historyComparison: {
    raw: { candidates: rawHistory.candidatePlaceCount, interest: rawHistory.interestMatchRate, diversity: rawHistory.categoryDiversityScore },
    normalized: { candidates: normalizedHistory.candidatePlaceCount, hardFilterPassed: normalizedHistory.hardFilterPassedCount, interest: normalizedHistory.interestMatchRate, diversity: normalizedHistory.categoryDiversityScore },
  },
}));
