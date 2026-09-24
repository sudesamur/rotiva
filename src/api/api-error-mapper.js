"use strict";

const ERROR_STATUS = Object.freeze({
  INVALID_PLANNER_REQUEST: 400,
  INVALID_INTENT_REQUEST: 400,
  INVALID_JSON: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNKNOWN_REGION: 404,
  UNKNOWN_PLACE: 404,
  UNKNOWN_ACTIVITY: 404,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
});

const ERROR_MESSAGES = Object.freeze({
  INVALID_PLANNER_REQUEST: "Planner isteği geçersiz.",
  INVALID_INTENT_REQUEST: "Doğal dil isteği geçersiz.",
  INVALID_JSON: "JSON gövdesi geçersiz.",
  PAYLOAD_TOO_LARGE: "İstek gövdesi izin verilen boyutu aşıyor.",
  UNKNOWN_REGION: "İstenen bölge bulunamadı.",
  UNKNOWN_PLACE: "İstenen mekan bu bölgede bulunamadı.",
  UNKNOWN_ACTIVITY: "İstenen aktivite bu bölgede bulunamadı.",
  NOT_FOUND: "Endpoint bulunamadı.",
  METHOD_NOT_ALLOWED: "HTTP metodu desteklenmiyor.",
  INTERNAL_SERVER_ERROR: "Beklenmeyen bir sunucu hatası oluştu.",
});

function statusForError(code) {
  return ERROR_STATUS[code] || 500;
}

function apiError(error) {
  const code = error?.code || "INTERNAL_SERVER_ERROR";
  return {
    success: false,
    error: {
      code,
      message: ERROR_MESSAGES[code] || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      fields: error?.fields || [],
    },
  };
}

module.exports = { apiError, statusForError };
