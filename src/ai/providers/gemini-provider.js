"use strict";

const { intentSchema } = require("./llm-provider");

const GEMINI_GENERATE_CONTENT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_TIMEOUT_MS = 8000;
const INSTRUCTIONS =
  "You extract planner intent only. Do not recommend places or routes. Do not invent coordinates, prices, durations, opening hours, canonical IDs, regions, interests, or activities. Return null for information not explicitly present. Use only the supplied supported regions and interests. requestedActivities must contain only raw placeQuery and activityQuery text from the user. Respond with valid JSON matching the schema exactly.";

function providerError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  Object.entries(details).forEach(([key, value]) => {
    error[key] = value;
  });
  return error;
}

function sanitizeGeminiMessage(message) {
  return String(message).replace(/AIza[0-9A-Za-z\-_]*/g, "[REDACTED_API_KEY]");
}

function extractGeminiErrorDetails(rawBody, response) {
  const preview = String(rawBody || "").slice(0, 1500);
  if (!rawBody) {
    return {
      httpStatus: response?.status ?? null,
      httpStatusText: response?.statusText ?? null,
      responseBodyPreview: preview,
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  const error = parsed && parsed.error ? parsed.error : null;

  return {
    httpStatus: response?.status ?? null,
    httpStatusText: response?.statusText ?? null,
    geminiErrorStatus: error?.status ?? null,
    geminiErrorCode: error?.code ?? null,
    sanitizedMessage: error?.message
      ? sanitizeGeminiMessage(error.message)
      : null,
    safeErrorDetails: error?.details ?? null,
    responseBodyPreview: preview,
  };
}

function normalizeJsonText(raw) {
  return String(raw || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractText(response) {
  const candidates = response?.candidates || [];
  const firstCandidate = candidates[0] || null;
  if (!firstCandidate) return null;
  const parts = firstCandidate.content?.parts || [];
  const textPart = parts.find(
    (part) => typeof part?.text === "string" && part.text.trim() !== "",
  );
  return textPart ? textPart.text : null;
}

function createGeminiProvider(options = {}) {
  const apiKey = Object.prototype.hasOwnProperty.call(options, "apiKey")
    ? options.apiKey
    : process.env.GEMINI_API_KEY;
  const model =
    options.model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  return {
    name: "gemini",
    model,
    async extractIntent(text, context) {
      if (!apiKey) throw providerError("LLM_API_KEY_MISSING");
      if (typeof fetchImpl !== "function")
        throw providerError("LLM_FETCH_UNAVAILABLE");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = `${GEMINI_GENERATE_CONTENT_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetchImpl(url, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: intentSchema(context),
              temperature: 0,
              topP: 0.9,
            },
          }),
        });

        if (!response.ok) {
          const rawBody = await response.text();
          throw providerError(
            "LLM_PROVIDER_ERROR",
            extractGeminiErrorDetails(rawBody, response),
          );
        }
        const body = await response.json();
        const raw = normalizeJsonText(extractText(body));
        if (!raw) throw providerError("LLM_INVALID_RESPONSE");

        try {
          return JSON.parse(raw);
        } catch {
          throw providerError("LLM_INVALID_JSON");
        }
      } catch (error) {
        if (error?.name === "AbortError") throw providerError("LLM_TIMEOUT");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_TIMEOUT_MS,
  GEMINI_GENERATE_CONTENT_URL,
  INSTRUCTIONS,
  createGeminiProvider,
};
