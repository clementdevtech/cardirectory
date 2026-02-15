const express = require("express");
const { geoapifyAutocomplete } = require("../utils/geoapify");

const router = express.Router();

router.get("/autocomplete", async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing ?query parameter" });
  }

  console.debug(`📍 [Route] Autocomplete request: "${query}"`);

  const results = await geoapifyAutocomplete(query);
  res.json({ query, results });
});

module.exports = router;
