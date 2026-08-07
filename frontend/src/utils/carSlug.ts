export interface CarSlugSource {
  id: number;
  make: string;
  model: string;
  year?: number | string | null;
}

export function carSlug(car: CarSlugSource) {
  const label = `${car.year ?? ""} ${car.make} ${car.model}`.trim();
  const normalized = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized}-${car.id}`;
}

export function parseCarSlug(slug: string): number | null {
  if (!slug) return null;

  const normalized = slug.trim();
  const segments = normalized.split("-").filter(Boolean);
  if (segments.length === 0) return null;

  // Last segment should be the numeric ID when using slug-based car URLs.
  const lastSegment = segments[segments.length - 1];
  const lastId = Number(lastSegment);
  if (Number.isInteger(lastId) && lastId > 0) {
    return lastId;
  }

  // Fallback for plain numeric slug values like "56".
  const numericSlug = Number(normalized);
  if (Number.isInteger(numericSlug) && numericSlug > 0) {
    return numericSlug;
  }

  return null;
}
