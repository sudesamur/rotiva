(function (global) {
  "use strict";
  const INTEREST_OPTIONS = [
    ["history", "Tarih"], ["museum", "Müze"], ["culture", "Kültür"], ["coffee", "Kahve"],
    ["food", "Yemek"], ["nature", "Doğa"], ["shopping", "Alışveriş"],
  ];
  const WARNING_TEXT = {
    UNKNOWN_COST: "Bazı mekanların maliyet bilgisi bilinmiyor.",
    APPROXIMATE_COST: "Bazı maliyetler tahmini bir aralıkta.",
    UNKNOWN_OPENING_HOURS: "Bazı mekanların açık saat bilgisi doğrulanmamış.",
    ACTIVITY_SELECTION_REQUIRED: "Bazı mekanlar için ziyaret türü seçmeniz gerekiyor.",
  };
  const REASON_TEXT = {
    high_suitability_score: "Tercihlerinizle yüksek uyum gösteriyor.",
    close_to_previous_stop: "Önceki durağa yakın.",
    fits_remaining_time: "Kalan zamana sığıyor.",
    fits_remaining_budget: "Kalan bütçeye uyuyor.",
    adds_category_diversity: "Rotaya farklı bir kategori ekliyor.",
    matches_preferred_category: "Seçtiğiniz ilgi alanlarıyla eşleşiyor.",
  };
  function buildPlannerRequest(values) {
    const request = {
      region: values.region,
      availableMinutes: Number(values.availableMinutes),
      interests: values.interests,
      walkingPreference: values.walkingPreference,
      startLocation: { lat: Number(values.startLat), lng: Number(values.startLng) },
      plannedStartTime: values.plannedStartTime,
      weather: { condition: values.weather },
      selectedActivities: values.selectedActivities,
    };
    if (values.budgetTRY !== "" && values.budgetTRY !== null && values.budgetTRY !== undefined) request.budgetTRY = Number(values.budgetTRY);
    return request;
  }
  function warningText(code) { return WARNING_TEXT[code] || "Planla ilgili bir belirsizlik var."; }
  function reasonText(reason) { return REASON_TEXT[reason] || reason; }
  function interpretedFormValues(intent) {
    const values = { interests: intent.interests || [], selectedActivities: [] };
    ["region", "availableMinutes", "budgetTRY", "walkingPreference", "plannedStartTime"].forEach((field) => {
      if (intent[field] !== null && intent[field] !== undefined) values[field] = intent[field];
    });
    return values;
  }
  global.PlannerUi = { INTEREST_OPTIONS, buildPlannerRequest, interpretedFormValues, reasonText, warningText };
  if (typeof module !== "undefined") module.exports = { INTEREST_OPTIONS, buildPlannerRequest, interpretedFormValues, reasonText, warningText };
}(typeof window !== "undefined" ? window : globalThis));
