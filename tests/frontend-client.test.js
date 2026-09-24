"use strict";

const assert = require("node:assert/strict");
const { buildPlannerRequest, interpretedFormValues, warningText } = require("../frontend/src/client-utils");
const { client } = require("../frontend/src/api/planner-client");

const request = buildPlannerRequest({
  region: "sultanahmet-eminonu", availableMinutes: "360", budgetTRY: "",
  interests: ["history", "museum", "culture"], walkingPreference: "normal",
  startLat: "41.0056", startLng: "28.9769", plannedStartTime: "10:00", weather: "clear",
  selectedActivities: [{ placeId: "topkapi-palace", activityId: "harem-bölümü-gezisi" }],
});
assert.equal(Object.hasOwn(request, "budgetTRY"), false);
assert.deepEqual(request.interests, ["history", "museum", "culture"]);
assert.deepEqual(request.selectedActivities, [{ placeId: "topkapi-palace", activityId: "harem-bölümü-gezisi" }]);
assert.equal(warningText("UNKNOWN_COST"), "Bazı mekanların maliyet bilgisi bilinmiyor.");
assert.equal(warningText("ACTIVITY_SELECTION_REQUIRED"), "Bazı mekanlar için ziyaret türü seçmeniz gerekiyor.");
assert.equal(typeof client.planTrip, "function");
assert.deepEqual(interpretedFormValues({ region: "sultanahmet-eminonu", availableMinutes: 240, budgetTRY: null, interests: ["history"], walkingPreference: "low", plannedStartTime: null }), {
  region: "sultanahmet-eminonu", availableMinutes: 240, interests: ["history"], selectedActivities: [], walkingPreference: "low",
});

async function run() {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ success: true, regions: [{ id: "sultanahmet-eminonu" }] }) };
  };
  try {
    await client.getRegions();
    await client.getActivityPlaces("sultanahmet-eminonu");
    await client.interpretPlannerText("Sultanahmet'ta 4 saatim var", { lat: 41.0056, lng: 28.9769 });
    await client.planTrip(request);
    assert.ok(calls[0].url.endsWith("/api/regions"));
    assert.ok(calls[1].url.endsWith("/api/regions/sultanahmet-eminonu/activities"));
    assert.ok(calls[2].url.endsWith("/api/planner/interpret"));
    assert.deepEqual(JSON.parse(calls[2].options.body), { text: "Sultanahmet'ta 4 saatim var", startLocation: { lat: 41.0056, lng: 28.9769 } });
    assert.equal(calls[3].options.method, "POST");
    assert.deepEqual(JSON.parse(calls[3].options.body), request);
    console.log(JSON.stringify({ request, apiCalls: calls.length, warnings: [warningText("UNKNOWN_COST"), warningText("ACTIVITY_SELECTION_REQUIRED")] }));
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
