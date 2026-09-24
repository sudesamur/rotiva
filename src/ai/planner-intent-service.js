"use strict";

const { parsePlannerIntent } = require("./planner-intent-parser");
const { buildPlannerRequest } = require("./planner-request-builder");
const { REGION_DATASETS } = require("../planner/region-datasets");
const {
  PARSER_MODES,
  buildIntentContext,
  validateProviderIntent,
} = require("./providers/llm-provider");
const { createGeminiProvider } = require("./providers/gemini-provider");
const { createOpenAIProvider } = require("./providers/openai-provider");

function validMode(mode) {
  return Object.values(PARSER_MODES).includes(mode);
}

async function interpretPlannerText(text, options = {}) {
  const datasets = options.datasets || REGION_DATASETS;
  const parserMode = options.parserMode || PARSER_MODES.RULE_BASED;
  if (!validMode(parserMode)) {
    const error = new Error("INVALID_INTENT_REQUEST");
    error.code = "INVALID_INTENT_REQUEST";
    throw error;
  }
  const ruleIntent = parsePlannerIntent(text, datasets);
  let intent = ruleIntent;
  let parserMetadata = {
    mode: PARSER_MODES.RULE_BASED,
    provider: null,
    fallbackUsed: false,
  };
  const shouldUseLlm =
    parserMode === PARSER_MODES.LLM ||
    (parserMode === PARSER_MODES.HYBRID &&
      (!ruleIntent.region ||
        ruleIntent.availableMinutes === null ||
        ruleIntent.ambiguities.length));
  if (shouldUseLlm) {
    const providerName =
      options.provider?.name || options.providerType || "openai";
    const provider =
      options.provider ||
      (providerName === "gemini"
        ? createGeminiProvider(options.gemini || {})
        : createOpenAIProvider(options.openai || {}));
    try {
      const rawIntent = await provider.extractIntent(
        text,
        buildIntentContext(datasets),
      );
      const validation = validateProviderIntent(
        rawIntent,
        buildIntentContext(datasets),
      );
      if (!validation.valid) {
        const error = new Error(validation.reason);
        error.code = "LLM_INVALID_SCHEMA";
        throw error;
      }
      intent = validation.value;
      parserMetadata = {
        mode: parserMode === PARSER_MODES.HYBRID ? "hybrid_llm" : "llm",
        provider: provider.name || providerName,
        model: provider.model || null,
        fallbackUsed: false,
      };
    } catch (error) {
      parserMetadata = {
        mode: "rule_based_fallback",
        provider: providerName,
        fallbackUsed: true,
        fallbackReason: error?.code || "LLM_PROVIDER_ERROR",
      };
    }
  } else if (parserMode === PARSER_MODES.HYBRID)
    parserMetadata = {
      mode: "hybrid_rule_based",
      provider: null,
      fallbackUsed: false,
    };
  const built = buildPlannerRequest(intent, {
    datasets,
    startLocation: options.startLocation,
    startLocationSource: options.startLocation ? "ui" : undefined,
  });
  return {
    success: true,
    intent,
    resolvedActivities: built.resolvedActivities,
    plannerRequest: built.request || null,
    fieldSources: built.fieldSources,
    needsClarification: !built.success,
    missingFields: built.missingFields || [],
    ambiguities: built.ambiguities || [],
    parserMetadata,
  };
}

module.exports = { interpretPlannerText, validMode };
