"use strict";

const { activityIdFor } = require("../route-engine/activity-candidate-adapter");
const { buildItinerary } = require("../route-engine/route-optimizer");
const { resolveRegionDataset, REGION_DATASETS } = require("./region-datasets");
const { validatePlannerRequest } = require("./planner-request-validator");

const DEFAULT_WALKING_PREFERENCE = "normal";
const DEFAULT_START_TIME = "10:00";

function failure(code, fields = []) {
  return { success: false, error: { code, fields } };
}

function availableActivitiesForPlace(place) {
  return (place.activities || []).map((activity) => ({
    activityId: activityIdFor(activity),
    name: activity.name,
    durationMinutes: Number.isFinite(activity.durationMinutes) ? activity.durationMinutes : null,
    cost: {
      costTRY: Number.isFinite(activity.costTRY) ? activity.costTRY : null,
      costMinTRY: Number.isFinite(activity.costMinTRY) ? activity.costMinTRY : null,
      costMaxTRY: Number.isFinite(activity.costMaxTRY) ? activity.costMaxTRY : null,
      costConfidence: activity.costConfidence || "unknown",
    },
  }));
}

function getAvailableActivities(region, placeId, datasets = REGION_DATASETS) {
  const places = resolveRegionDataset(region, datasets);
  if (!places) return failure("UNKNOWN_REGION", [{ field: "region", reason: "unknown_region" }]);
  const place = places.find((item) => item.id === placeId);
  if (!place) return failure("UNKNOWN_PLACE", [{ field: "placeId", reason: "not_found_in_region" }]);
  return {
    success: true,
    region,
    place: { id: place.id, name: place.name },
    activities: availableActivitiesForPlace(place),
  };
}

function getActivityPlaces(region, datasets = REGION_DATASETS) {
  const places = resolveRegionDataset(region, datasets);
  if (!places) return failure("UNKNOWN_REGION", [{ field: "region", reason: "unknown_region" }]);
  return {
    success: true,
    region,
    places: places
      .filter((place) => (place.activities || []).length > 1)
      .map((place) => ({ id: place.id, name: place.name, activities: availableActivitiesForPlace(place) })),
  };
}

function validateSelectedActivities(selectedActivities, places) {
  const fields = [];
  selectedActivities.forEach((selection, index) => {
    const place = places.find((item) => item.id === selection.placeId);
    if (!place) {
      fields.push({ field: `selectedActivities[${index}]`, reason: "place_not_found_in_region" });
      return;
    }
    if (!availableActivitiesForPlace(place).some((activity) => activity.activityId === selection.activityId)) {
      fields.push({ field: `selectedActivities[${index}]`, reason: "activity_not_found_for_place" });
    }
  });
  return fields;
}

function warning(code, fields) {
  return { code, ...fields };
}

function responseWarnings(route, places, selectedActivities) {
  const warnings = [];
  places
    .filter((place) => (place.activities || []).length > 1 && !selectedActivities.some((selection) => selection.placeId === place.id))
    .filter((place) => route.debug.notSelected.some((entry) => entry.placeId === place.id && entry.notSelectedReasons.includes("missing_visit_duration")))
    .forEach((place) => warnings.push(warning("ACTIVITY_SELECTION_REQUIRED", { placeId: place.id, message: "Çok aktiviteli mekan için aktivite seçimi gerekli." })));
  route.stops.filter((stop) => stop.costType === "unknownCost")
    .forEach((stop) => warnings.push(warning("UNKNOWN_COST", { placeId: stop.placeId, message: "Maliyet bilinmiyor; ücretsiz kabul edilmedi." })));
  route.stops.filter((stop) => stop.costType === "uncertainCost")
    .forEach((stop) => warnings.push(warning("APPROXIMATE_COST", { placeId: stop.placeId, message: "Maliyet aralık olarak biliniyor." })));
  route.stops.filter((stop) => stop.scheduleEligible === null)
    .forEach((stop) => warnings.push(warning("UNKNOWN_OPENING_HOURS", { placeId: stop.placeId, message: "Planlanan saatte açık olma durumu kesin değil." })));
  return warnings;
}

function itineraryStop(stop) {
  return {
    order: stop.order,
    placeId: stop.placeId,
    placeName: stop.placeName || stop.name,
    candidateType: stop.candidateType,
    activityId: stop.activityId,
    activityName: stop.activityName,
    category: stop.category,
    arrivalTime: stop.arrivalTime,
    departureTime: stop.departureTime,
    visitMinutes: stop.visitMinutes,
    distanceFromPreviousKm: stop.distanceFromPreviousKm,
    walkingMinutesFromPrevious: stop.travelMinutesFromPrevious,
    cost: { type: stop.costType, rangeTRY: stop.cost },
    scheduleEligible: stop.scheduleEligible,
    itineraryAutoEligible: stop.itineraryAutoEligible,
    selectionReasons: stop.selectionReasons,
    selectionBreakdown: stop.selectionBreakdown,
    interestMatch: stop.interestMatch,
    interestMatches: stop.interestMatches,
    unknownFactors: stop.unknownFactors,
  };
}

function planTrip(request, datasets = REGION_DATASETS) {
  const validation = validatePlannerRequest(request);
  if (!validation.valid) return failure("INVALID_PLANNER_REQUEST", validation.fields);
  const places = resolveRegionDataset(request.region, datasets);
  if (!places) return failure("UNKNOWN_REGION", [{ field: "region", reason: "unknown_region" }]);
  const selectedActivities = request.selectedActivities || [];
  const activityFields = validateSelectedActivities(selectedActivities, places);
  if (activityFields.length > 0) return failure("UNKNOWN_ACTIVITY", activityFields);

  const route = buildItinerary(places, {
    region: request.region,
    totalMinutes: request.availableMinutes,
    budgetTRY: Number.isFinite(request.budgetTRY) ? request.budgetTRY : undefined,
    interests: request.interests || [],
    walkingPreference: request.walkingPreference || DEFAULT_WALKING_PREFERENCE,
    startCoordinates: request.startLocation,
    currentCoordinates: request.startLocation,
    startTime: request.plannedStartTime || DEFAULT_START_TIME,
    weather: request.weather?.condition,
    selectedActivities,
  });
  return {
    success: true,
    requestSummary: {
      region: request.region,
      availableMinutes: request.availableMinutes,
      budgetTRY: Number.isFinite(request.budgetTRY) ? request.budgetTRY : null,
      budgetStatus: Number.isFinite(request.budgetTRY) ? "provided" : "unknown",
      interests: request.interests || [],
      walkingPreference: request.walkingPreference || DEFAULT_WALKING_PREFERENCE,
      selectedActivities,
    },
    itinerary: route.stops.map(itineraryStop),
    summary: {
      stopCount: route.stops.length,
      totalDistanceKm: route.summary.totalDistanceKm,
      totalWalkingMinutes: route.summary.totalTravelMinutes,
      totalVisitMinutes: route.summary.totalVisitMinutes,
      remainingMinutes: route.summary.remainingMinutes,
      knownCostTRY: route.summary.knownCostTRY,
      uncertainCostRange: route.summary.uncertainCostTRY,
      unknownCostCount: route.summary.unknownCostPlaceIds.length,
      routeScore: route.routeScore,
      categoryDiversityScore: route.summary.categoryDiversityScore,
    },
    warnings: responseWarnings(route, places, selectedActivities),
  };
}

module.exports = { getActivityPlaces, getAvailableActivities, planTrip, validateSelectedActivities };
