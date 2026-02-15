const axios = require("axios");
require("dotenv").config();

const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;

if (!GEOAPIFY_KEY) {
  console.warn("⚠️ Missing GEOAPIFY_KEY in environment variables!");
}

async function geoapifyAutocomplete(query) {
  try {
    console.debug(`🔍 [Geoapify] Searching for: ${query}`);

    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
      query
    )}&limit=5&apiKey=${GEOAPIFY_KEY}`;

    const { data } = await axios.get(url);

    if (!data.features?.length) {
      console.debug("🟡 [Geoapify] No results found.");
      return [];
    }

    const results = data.features.map((f) => ({
      name: f.properties.formatted,
      country: f.properties.country,
      city: f.properties.city,
      lat: f.properties.lat,
      lon: f.properties.lon,
    }));

    console.debug(`✅ [Geoapify] Found ${results.length} results`);
    return results;
  } catch (err) {
    console.error("❌ [Geoapify] Error fetching places:", err.message);
    return [];
  }
}

module.exports = { geoapifyAutocomplete };
