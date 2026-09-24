"use strict";

// Terms are intentionally limited to the vocabulary present in the normalized
// Istanbul seed datasets and the currently supported user-interest vocabulary.
const INTEREST_MATCH_SCORES = Object.freeze({
  exact: 100,
  family: 85,
  tagActivity: 70,
  none: 0,
});

const INTEREST_FAMILY_TERMS = Object.freeze({
  history: Object.freeze(["history", "historical", "historic", "tarih", "tarihi", "tarihi-yapı", "yerel-tarih", "palace", "saray", "archaeology", "archaeological", "arkeoloji"]),
  museum: Object.freeze(["museum", "müze", "art-museum", "city-museum", "literary-house-museum", "museum-campus", "museum-historic-site", "museum-landmark", "museum-viewpoint", "palace-museum"]),
  culture: Object.freeze(["culture", "cultural", "kültür", "kültür-sanat", "kültürel-miras", "art", "sanat", "art-center", "cultural-landmark", "performing-arts"]),
  coffee: Object.freeze(["coffee", "cafe", "kahve", "coffee-shop", "specialty-coffee", "coffee-bakery", "neighborhood-cafe", "view-cafe", "viewpoint-cafe"]),
  food: Object.freeze(["food", "restaurant", "dining", "cuisine", "yemek", "yeme-içme", "yerel-yemek", "street-food-restaurant", "turkish-restaurant", "historic-meyhane"]),
  nature: Object.freeze(["nature", "park", "garden", "waterfront", "green-space", "bahçe", "yeşil-alan", "açık-hava", "urban-garden", "park-viewpoint", "park-waterfront"]),
  shopping: Object.freeze(["shopping", "market", "bazaar", "çarşı", "alışveriş", "historic-market", "food-market-district"]),
  view: Object.freeze(["view", "viewpoint", "panorama", "scenic", "manzara", "museum-viewpoint", "park-viewpoint"]),
});

// A category can legitimately serve more than one user-intent family without
// changing its canonical category in the normalized data.
const CATEGORY_FAMILIES = Object.freeze({
  historical: Object.freeze(["history", "culture"]),
  palace: Object.freeze(["history", "culture"]),
  museum: Object.freeze(["museum", "history", "culture"]),
  cultural: Object.freeze(["culture"]),
  cafe: Object.freeze(["coffee"]),
  restaurant: Object.freeze(["food"]),
  park: Object.freeze(["nature"]),
  viewpoint: Object.freeze(["view"]),
});

function normalise(value) {
  return String(value || "").trim().toLocaleLowerCase("tr-TR").replace(/_/g, "-");
}

function familyForTerm(value) {
  const term = normalise(value);
  return Object.entries(INTEREST_FAMILY_TERMS)
    .filter(([, terms]) => terms.includes(term))
    .map(([family]) => family);
}

function activityTerms(place) {
  return (place.activities || []).flatMap((activity) => {
    if (typeof activity === "string") return [activity];
    return [activity.name, ...(activity.tags || [])];
  });
}

function matchCandidate({ type, matchedField, matchedValue, matchedInterest, interestMatchScore }) {
  return { interestMatchType: type, matchedInterest, matchedField, matchedValue, interestMatchScore };
}

function matchSingleInterest(place, interest) {
  const normalizedInterest = normalise(interest);
  const interestFamilies = familyForTerm(normalizedInterest);
  const category = normalise(place.category);
  const type = normalise(place.type);
  const categoryFields = [
    { field: "category", value: category },
    { field: "type", value: type },
  ];
  const exact = categoryFields.find(({ value }) => value === normalizedInterest);
  if (exact) return matchCandidate({ type: "exact", matchedField: exact.field, matchedValue: exact.value, matchedInterest: normalizedInterest, interestMatchScore: INTEREST_MATCH_SCORES.exact });

  const categoryFamilies = new Set([
    ...(CATEGORY_FAMILIES[category] || []),
    ...familyForTerm(type),
  ]);
  if (interestFamilies.some((family) => categoryFamilies.has(family))) {
    const matched = categoryFields.find(({ field, value }) => {
      const families = field === "category"
        ? (CATEGORY_FAMILIES[value] || [])
        : familyForTerm(value);
      return families.some((family) => interestFamilies.includes(family));
    });
    return matchCandidate({ type: "family", matchedField: matched.field, matchedValue: matched.value, matchedInterest: normalizedInterest, interestMatchScore: INTEREST_MATCH_SCORES.family });
  }

  const taggedFields = [
    ...(place.tags || []).map((value) => ({ field: "tag", value: normalise(value) })),
    ...activityTerms(place).map((value) => ({ field: "activity", value: normalise(value) })),
  ];
  const tagOrActivity = taggedFields.find(({ value }) => value === normalizedInterest || familyForTerm(value).some((family) => interestFamilies.includes(family)));
  if (tagOrActivity) return matchCandidate({ type: "tag_activity", matchedField: tagOrActivity.field, matchedValue: tagOrActivity.value, matchedInterest: normalizedInterest, interestMatchScore: INTEREST_MATCH_SCORES.tagActivity });

  return matchCandidate({ type: "none", matchedField: null, matchedValue: null, matchedInterest: normalizedInterest, interestMatchScore: INTEREST_MATCH_SCORES.none });
}

function evaluateInterestMatch(place, interests) {
  if (!Array.isArray(interests) || interests.length === 0) return { score: null, matches: [], primary: null };
  const matches = interests.map((interest) => matchSingleInterest(place, interest));
  const score = Math.round(matches.reduce((total, match) => total + match.interestMatchScore, 0) / matches.length);
  const primary = [...matches].sort((first, second) => second.interestMatchScore - first.interestMatchScore)[0];
  return { score, matches, primary };
}

module.exports = {
  CATEGORY_FAMILIES,
  INTEREST_FAMILY_TERMS,
  INTEREST_MATCH_SCORES,
  evaluateInterestMatch,
  familyForTerm,
  normalise,
};
