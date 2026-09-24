(function () {
  "use strict";
  const { PlannerClient, PlannerUi } = window;
  const form = document.querySelector("#planner-form");
  const regionSelect = document.querySelector("#region");
  const interestOptions = document.querySelector("#interest-options");
  const activitySection = document.querySelector("#activity-selector");
  const activityOptions = document.querySelector("#activity-options");
  const result = document.querySelector("#result");
  const button = document.querySelector("#plan-button");
  const formError = document.querySelector("#form-error");
  const plannerText = document.querySelector("#planner-text");
  const interpretButton = document.querySelector("#interpret-button");
  const interpretFeedback = document.querySelector("#interpret-feedback");

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function setError(message) {
    formError.hidden = !message;
    formError.textContent = message || "";
  }

  function setInterpretFeedback(content) {
    interpretFeedback.hidden = !content;
    interpretFeedback.innerHTML = content || "";
  }

  function selectedInterests() {
    return [...interestOptions.querySelectorAll("input:checked")].map((input) => input.value);
  }

  function selectedActivities() {
    return [...activityOptions.querySelectorAll("input:checked")].map((input) => ({ placeId: input.dataset.placeId, activityId: input.value }));
  }

  function renderInterests() {
    interestOptions.innerHTML = PlannerUi.INTEREST_OPTIONS.map(([value, label]) => `<label class="chip"><input type="checkbox" value="${value}" ${["history", "museum", "culture"].includes(value) ? "checked" : ""} />${label}</label>`).join("");
  }

  function activityCost(activity) {
    if (Number.isFinite(activity.cost.costTRY)) return `${activity.cost.costTRY} TL`;
    if (Number.isFinite(activity.cost.costMinTRY) && Number.isFinite(activity.cost.costMaxTRY)) return `${activity.cost.costMinTRY}–${activity.cost.costMaxTRY} TL`;
    return "Maliyet bilinmiyor";
  }

  async function loadActivities() {
    activitySection.hidden = true;
    activityOptions.innerHTML = "";
    if (!regionSelect.value) return;
    try {
      const response = await PlannerClient.getActivityPlaces(regionSelect.value);
      if (response.places.length === 0) return;
      activityOptions.innerHTML = response.places.map((place) => `<section class="activity-place"><p class="activity-place-name">${escapeHtml(place.name)}</p>${place.activities.map((activity) => `<label class="activity-choice"><input type="checkbox" data-place-id="${escapeHtml(place.id)}" value="${escapeHtml(activity.activityId)}" /><span class="activity-choice-content"><strong>${escapeHtml(activity.name)}</strong><span>${activity.durationMinutes ?? "Süre bilinmiyor"}${activity.durationMinutes != null ? " dk" : ""} · ${activityCost(activity)}</span></span></label>`).join("")}</section>`).join("");
      activitySection.hidden = false;
    } catch (error) {
      setError(error.message);
    }
  }

  function costText(cost) {
    if (cost.type === "unknownCost") return "Maliyet bilinmiyor";
    if (cost.rangeTRY?.min === cost.rangeTRY?.max) return `${cost.rangeTRY.min} TL`;
    if (cost.rangeTRY) return `${cost.rangeTRY.min}–${cost.rangeTRY.max} TL`;
    return "Maliyet belirsiz";
  }

  function renderResult(response) {
    if (response.itinerary.length === 0) {
      result.innerHTML = "<p class=\"empty-state\">Verilen süre ve kısıtlarla uygun rota oluşturulamadı.</p>";
      return;
    }
    const summary = response.summary;
    const warnings = (response.warnings || []).map((warning) => `<li>${escapeHtml(PlannerUi.warningText(warning.code))}</li>`).join("");
    const metric = (value, label) => `<div class="metric"><strong>${escapeHtml(value ?? "Bilinmiyor")}</strong><span>${escapeHtml(label)}</span></div>`;
    const costStatus = summary.unknownCostCount > 0 ? `${summary.unknownCostCount} maliyet bilinmiyor` : (summary.knownCostTRY != null ? `${summary.knownCostTRY} TL` : "Bilinmiyor");
    const stops = response.itinerary.map((stop) => { const timing = stop.arrivalTime && stop.departureTime ? `${stop.arrivalTime} – ${stop.departureTime}` : "Saat bilgisi bilinmiyor"; const visit = stop.visitMinutes != null ? `${stop.visitMinutes} dk ziyaret` : "Ziyaret süresi bilinmiyor"; const walk = stop.walkingMinutesFromPrevious != null ? `${stop.walkingMinutesFromPrevious} dk yürüyüş` : "Yürüyüş bilgisi bilinmiyor"; const reasons = (stop.selectionReasons || []).map((reason) => `<li>${escapeHtml(PlannerUi.reasonText(reason))}</li>`).join(""); const notices = [stop.scheduleEligible === null ? "Açık saat bilgisi doğrulanmamış." : "", stop.cost?.type === "unknownCost" ? "Maliyet bilgisi bilinmiyor." : ""].filter(Boolean).map((text) => `<span>${text}</span>`).join(""); return `<article class="stop"><span class="stop-order">${stop.order}</span><div class="stop-content"><div class="stop-title"><p class="stop-category">${escapeHtml(stop.category || "Kategori bilinmiyor")}</p><h3>${escapeHtml(stop.placeName)}</h3>${stop.activityName ? `<p class="activity-name">${escapeHtml(stop.activityName)}</p>` : ""}</div><div class="stop-meta"><span>${escapeHtml(timing)}</span><span>${escapeHtml(visit)}</span><span>${escapeHtml(walk)}</span><span>${escapeHtml(costText(stop.cost || {}))}</span></div>${notices ? `<div class="stop-notices">${notices}</div>` : ""}${reasons ? `<details><summary>Neden önerildi?</summary><ul>${reasons}</ul></details>` : ""}</div></article>`; }).join("");
    result.innerHTML = `<section class="summary"><div class="result-heading"><div><p class="section-kicker">Günlük planın</p><h2>Rota özeti</h2></div><span class="score-badge">Skor ${escapeHtml(summary.routeScore ?? "Bilinmiyor")}</span></div><div class="summary-grid">${metric(summary.stopCount != null ? `${summary.stopCount} durak` : null, "Durak")}${metric(summary.totalDistanceKm != null ? `${summary.totalDistanceKm} km` : null, "Yürüme mesafesi")}${metric(summary.totalWalkingMinutes != null ? `${summary.totalWalkingMinutes} dk` : null, "Yürüme süresi")}${metric(summary.totalVisitMinutes != null ? `${summary.totalVisitMinutes} dk` : null, "Ziyaret süresi")}${metric(summary.remainingMinutes != null ? `${summary.remainingMinutes} dk` : null, "Kalan süre")}${metric(costStatus, "Maliyet durumu")}</div></section>${warnings ? `<section class="warnings"><div><p class="section-kicker">Bilgi</p><h2>Plan notları</h2></div><ul>${warnings}</ul></section>` : ""}<section class="stops"><div class="stops-heading"><p class="section-kicker">Duraklar</p><h2>Günün rotası</h2></div>${stops}</section>`;
  }

  async function loadRegions() {
    const response = await PlannerClient.getRegions();
    regionSelect.innerHTML = response.regions.map((region) => `<option value="${escapeHtml(region.id)}">${escapeHtml(region.name)}</option>`).join("");
    const demo = response.regions.find((region) => region.id === "sultanahmet-eminonu");
    regionSelect.value = (demo || response.regions[0]).id;
    await loadActivities();
  }

  function startLocationFromForm() {
    return { lat: Number(document.querySelector("#startLat").value), lng: Number(document.querySelector("#startLng").value) };
  }

  function clarificationLabel(field) {
    return ({ region: "Bölge", availableMinutes: "Gezi süresi", startLocation: "Başlangıç konumu" })[field] || field;
  }

  function ambiguityLabel(value) {
    return ({ unsupported_region: "Yazdığınız bölge henüz desteklenmiyor.", ambiguous_start_time: "Başlangıç saati kesin değil.", activity_not_found: "İstenen aktivite bulunamadı.", activity_ambiguous: "İstenen aktivite birden fazla sonuçla eşleşiyor." })[value] || value;
  }

  async function applyInterpretation(response) {
    const values = PlannerUi.interpretedFormValues(response.intent);
    if (values.region && [...regionSelect.options].some((option) => option.value === values.region)) regionSelect.value = values.region;
    if (Object.hasOwn(values, "availableMinutes")) document.querySelector("#availableMinutes").value = values.availableMinutes;
    if (Object.hasOwn(values, "budgetTRY")) document.querySelector("#budgetTRY").value = values.budgetTRY;
    if (Object.hasOwn(values, "walkingPreference")) document.querySelector("#walkingPreference").value = values.walkingPreference;
    if (Object.hasOwn(values, "plannedStartTime")) document.querySelector("#plannedStartTime").value = values.plannedStartTime;
    [...interestOptions.querySelectorAll("input")].forEach((input) => { input.checked = values.interests.includes(input.value); });
    await loadActivities();
    const selected = new Set(response.resolvedActivities.map((item) => `${item.placeId}:${item.activityId}`));
    [...activityOptions.querySelectorAll("input")].forEach((input) => { input.checked = selected.has(`${input.dataset.placeId}:${input.value}`); });
    const messages = [];
    if (response.missingFields.length) messages.push(`Eksik bilgi: ${response.missingFields.map(clarificationLabel).join(", ")}.`);
    response.ambiguities.forEach((ambiguity) => messages.push(ambiguityLabel(ambiguity)));
    if (!messages.length) messages.push("Yorumlanan bilgiler forma aktarıldı. İsterseniz alanları düzenleyip plan oluşturabilirsiniz.");
    setInterpretFeedback(messages.map((message) => `<p>${escapeHtml(message)}</p>`).join(""));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    const data = new FormData(form);
    const request = PlannerUi.buildPlannerRequest({
      region: data.get("region"), availableMinutes: data.get("availableMinutes"), budgetTRY: data.get("budgetTRY"),
      interests: selectedInterests(), walkingPreference: data.get("walkingPreference"), plannedStartTime: data.get("plannedStartTime"),
      weather: document.querySelector("#weather").value, startLat: document.querySelector("#startLat").value,
      startLng: document.querySelector("#startLng").value, selectedActivities: selectedActivities(),
    });
    button.disabled = true;
    button.textContent = "Plan hazırlanıyor…";
    try {
      renderResult(await PlannerClient.planTrip(request));
    } catch (error) {
      setError(error.code === "UNKNOWN_ACTIVITY" ? "Seçilen aktivite artık mevcut değil." : error.message);
    } finally {
      button.disabled = false;
      button.textContent = "Plan oluştur";
    }
  });

  interpretButton.addEventListener("click", async () => {
    setError("");
    if (!plannerText.value.trim()) {
      setInterpretFeedback("<p>Lütfen gezi isteğinizi yazın.</p>");
      return;
    }
    interpretButton.disabled = true;
    interpretButton.textContent = "Yorumlanıyor…";
    try {
      await applyInterpretation(await PlannerClient.interpretPlannerText(plannerText.value, startLocationFromForm()));
    } catch (error) {
      setInterpretFeedback(`<p>${escapeHtml(error.message)}</p>`);
    } finally {
      interpretButton.disabled = false;
      interpretButton.textContent = "Metni Yorumla";
    }
  });

  regionSelect.addEventListener("change", loadActivities);
  renderInterests();
  loadRegions().catch((error) => setError(error.message));
}());
