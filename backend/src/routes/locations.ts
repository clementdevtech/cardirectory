import express from "express";
import { geoapifyAutocomplete } from "../utils/geoapify";

const router = express.Router();

/**
 * GET /api/locations/autocomplete?query=Nairobi
 * Returns place suggestions from Geoapify API
 */
router.get("/autocomplete", async (req, res) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing ?query parameter" });
  }

  console.debug(`📍 [Route] Autocomplete request: "${query}"`);

  const results = await geoapifyAutocomplete(query);
  return res.json({ query, results });
});

export default router;
