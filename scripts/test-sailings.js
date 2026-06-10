// scripts/test-sailings.js — Luxury Yacht Atlas tests
// No framework. Run: node scripts/test-sailings.js

const assert = require("node:assert/strict");
const { sailings, filterSailings, clampLimit, query, regions, MARQUEE } =
  require("../lib/sailings");
const sailingsApi = require("../api/yacht-sailings");
const regionsApi = require("../api/regions");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok  " + name); }
const ci = (s) => String(s == null ? "" : s).toLowerCase();

test("dataset loaded (unique ids, every record has a bookable URL)", () => {
  assert.ok(sailings.length > 100);
  assert.equal(new Set(sailings.map((s) => s.id)).size, sailings.length);
  assert.ok(sailings.every((s) => s.name && s.bookUrl));
});

test("region filter maps MED family to mediterranean", () => {
  const r = filterSailings({ region: "mediterranean" });
  assert.ok(r.length > 0);
  assert.ok(r.every((s) => s.region === "mediterranean"));
});

test("country filter matches any port of call, not just endpoints", () => {
  const r = filterSailings({ country: "Italy" });
  assert.ok(r.length > 0);
  assert.ok(r.every((s) =>
    `${ci(s.from)} ${ci(s.to)} ${ci(s.route)} ${(s.ports || []).map(ci).join(" ")}`.includes("italy")));
  // sailings that only touch Italy mid-itinerary are included
  const midRouteOnly = r.filter((s) => !`${ci(s.from)} ${ci(s.to)} ${ci(s.route)}`.includes("italy"));
  assert.ok(midRouteOnly.length > 0);
});

test("records expose ordered ports of call and port countries", () => {
  const withPorts = sailings.filter((s) => s.ports && s.ports.length > 1);
  assert.ok(withPorts.length > 100);
  assert.ok(withPorts.every((s) => Array.isArray(s.countries)));
  const med = withPorts.find((s) => s.countries.length > 1);
  assert.ok(med, "multi-country sailings carry every port country");
});

test("month filter (YYYY-MM) narrows by monthKey", () => {
  const any = sailings.find((s) => s.month);
  const r = filterSailings({ month: any.month });
  assert.ok(r.length > 0 && r.every((s) => s.month === any.month));
});

test("query paginates with honest total + deepLink", () => {
  const r = query({ region: "mediterranean", limit: 2 });
  assert.ok(r.total >= r.count);
  assert.equal(r.count, Math.min(2, r.total));
  assert.ok(r.deepLink.includes("region=mediterranean"));
});

test("clampLimit default 6, capped at 24", () => {
  assert.equal(clampLimit(undefined), 6);
  assert.equal(clampLimit(100), 24);
});

test("regions returns marquee aggregates with centroids", () => {
  const r = regions();
  assert.ok(r.count > 0);
  assert.ok(r.regions.every((g) => MARQUEE.has(g.region) && Array.isArray(g.center)));
});

function mockRes() {
  return { _s: 200, _j: null, _h: {}, setHeader(k, v) { this._h[k] = v; },
    status(c) { this._s = c; return this; }, json(o) { this._j = o; return this; } };
}
test("GET /api/yacht-sailings handler returns query payload", () => {
  const res = mockRes();
  sailingsApi({ method: "GET", query: { region: "mediterranean", limit: "2" } }, res);
  assert.equal(res._s, 200);
  assert.ok(res._j.results.length >= 1 && res._j.results[0].bookUrl);
});
test("GET /api/regions handler returns aggregate", () => {
  const res = mockRes();
  regionsApi({ method: "GET", query: {} }, res);
  assert.equal(res._s, 200);
  assert.ok(res._j.regions.length > 0);
});

console.log(`\n${passed} tests passed`);
