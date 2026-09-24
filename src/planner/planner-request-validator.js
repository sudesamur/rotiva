"use strict";

const WALKING_PREFERENCES = new Set(["low", "normal", "high"]);
const START_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validCoordinates(location) {
  return Boolean(location && Number.isFinite(location.lat) && Number.isFinite(location.lng) &&
    location.lat >= -90 && location.lat <= 90 && location.lng >= -180 && location.lng <= 180);
}

function invalid(field, reason) {
  return { field, reason };
}

function validatePlannerRequest(request) {
  const fields = [];
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return { valid: false, fields: [invalid("request", "must_be_object")] };
  }
  if (typeof request.region !== "string" || request.region.trim() === "") fields.push(invalid("region", "required"));
  if (!Number.isFinite(request.availableMinutes) || request.availableMinutes <= 0) fields.push(invalid("availableMinutes", "must_be_positive"));
  if (request.budgetTRY !== undefined && request.budgetTRY !== null && (!Number.isFinite(request.budgetTRY) || request.budgetTRY < 0)) fields.push(invalid("budgetTRY", "must_be_non_negative"));
  if (!validCoordinates(request.startLocation)) fields.push(invalid("startLocation", "must_contain_valid_coordinates"));
  if (request.interests !== undefined && !Array.isArray(request.interests)) fields.push(invalid("interests", "must_be_array"));
  if (Array.isArray(request.interests) && request.interests.some((interest) => typeof interest !== "string" || interest.trim() === "")) fields.push(invalid("interests", "must_contain_non_empty_strings"));
  if (request.walkingPreference !== undefined && !WALKING_PREFERENCES.has(request.walkingPreference)) fields.push(invalid("walkingPreference", "unsupported_value"));
  if (request.plannedStartTime !== undefined && !START_TIME_PATTERN.test(request.plannedStartTime)) fields.push(invalid("plannedStartTime", "must_use_HH_MM_format"));
  if (request.weather !== undefined && (request.weather === null || typeof request.weather !== "object" || typeof request.weather.condition !== "string")) fields.push(invalid("weather", "must_contain_condition"));
  if (request.selectedActivities !== undefined && !Array.isArray(request.selectedActivities)) fields.push(invalid("selectedActivities", "must_be_array"));
  if (Array.isArray(request.selectedActivities)) {
    request.selectedActivities.forEach((selection, index) => {
      if (!selection || typeof selection.placeId !== "string" || selection.placeId === "" || typeof selection.activityId !== "string" || selection.activityId === "") {
        fields.push(invalid(`selectedActivities[${index}]`, "must_contain_placeId_and_activityId"));
      }
    });
  }
  return { valid: fields.length === 0, fields };
}

module.exports = { WALKING_PREFERENCES, validatePlannerRequest, validCoordinates };
