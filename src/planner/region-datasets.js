"use strict";

const sultanahmet = require("../../outputs/normalized/sultanahmet-eminonu.json").places;
const kadikoy = require("../../outputs/normalized/kadikoy-moda.json").places;
const karakoy = require("../../outputs/normalized/karakoy-galata-taksim.json").places;
const ortakoy = require("../../outputs/normalized/ortakoy-bebek.json").places;
const uskudar = require("../../outputs/normalized/uskudar-kuzguncuk.json").places;
const fenerSeed = require("../../outputs/normalized/fener-balat-eyup-seed.json").places;
const fenerVenues = require("../../outputs/normalized/fener-balat-eyup-venues.json").places;

const REGION_DATASETS = Object.freeze({
  "sultanahmet-eminonu": sultanahmet,
  "kadikoy-moda": kadikoy,
  "karakoy-galata-taksim": karakoy,
  "ortakoy-bebek": ortakoy,
  "uskudar-kuzguncuk": uskudar,
  "fener-balat": [...fenerSeed, ...fenerVenues],
});

function resolveRegionDataset(region, datasets = REGION_DATASETS) {
  const dataset = datasets[region];
  if (!dataset) return null;
  return Array.isArray(dataset) ? dataset : dataset.places;
}

module.exports = { REGION_DATASETS, resolveRegionDataset };
