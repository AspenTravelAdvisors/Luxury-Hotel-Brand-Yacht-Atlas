// lib/sailings.js — Luxury Yacht Atlas query layer
// Shared in-memory query over the yacht TRIPS feed, mirroring the Hotel Atlas
// lib/hotels.js contract so the concierge can query yacht sailings like hotels.
// Pure functions, one-time JSON load, unit-testable without an HTTP server.

const raw = require("../itinerary.json");

const ATLAS_URL =
  process.env.ATLAS_YACHT_URL || "https://luxury-hotel-brand-yacht-atlas.vercel.app";

const ci = (s) => String(s == null ? "" : s).toLowerCase().trim();

const Q_STOPWORDS = new Set([
  "in", "the", "of", "at", "on", "a", "an", "and", "to", "for", "near", "or", "by",
  "yacht", "yachts", "sailing", "sailings", "cruise", "cruises", "voyage",
  "voyages", "ship", "trip", "trips",
]);

const MARQUEE = new Set([
  "antarctica", "arctic", "galapagos", "amazon", "polynesia",
  "patagonia", "kimberley", "mediterranean", "norway", "japan", "namibia",
]);
const MARQUEE_CENTER = {
  antarctica: [0, -71], arctic: [18, 79], galapagos: [-90.5, -0.7],
  amazon: [-60, -3], polynesia: [-149.4, -17.6], patagonia: [-72, -49],
  kimberley: [126, -16], mediterranean: [14, 39], norway: [10, 65],
  japan: [138, 37], namibia: [16, -22],
};

// Yacht region tag -> marquee key.
const REGION_MARQUEE = {
  MED: "mediterranean", CENTRALMED: "mediterranean",
  ADRIATIC: "mediterranean", AEGEAN: "mediterranean",
  POLY: "polynesia", EASTASIA: "japan",
};
const KEYWORDS = [
  ["galápagos", "galapagos"], ["galapagos", "galapagos"], ["norway", "norway"],
  ["tahiti", "polynesia"], ["japan", "japan"], ["mediterranean", "mediterranean"],
];
function marqueeFor(tag, name, regionLabel) {
  const t = `${ci(name)} ${ci(regionLabel)}`;
  for (const [kw, key] of KEYWORDS) if (t.includes(kw)) return key;
  return REGION_MARQUEE[tag] || null;
}

const BRANDS = raw.BRANDS || {};
const REGIONS = raw.REGIONS || {};
const brandName = (b) => (BRANDS[b] && BRANDS[b].short) || b || null;
const regionName = (tag) => (REGIONS[tag] && REGIONS[tag].name) || tag || null;

// "Lisbon, Portugal" -> "Portugal"
function countryOf(place) {
  const parts = String(place || "").split(",");
  return parts.length > 1 ? parts[parts.length - 1].trim() : "";
}

// --- normalize TRIPS -> records --------------------------------------------
const sailings = (raw.TRIPS || []).map((t) => {
  const tag = (t.g && t.g[0]) || null;
  const regionLabel = tag ? regionName(tag) : null;
  return {
    id: `yc_${t.id}`,
    type: "yacht",
    name: t.title,
    operator: brandName(t.brand),
    brand: brandName(t.brand),
    ship: t.ship || null,
    regionLabel,
    region: marqueeFor(tag, t.title, regionLabel),
    country: countryOf(t.to) || countryOf(t.from) || null,
    from: t.from || null,
    to: t.to || null,
    route: t.route || null,
    startDate: t.dates || null,
    month: t.monthKey || null,
    bookUrl: t.u || ATLAS_URL,
  };
});

// --- filtering -------------------------------------------------------------
function filterSailings(params = {}) {
  const { q, region, country, month, brand, ids } = params;
  let list = sailings;

  if (ids != null && String(ids).trim() !== "") {
    const set = new Set(String(ids).split(",").map((s) => s.trim()).filter(Boolean));
    list = list.filter((s) => set.has(s.id));
  }
  if (region) { const v = ci(region); if (MARQUEE.has(v)) list = list.filter((s) => s.region === v); }
  if (brand) { const v = ci(brand); list = list.filter((s) => ci(s.brand) === v); }
  if (month) { const v = String(month).trim(); list = list.filter((s) => s.month === v); }

  const hay = (s) => `${ci(s.name)} ${ci(s.brand)} ${ci(s.ship)} ${ci(s.regionLabel)} ${ci(s.route)} ${ci(s.from)} ${ci(s.to)}`;
  if (country != null && String(country).trim() !== "") {
    const v = ci(country); list = list.filter((s) => hay(s).includes(v));
  }
  if (q != null && String(q).trim() !== "") {
    const tokens = ci(q).split(/\s+/).filter((t) => t && !Q_STOPWORDS.has(t));
    if (tokens.length) list = list.filter((s) => tokens.every((t) => hay(s).includes(t)));
  }
  return list;
}

function clampLimit(rawN) { let n = parseInt(rawN, 10); if (!Number.isFinite(n) || n <= 0) n = 6; if (n > 24) n = 24; return n; }
function clampOffset(rawN) { let n = parseInt(rawN, 10); if (!Number.isFinite(n) || n < 0) n = 0; return n; }

function buildDeepLink(params = {}) {
  const usp = new URLSearchParams();
  for (const k of ["region", "country", "brand", "month", "q"]) {
    const val = params[k];
    if (val != null && String(val).trim() !== "") usp.set(k, String(val).trim());
  }
  const qs = usp.toString();
  return qs ? `${ATLAS_URL}?${qs}` : ATLAS_URL;
}

function regions() {
  const tally = {};
  for (const s of sailings) if (s.region && MARQUEE.has(s.region)) tally[s.region] = (tally[s.region] || 0) + 1;
  const out = Object.keys(tally).map((region) => ({
    region, count: tally[region], center: MARQUEE_CENTER[region] || null,
    deepLink: buildDeepLink({ region }),
  })).sort((a, b) => b.count - a.count);
  const total = out.reduce((n, r) => n + r.count, 0);
  return { total, count: out.length, regions: out };
}

function query(params = {}) {
  const matched = filterSailings(params);
  const total = matched.length;
  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);
  const results = matched.slice(offset, offset + limit);
  return { total, count: results.length, results, deepLink: buildDeepLink(params) };
}

module.exports = {
  sailings, filterSailings, clampLimit, clampOffset, buildDeepLink, query, regions,
  MARQUEE, ATLAS_URL,
};
