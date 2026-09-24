"use strict";

const assert = require("node:assert/strict");
const { getAvailableActivities, planTrip } = require("../src/planner/planner-service");

const baseRequest = {
  region: "sultanahmet-eminonu",
  availableMinutes: 360,
  budgetTRY: 1500,
  interests: ["history", "museum", "culture"],
  walkingPreference: "normal",
  startLocation: { lat: 41.0056, lng: 28.9769 },
  plannedStartTime: "10:00",
  weather: { condition: "clear" },
};

const activities = getAvailableActivities("sultanahmet-eminonu", "topkapi-palace");
assert.equal(activities.success, true);
assert.deepEqual(activities.activities.map((activity) => [activity.activityId, activity.durationMinutes]), [
  ["saray-ve-bahçeler-gezisi", 180],
  ["harem-bölümü-gezisi", 60],
]);
assert.equal(activities.activities[1].cost.costTRY, null);

const withoutActivity = planTrip(baseRequest);
assert.equal(withoutActivity.success, true);
assert.equal(withoutActivity.itinerary.some((stop) => stop.placeId === "topkapi-palace"), false);
assert.ok(withoutActivity.warnings.some((item) => item.code === "ACTIVITY_SELECTION_REQUIRED" && item.placeId === "topkapi-palace"));
assert.ok(withoutActivity.warnings.some((item) => item.code === "UNKNOWN_OPENING_HOURS"));
assert.ok(withoutActivity.warnings.some((item) => item.code === "UNKNOWN_COST"));
assert.ok(withoutActivity.itinerary.every((stop) => stop.cost.rangeTRY !== 0));

const haremRequest = {
  ...baseRequest,
  selectedActivities: [{ placeId: "topkapi-palace", activityId: "harem-bölümü-gezisi" }],
};
const withHarem = planTrip(haremRequest);
assert.equal(withHarem.success, true);
const haremStop = withHarem.itinerary.find((stop) => stop.activityId === "harem-bölümü-gezisi");
assert.ok(haremStop);
assert.equal(haremStop.candidateType, "activity");
assert.equal(haremStop.visitMinutes, 60);
assert.equal(haremStop.placeId, "topkapi-palace");
assert.equal(haremStop.cost.type, "unknownCost");
assert.equal(haremStop.scheduleEligible, null);
assert.equal(haremStop.itineraryAutoEligible, false);
assert.ok(haremStop.interestMatch);

const unknownRegion = planTrip({ ...baseRequest, region: "unknown-region" });
assert.equal(unknownRegion.error.code, "UNKNOWN_REGION");
assert.equal(planTrip({ ...baseRequest, budgetTRY: -1 }).error.code, "INVALID_PLANNER_REQUEST");
assert.equal(planTrip({ ...baseRequest, availableMinutes: 0 }).error.code, "INVALID_PLANNER_REQUEST");
assert.equal(planTrip({ ...baseRequest, startLocation: { lat: 100, lng: 0 } }).error.code, "INVALID_PLANNER_REQUEST");
assert.equal(planTrip({ ...baseRequest, selectedActivities: [{ placeId: "topkapi-palace", activityId: "not-real" }] }).error.code, "UNKNOWN_ACTIVITY");
assert.equal(planTrip({ ...baseRequest, region: "fener-balat", selectedActivities: haremRequest.selectedActivities }).error.code, "UNKNOWN_ACTIVITY");

const { budgetTRY: ignoredBudget, ...unknownBudgetRequest } = baseRequest;
const unknownBudget = planTrip(unknownBudgetRequest);
assert.equal(unknownBudget.requestSummary.budgetStatus, "unknown");
assert.equal(unknownBudget.requestSummary.budgetTRY, null);
assert.deepEqual(planTrip(haremRequest), withHarem);

console.log(JSON.stringify({
  availableActivities: activities.activities,
  noActivity: { summary: withoutActivity.summary, warnings: withoutActivity.warnings },
  harem: { summary: withHarem.summary, itinerary: withHarem.itinerary },
}));
