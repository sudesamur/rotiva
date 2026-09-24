"use strict";

const { intentSchema } = require("./llm-provider");

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_MS = 8000;
const INSTRUCTIONS = "You extract planner intent only. Do not recommend places or routes. Do not invent coordinates, prices, durations, opening hours, canonical IDs, regions, interests, or activities. Return null for information not explicitly present. Use only the supplied supported regions and interests. requestedActivities must contain only raw placeQuery and activityQuery text from the user.";

function providerError(code) { const error = new Error(code); error.code = code; return error; }

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const content = response.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text");
  return content?.text || null;
}

function createOpenAIProvider(options = {}) {
  const apiKey = Object.prototype.hasOwnProperty.call(options, "apiKey") ? options.apiKey : process.env.OPENAI_API_KEY;
  const model = options.model || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  return {
    name: "openai", model,
    async extractIntent(text, context) {
      if (!apiKey) throw providerError("LLM_API_KEY_MISSING");
      if (typeof fetchImpl !== "function") throw providerError("LLM_FETCH_UNAVAILABLE");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(OPENAI_RESPONSES_URL, {
          method: "POST", signal: controller.signal,
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ model, store: false, instructions: INSTRUCTIONS, input: text, max_output_tokens: 500, text: { format: { type: "json_schema", name: "planner_intent", strict: true, schema: intentSchema(context) } } }),
        });
        if (!response.ok) throw providerError("LLM_PROVIDER_ERROR");
        const body = await response.json();
        if (body.status && body.status !== "completed") throw providerError("LLM_INCOMPLETE_RESPONSE");
        const raw = outputText(body);
        if (!raw) throw providerError("LLM_INVALID_RESPONSE");
        try { return JSON.parse(raw); } catch { throw providerError("LLM_INVALID_JSON"); }
      } catch (error) {
        if (error?.name === "AbortError") throw providerError("LLM_TIMEOUT");
        throw error;
      } finally { clearTimeout(timeout); }
    },
  };
}

module.exports = { DEFAULT_OPENAI_MODEL, DEFAULT_TIMEOUT_MS, INSTRUCTIONS, OPENAI_RESPONSES_URL, createOpenAIProvider };
