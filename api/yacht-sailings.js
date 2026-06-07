// GET /api/yacht-sailings
// Filter, search, paginate over the normalized brand-yacht inventory. Returns
// { total, count, results, deepLink } — same contract as the Hotel Atlas.

const { query } = require("../lib/sailings");

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json");

  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const raw = req.query || {};
  const params = {};
  for (const k of Object.keys(raw)) params[k] = Array.isArray(raw[k]) ? raw[k][0] : raw[k];

  res.status(200).json(query(params));
};
