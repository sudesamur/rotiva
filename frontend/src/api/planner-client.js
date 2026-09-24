(function (global) {
  "use strict";
  const fallbackBaseUrl = "http://127.0.0.1:3000";
  function apiBaseUrl() {
    return global.PLANNER_API_BASE_URL || fallbackBaseUrl;
  }
  async function request(path, options) {
    const response = await fetch(`${apiBaseUrl()}${path}`, options);
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      const error = new Error(payload.error?.message || "İstek tamamlanamadı.");
      error.code = payload.error?.code;
      error.fields = payload.error?.fields || [];
      throw error;
    }
    return payload;
  }
  const client = {
    getRegions: () => request("/api/regions"),
    getActivityPlaces: (region) => request(`/api/regions/${encodeURIComponent(region)}/activities`),
    interpretPlannerText: (text, startLocation) => request("/api/planner/interpret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, startLocation }),
    }),
    planTrip: (plannerRequest) => request("/api/planner/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(plannerRequest),
    }),
  };
  global.PlannerClient = client;
  if (typeof module !== "undefined") module.exports = { apiBaseUrl, client };
}(typeof window !== "undefined" ? window : globalThis));
