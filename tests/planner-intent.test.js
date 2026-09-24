"use strict";

const assert = require("node:assert/strict");
const { parsePlannerIntent } = require("../src/ai/planner-intent-parser");
const { resolveRequestedActivities } = require("../src/ai/activity-intent-resolver");
const { buildPlannerRequest } = require("../src/ai/planner-request-builder");
const { validatePlannerRequest } = require("../src/planner/planner-request-validator");
const { planTrip } = require("../src/planner/planner-service");

const basic = parsePlannerIntent("Sultanahmet'ta 4 saatim var");
assert.equal(basic.region, "sultanahmet-eminonu");
assert.equal(basic.availableMinutes, 240);
assert.equal(parsePlannerIntent("2 buçuk saatim var").availableMinutes, 150);
assert.equal(parsePlannerIntent("1000 TL bütçem var").budgetTRY, 1000);
assert.deepEqual(parsePlannerIntent("Tarih ve müze seviyorum").interests, ["history", "museum"]);
assert.equal(parsePlannerIntent("Çok yürümek istemiyorum").walkingPreference, "low");
assert.equal(parsePlannerIntent("10'da başlayacağım").plannedStartTime, "10:00");

const activityIntent = parsePlannerIntent("Topkapı'da Harem'i görmek istiyorum.");
assert.deepEqual(activityIntent.requestedActivities, [{ placeQuery: "Topkapı", activityQuery: "Harem" }]);
const activityResolution = resolveRequestedActivities("sultanahmet-eminonu", activityIntent.requestedActivities);
assert.deepEqual(activityResolution.selectedActivities, [{ placeId: "topkapi-palace", activityId: "harem-bölümü-gezisi" }]);

const noBudget = parsePlannerIntent("Sultanahmet'ta 4 saatim var");
assert.equal(noBudget.budgetTRY, null);
assert.equal(Object.hasOwn(noBudget, "budgetTRY"), true);
assert.equal(parsePlannerIntent("Sultanahmet'ta müze gezmek istiyorum").availableMinutes, null);
assert.equal(parsePlannerIntent("Beşiktaş'ta gezmek istiyorum").region, null);
assert.ok(parsePlannerIntent("sabah başlayacağım").ambiguities.includes("ambiguous_start_time"));
assert.deepEqual(resolveRequestedActivities("sultanahmet-eminonu", [{ placeQuery: "Topkapı", activityQuery: "Bilinmeyen" }]).selectedActivities, []);

const demoText = "Sultanahmet'ta 5 saatim var. Tarihi yerleri ve müzeleri seviyorum. Çok yürümek istemiyorum. Bütçem 1000 TL. Topkapı'da Harem'i görmek istiyorum.";
const demoIntent = parsePlannerIntent(demoText);
const missingLocation = buildPlannerRequest(demoIntent);
assert.equal(missingLocation.success, false);
assert.deepEqual(missingLocation.missingFields, ["startLocation"]);
const built = buildPlannerRequest(demoIntent, { startLocation: { lat: 41.0056, lng: 28.9769 }, startLocationSource: "default" });
assert.equal(built.success, true);
assert.equal(built.fieldSources.startLocation, "default");
assert.equal(validatePlannerRequest(built.request).valid, true);
const route = planTrip(built.request);
assert.equal(route.success, true);
assert.ok(route.itinerary.some((stop) => stop.activityId === "harem-bölümü-gezisi"));

console.log(JSON.stringify({ demoIntent, resolvedActivities: built.resolvedActivities, request: built.request, route: route.summary }));
