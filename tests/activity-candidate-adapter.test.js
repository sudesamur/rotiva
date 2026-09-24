"use strict";

const assert = require("node:assert/strict");
const { activityIdFor, expandSelectedActivities } = require("../src/route-engine/activity-candidate-adapter");
const { scorePlace } = require("../src/route-engine/place-suitability-score");
const { buildItinerary } = require("../src/route-engine/route-optimizer");
const { evaluateRegionHistoryExplorer } = require("../src/route-engine/scenario-evaluator");

const sultanahmet = require("../outputs/normalized/sultanahmet-eminonu.json").places;
const fener = require("../outputs/normalized/fener-balat-eyup-venues.json").places;
const topkapi = sultanahmet.find((place) => place.id === "topkapi-palace");
const originalTopkapi = JSON.parse(JSON.stringify(topkapi));
const [gardens, harem] = topkapi.activities;
const haremSelection = { placeId: topkapi.id, activityId: activityIdFor(harem) };
const gardensSelection = { placeId: topkapi.id, activityId: activityIdFor(gardens) };

assert.deepEqual(expandSelectedActivities([topkapi], []), []);
const [haremCandidate] = expandSelectedActivities([topkapi], [haremSelection]);
assert.equal(haremCandidate.candidateType, "activity");
assert.equal(haremCandidate.placeId, topkapi.id);
assert.equal(haremCandidate.activityId, haremSelection.activityId);
assert.equal(haremCandidate.durationMinutes, 60);
assert.equal(haremCandidate.costTRY, null);
assert.equal(haremCandidate.costSource, "unknown");
assert.deepEqual(haremCandidate.coordinates, topkapi.coordinates);
assert.deepEqual(topkapi, originalTopkapi);

const haremInterest = scorePlace(haremCandidate, {
  interests: ["history", "museum", "culture"],
  currentCoordinates: { lat: 41.0056, lng: 28.9769 },
  availableMinutes: 360,
  budgetTRY: 1300,
  walkingPreference: "normal",
  openingStatus: "unknown",
});
assert.ok(haremInterest.scoreBreakdown.interest > 0);
assert.equal(haremInterest.interestMatch.interestMatchType, "family");

const noSelection = evaluateRegionHistoryExplorer("sultanahmet-eminonu", sultanahmet);
assert.equal(noSelection.result.selectedActivities.length, 0);
assert.equal(noSelection.hardFilterReport.find((entry) => entry.placeId === topkapi.id).decision, "missing_visit_duration");

const haremRun = evaluateRegionHistoryExplorer("sultanahmet-eminonu", sultanahmet, undefined, { selectedActivities: [haremSelection] });
const selectedHarem = haremRun.route.stops.find((stop) => stop.activityId === haremSelection.activityId);
assert.ok(selectedHarem);
assert.equal(selectedHarem.candidateType, "activity");
assert.equal(selectedHarem.visitMinutes, 60);
assert.equal(selectedHarem.placeName, "Topkapı Sarayı");
assert.equal(selectedHarem.scheduleEligible, null);
assert.equal(selectedHarem.itineraryAutoEligible, false);

const gardensRun = evaluateRegionHistoryExplorer("sultanahmet-eminonu", sultanahmet, undefined, { selectedActivities: [gardensSelection] });
assert.equal(gardensRun.route.debug.activityCandidateCount, 1);
const gardensCandidate = gardensRun.route.stops.find((stop) => stop.activityId === gardensSelection.activityId)
  || gardensRun.route.debug.notSelected.find((entry) => entry.activityId === gardensSelection.activityId);
assert.ok(gardensCandidate);
assert.equal(gardensCandidate.visitMinutes || 180, 180);

const sameSelectionTwice = evaluateRegionHistoryExplorer("sultanahmet-eminonu", sultanahmet, undefined, { selectedActivities: [haremSelection, haremSelection] });
assert.equal(sameSelectionTwice.route.stops.filter((stop) => stop.placeId === topkapi.id).length, 1);

const explicitlySelectedBoth = buildItinerary(sultanahmet, {
  region: "sultanahmet-eminonu",
  startCoordinates: { lat: 41.0056, lng: 28.9769 }, startTime: "10:00", totalMinutes: 600,
  budgetTRY: 1300, walkingPreference: "normal", interests: ["history", "museum", "culture"],
  selectedActivities: [haremSelection, gardensSelection],
});
assert.equal(explicitlySelectedBoth.stops.filter((stop) => stop.placeId === topkapi.id).length, 2);

const outOfRegion = buildItinerary([...sultanahmet, ...fener], {
  region: "fener-balat",
  startCoordinates: { lat: 41.03, lng: 28.95 }, startTime: "10:00", totalMinutes: 300,
  budgetTRY: 1800, walkingPreference: "normal", interests: ["coffee"], selectedActivities: [haremSelection],
  visitMinutesByPlace: Object.fromEntries(fener.map((place) => [place.id, 45])),
  openingStatusByPlace: Object.fromEntries(fener.map((place) => [place.id, "open"])),
});
assert.equal(outOfRegion.debug.activityCandidateCount, 0);
assert.ok(outOfRegion.stops.every((stop) => stop.placeId !== topkapi.id));

const repeatHaremRun = evaluateRegionHistoryExplorer("sultanahmet-eminonu", sultanahmet, undefined, { selectedActivities: [haremSelection] });
assert.deepEqual(repeatHaremRun.route, haremRun.route);

console.log(JSON.stringify({
  selections: { harem: haremSelection, gardens: gardensSelection },
  noSelection: noSelection.result,
  harem: haremRun.result,
  gardens: gardensRun.result,
}));
