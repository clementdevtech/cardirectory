// src/hooks/useLocationSearch.ts
import { useState, useEffect } from "react";

export type GeoapifyPlace = { formatted: string; place_id: string };

export const useLocationSearch = (apiKey: string) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoapifyPlace[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setIsFetching(true);
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
            query
          )}&limit=5&apiKey=${apiKey}`
        );
        const data = await res.json();
        const results: GeoapifyPlace[] =
          data.features?.map((f: any) => ({
            formatted: f.properties.formatted,
            place_id: f.properties.place_id,
          })) || [];
        setSuggestions(results);
      } catch (e) {
        setSuggestions([]);
      } finally {
        setIsFetching(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [query, apiKey]);

  return { query, setQuery, suggestions, isFetching };
};
