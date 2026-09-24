"use strict";

const { FIELD_SOURCES } = require("./planner-intent-schema");
const { resolveRequestedActivities } = require("./activity-intent-resolver");
const { validatePlannerRequest } = require("../planner/planner-request-validator");

function buildPlannerRequest(intent, options = {}) {
  const activityResolution = resolveRequestedActivities(intent.region, intent.requestedActivities, options.datasets);
  const fieldSources = {
    region: intent.region ? FIELD_SOURCES.user : FIELD_SOURCES.missing,
    availableMinutes: intent.availableMinutes === null ? FIELD_SOURCES.missing : FIELD_SOURCES.user,
    budgetTRY: intent.budgetTRY === null ? FIELD_SOURCES.missing : FIELD_SOURCES.user,
    interests: intent.interests.length ? FIELD_SOURCES.user : FIELD_SOURCES.missing,
    walkingPreference: intent.walkingPreference ? FIELD_SOURCES.user : FIELD_SOURCES.missing,
    plannedStartTime: intent.plannedStartTime ? FIELD_SOURCES.user : FIELD_SOURCES.missing,
    startLocation: options.startLocation ? (options.startLocationSource || FIELD_SOURCES.default) : FIELD_SOURCES.missing,
    selectedActivities: activityResolution.selectedActivities.length ? FIELD_SOURCES.resolved : FIELD_SOURCES.missing,
  };
  const missingFields = [];
  if (!intent.region) missingFields.push("region");
  if (intent.availableMinutes === null) missingFields.push("availableMinutes");
  if (!options.startLocation) missingFields.push("startLocation");
  const ambiguities = [...intent.ambiguities, ...activityResolution.ambiguities];
  if (missingFields.length || ambiguities.length) return { success: false, needsClarification: true, missingFields, ambiguities, fieldSources, resolvedActivities: activityResolution.selectedActivities };
  const request = {
    region: intent.region, availableMinutes: intent.availableMinutes, interests: intent.interests,
    startLocation: options.startLocation, selectedActivities: activityResolution.selectedActivities,
  };
  if (intent.budgetTRY !== null) request.budgetTRY = intent.budgetTRY;
  if (intent.walkingPreference) request.walkingPreference = intent.walkingPreference;
  if (intent.plannedStartTime) request.plannedStartTime = intent.plannedStartTime;
  const validation = validatePlannerRequest(request);
  if (!validation.valid) return { success: false, needsClarification: true, missingFields: validation.fields.map((field) => field.field), ambiguities, fieldSources, resolvedActivities: activityResolution.selectedActivities };
  return { success: true, request, fieldSources, resolvedActivities: activityResolution.selectedActivities, ambiguities };
}

module.exports = { buildPlannerRequest };
