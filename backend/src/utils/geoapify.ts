import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const GEOAPIFY_KEY = process.env.GEOAPIFY_KEY;

if (!GEOAPIFY_KEY) {
  console.warn("⚠️ Missing GEOAPIFY_KEY in environment variables!");
}

export async function geoapifyAutocomplete(query: string) {
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

    const results = data.features.map((f: any) => ({
      name: f.properties.formatted,
      country: f.properties.country,
      city: f.properties.city,
      lat: f.properties.lat,
      lon: f.properties.lon,
    }));

    console.debug(`✅ [Geoapify] Found ${results.length} results`);
    return results;
  } catch (err: any) {
    console.error("❌ [Geoapify] Error fetching places:", err.message);
    return [];
  }
}
