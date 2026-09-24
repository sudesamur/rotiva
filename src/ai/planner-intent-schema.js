"use strict";

const FIELD_SOURCES = Object.freeze({ user: "user", resolved: "resolved", default: "default", missing: "missing" });

function emptyIntent() {
  return {
    region: null,
    availableMinutes: null,
    budgetTRY: null,
    interests: [],
    walkingPreference: null,
    plannedStartTime: null,
    requestedActivities: [],
    ambiguities: [],
  };
}

module.exports = { FIELD_SOURCES, emptyIntent };
