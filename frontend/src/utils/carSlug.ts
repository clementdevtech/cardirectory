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

  // Support both modern slugs like "toyota-corolla-56"
  // and legacy/raw IDs like "56" or "56-car-name".
  const idMatch = slug.match(/(\d+)$/);
  if (idMatch) {
    const id = Number(idMatch[1]);
    return Number.isFinite(id) ? id : null;
  }

  const prefixMatch = slug.match(/^(\d+)/);
  if (prefixMatch) {
    const id = Number(prefixMatch[1]);
    return Number.isFinite(id) ? id : null;
  }

  return null;
}
