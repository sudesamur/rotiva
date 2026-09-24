"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { createApp } = require("../src/api/app");

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

async function run() {
  const server = http.createServer(createApp({ allowedOrigins: ["http://localhost:5173"] }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const call = async (path, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    return { status: response.status, body: await response.json() };
  };
  try {
    const health = await call("/api/health");
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { success: true, status: "ok" });

    const regions = await call("/api/regions");
    assert.equal(regions.status, 200);
    assert.ok(regions.body.regions.some((region) => region.id === "sultanahmet-eminonu"));

    const activities = await call("/api/regions/sultanahmet-eminonu/places/topkapi-palace/activities");
    assert.equal(activities.status, 200);
    assert.equal(activities.body.place.name, "Topkapı Sarayı");
    assert.deepEqual(activities.body.activities.map((activity) => activity.durationMinutes), [180, 60]);
    const activityPlaces = await call("/api/regions/sultanahmet-eminonu/activities");
    assert.equal(activityPlaces.status, 200);
    assert.ok(activityPlaces.body.places.some((place) => place.id === "topkapi-palace"));
    assert.equal((await call("/api/regions/unknown/places/topkapi-palace/activities")).status, 404);
    assert.equal((await call("/api/regions/sultanahmet-eminonu/places/unknown/activities")).status, 404);

    const post = (body) => call("/api/planner/plan", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const noActivity = await post(baseRequest);
    assert.equal(noActivity.status, 200);
    assert.equal(noActivity.body.itinerary.some((stop) => stop.placeId === "topkapi-palace"), false);
    assert.ok(noActivity.body.warnings.some((warning) => warning.code === "ACTIVITY_SELECTION_REQUIRED"));
    assert.ok(noActivity.body.warnings.some((warning) => warning.code === "UNKNOWN_COST"));
    assert.ok(noActivity.body.warnings.some((warning) => warning.code === "UNKNOWN_OPENING_HOURS"));
    assert.ok(noActivity.body.itinerary.every((stop) => stop.cost.rangeTRY !== 0));

    assert.equal((await post({ ...baseRequest, availableMinutes: 0 })).status, 400);
    assert.equal((await post({ ...baseRequest, budgetTRY: -1 })).status, 400);
    assert.equal((await post({ ...baseRequest, region: "unknown" })).status, 404);
    assert.equal((await post({ ...baseRequest, selectedActivities: [{ placeId: "topkapi-palace", activityId: "unknown" }] })).status, 404);

    const interpret = async (body) => call("/api/planner/interpret", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const interpreted = await interpret({
      text: "Sultanahmet'ta 4 saatim var. Topkapı'da Harem'i görmek istiyorum.",
      startLocation: baseRequest.startLocation,
    });
    assert.equal(interpreted.status, 200);
    assert.equal(interpreted.body.intent.region, "sultanahmet-eminonu");
    assert.equal(interpreted.body.intent.availableMinutes, 240);
    assert.deepEqual(interpreted.body.resolvedActivities, [{ placeId: "topkapi-palace", activityId: "harem-bölümü-gezisi" }]);
    assert.equal(interpreted.body.fieldSources.startLocation, "ui");
    assert.equal(interpreted.body.parserMetadata.mode, "rule_based");
    const llmFallback = await interpret({ text: "Sultanahmet'ta 4 saatim var", parserMode: "llm" });
    assert.equal(llmFallback.status, 200);
    assert.equal(llmFallback.body.parserMetadata.mode, "rule_based_fallback");
    const clarification = await interpret({ text: "Sultanahmet'ta tarihi yerleri gezmek istiyorum." });
    assert.equal(clarification.status, 200);
    assert.equal(clarification.body.needsClarification, true);
    assert.ok(clarification.body.missingFields.includes("availableMinutes"));
    const unsupported = await interpret({ text: "Beşiktaş'ta gezmek istiyorum." });
    assert.ok(unsupported.body.ambiguities.includes("unsupported_region"));

    const haremRequest = {
      ...baseRequest,
      selectedActivities: [{ placeId: "topkapi-palace", activityId: "harem-bölümü-gezisi" }],
    };
    const harem = await post(haremRequest);
    assert.equal(harem.status, 200);
    const haremStop = harem.body.itinerary.find((stop) => stop.activityId === "harem-bölümü-gezisi");
    assert.ok(haremStop);
    assert.equal(haremStop.candidateType, "activity");
    assert.equal(haremStop.visitMinutes, 60);
    assert.equal(haremStop.cost.type, "unknownCost");
    assert.equal(haremStop.scheduleEligible, null);
    assert.equal(haremStop.itineraryAutoEligible, false);
    assert.deepEqual((await post(haremRequest)).body.itinerary, harem.body.itinerary);

    console.log(JSON.stringify({ health, regions: regions.body.regions.length, interpreted: interpreted.body.intent, noActivity: noActivity.body.summary, harem: harem.body.summary }));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
