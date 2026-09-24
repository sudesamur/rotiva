"use strict";

const assert = require("node:assert/strict");
const {
  buildIntentContext,
  validateProviderIntent,
} = require("../src/ai/providers/llm-provider");
const { createGeminiProvider } = require("../src/ai/providers/gemini-provider");
const { createOpenAIProvider } = require("../src/ai/providers/openai-provider");
const { interpretPlannerText } = require("../src/ai/planner-intent-service");
const { REGION_DATASETS } = require("../src/planner/region-datasets");

const context = buildIntentContext(REGION_DATASETS);
const validIntent = {
  region: "sultanahmet-eminonu",
  availableMinutes: 240,
  budgetTRY: null,
  interests: ["history", "museum"],
  walkingPreference: "low",
  plannedStartTime: null,
  requestedActivities: [{ placeQuery: "Topkapı", activityQuery: "Harem" }],
  ambiguities: [],
};

async function run() {
  assert.equal(validateProviderIntent(validIntent, context).valid, true);
  assert.equal(
    validateProviderIntent({ ...validIntent, inventedPlaceId: "x" }, context)
      .valid,
    false,
  );
  assert.equal(
    validateProviderIntent({ ...validIntent, region: "besiktas" }, context)
      .valid,
    false,
  );
  const duplicateInterests = validateProviderIntent(
    { ...validIntent, interests: ["history", "museum", "history"] },
    context,
  );
  assert.deepEqual(duplicateInterests.value.interests, ["history", "museum"]);
  assert.equal(validIntent.budgetTRY, null);
  assert.equal(validIntent.plannedStartTime, null);

  let requestedBody;
  const savedApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  const provider = createOpenAIProvider({
    model: "test-model",
    fetchImpl: async (_url, request) => {
      requestedBody = JSON.parse(request.body);
      return {
        ok: true,
        json: async () => ({
          status: "completed",
          output_text: JSON.stringify(validIntent),
        }),
      };
    },
  });
  const raw = await provider.extractIntent("test", context);
  if (savedApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedApiKey;
  assert.deepEqual(raw, validIntent);
  assert.equal(requestedBody.store, false);
  assert.equal(requestedBody.text.format.type, "json_schema");
  assert.equal(requestedBody.text.format.strict, true);
  assert.equal(
    requestedBody.text.format.schema.properties.interests.uniqueItems,
    undefined,
  );
  assert.equal(
    requestedBody.text.format.schema.properties.ambiguities.uniqueItems,
    undefined,
  );

  const llm = await interpretPlannerText("Serbest metin", {
    parserMode: "llm",
    startLocation: { lat: 41.0056, lng: 28.9769 },
    provider: {
      name: "mock",
      model: "mock-1",
      extractIntent: async () => validIntent,
    },
  });
  assert.equal(llm.parserMetadata.mode, "llm");
  assert.deepEqual(llm.resolvedActivities, [
    { placeId: "topkapi-palace", activityId: "harem-bölümü-gezisi" },
  ]);
  assert.equal(llm.intent.budgetTRY, null);

  const invalid = await interpretPlannerText("Sultanahmet'ta 4 saatim var", {
    parserMode: "llm",
    provider: {
      name: "mock",
      extractIntent: async () => ({ ...validIntent, extra: true }),
    },
  });
  assert.equal(invalid.parserMetadata.mode, "rule_based_fallback");
  assert.equal(invalid.parserMetadata.fallbackUsed, true);
  assert.equal(invalid.intent.region, "sultanahmet-eminonu");

  const missingKey = await interpretPlannerText("Sultanahmet'ta 4 saatim var", {
    parserMode: "llm",
    openai: { apiKey: "" },
  });
  assert.equal(missingKey.parserMetadata.mode, "rule_based_fallback");
  assert.equal(missingKey.parserMetadata.fallbackReason, "LLM_API_KEY_MISSING");

  const geminiSavedApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-gemini-key";
  let geminiRequestBody;
  const geminiProvider = createGeminiProvider({
    model: "gemini-test-model",
    fetchImpl: async (_url, request) => {
      geminiRequestBody = JSON.parse(request.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(validIntent) }] } },
          ],
        }),
      };
    },
  });
  const geminiRaw = await geminiProvider.extractIntent("test", context);
  if (geminiSavedApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = geminiSavedApiKey;
  assert.deepEqual(geminiRaw, validIntent);
  assert.equal(geminiRequestBody.contents[0].parts[0].text, "test");
  assert.ok(geminiRequestBody.systemInstruction);

  const geminiErrorProvider = createGeminiProvider({
    model: "gemini-test-model",
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () =>
        JSON.stringify({
          error: {
            status: "INVALID_ARGUMENT",
            code: 400,
            message: "API key is invalid AIza...",
            details: [{ message: "bad request" }],
          },
        }),
    }),
  });

  try {
    await geminiErrorProvider.extractIntent("test", context);
    assert.fail("Expected Gemini provider to throw when its API key is unavailable");
  } catch (error) {
    assert.equal(error.code, "LLM_API_KEY_MISSING");
  }

  const geminiIntent = await interpretPlannerText("Serbest metin", {
    parserMode: "llm",
    startLocation: { lat: 41.0056, lng: 28.9769 },
    providerType: "gemini",
    gemini: {
      apiKey: "test-gemini-key",
      model: "gemini-test-model",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(validIntent) }] } },
          ],
        }),
      }),
    },
  });
  assert.equal(geminiIntent.parserMetadata.mode, "llm");
  assert.equal(geminiIntent.parserMetadata.provider, "gemini");
  assert.equal(geminiIntent.parserMetadata.fallbackUsed, false);

  const timeout = await interpretPlannerText("Sultanahmet'ta 4 saatim var", {
    parserMode: "llm",
    provider: {
      name: "mock",
      extractIntent: async () => {
        const error = new Error();
        error.code = "LLM_TIMEOUT";
        throw error;
      },
    },
  });
  assert.equal(timeout.parserMetadata.mode, "rule_based_fallback");
  assert.equal(timeout.parserMetadata.fallbackReason, "LLM_TIMEOUT");

  const rule = await interpretPlannerText("Sultanahmet'ta 4 saatim var", {
    parserMode: "rule_based",
  });
  assert.equal(rule.parserMetadata.mode, "rule_based");
  assert.equal(rule.intent.availableMinutes, 240);
  console.log(
    JSON.stringify({
      llm: llm.parserMetadata,
      fallback: timeout.parserMetadata,
      rule: rule.parserMetadata,
    }),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
