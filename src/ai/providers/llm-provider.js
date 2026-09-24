"use strict";

const PARSER_MODES = Object.freeze({ RULE_BASED: "rule_based", LLM: "llm", HYBRID: "hybrid" });
const WALKING_PREFERENCES = Object.freeze(["low", "normal", "high"]);
const SUPPORTED_INTERESTS = Object.freeze(["history", "museum", "culture", "coffee", "food", "nature", "shopping"]);

function intentSchema(context) {
  const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
  return {
    type: "object", additionalProperties: false,
    required: ["region", "availableMinutes", "budgetTRY", "interests", "walkingPreference", "plannedStartTime", "requestedActivities", "ambiguities"],
    properties: {
      region: nullable({ type: "string", enum: context.supportedRegions }),
      availableMinutes: nullable({ type: "integer", minimum: 1 }),
      budgetTRY: nullable({ type: "number", minimum: 0 }),
      interests: { type: "array", items: { type: "string", enum: context.supportedInterests } },
      walkingPreference: nullable({ type: "string", enum: WALKING_PREFERENCES }),
      plannedStartTime: nullable({ type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" }),
      requestedActivities: { type: "array", items: { type: "object", additionalProperties: false, required: ["placeQuery", "activityQuery"], properties: { placeQuery: { type: "string", minLength: 1 }, activityQuery: { type: "string", minLength: 1 } } } },
      ambiguities: { type: "array", items: { type: "string" } },
    },
  };
}

function buildIntentContext(datasets) {
  return { supportedRegions: Object.keys(datasets), supportedInterests: [...SUPPORTED_INTERESTS] };
}

function validateProviderIntent(value, context) {
  const schema = intentSchema(context);
  const fail = (reason) => ({ valid: false, reason });
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("intent_not_object");
  const keys = Object.keys(value);
  if (keys.length !== schema.required.length || keys.some((key) => !schema.required.includes(key))) return fail("unexpected_or_missing_fields");
  if (value.region !== null && !context.supportedRegions.includes(value.region)) return fail("unsupported_region");
  if (value.availableMinutes !== null && (!Number.isInteger(value.availableMinutes) || value.availableMinutes < 1)) return fail("invalid_available_minutes");
  if (value.budgetTRY !== null && (!Number.isFinite(value.budgetTRY) || value.budgetTRY < 0)) return fail("invalid_budget");
  if (!Array.isArray(value.interests) || value.interests.some((item) => !context.supportedInterests.includes(item))) return fail("unsupported_interest");
  if (value.walkingPreference !== null && !WALKING_PREFERENCES.includes(value.walkingPreference)) return fail("invalid_walking_preference");
  if (value.plannedStartTime !== null && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.plannedStartTime)) return fail("invalid_start_time");
  if (!Array.isArray(value.requestedActivities) || value.requestedActivities.some((item) => !item || typeof item !== "object" || Object.keys(item).length !== 2 || typeof item.placeQuery !== "string" || !item.placeQuery || typeof item.activityQuery !== "string" || !item.activityQuery)) return fail("invalid_requested_activities");
  if (!Array.isArray(value.ambiguities) || value.ambiguities.some((item) => typeof item !== "string")) return fail("invalid_ambiguities");
  return { valid: true, value: { ...value, interests: [...new Set(value.interests)] } };
}

module.exports = { PARSER_MODES, SUPPORTED_INTERESTS, WALKING_PREFERENCES, buildIntentContext, intentSchema, validateProviderIntent };
