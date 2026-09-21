import "server-only";

export interface GeocodedPoint { latitude: number; longitude: number; }

const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org/search";

export async function geocodeEventLocation(input: {
  address?: string;
  city?: string;
  region?: string;
  countryCode?: string;
}): Promise<GeocodedPoint | null> {
  const parts = [input.address, input.city, input.region].filter(Boolean);
  if (parts.length === 0) return null;

  const endpoint = process.env.GEOCODING_ENDPOINT?.trim() || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", parts.join(", "));
  if (input.countryCode) url.searchParams.set("countrycodes", input.countryCode.toLowerCase());

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ProMedia-Events/1.0 (+https://events.promedia.report)",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const latitude = Number(results[0]?.lat);
    const longitude = Number(results[0]?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
  } catch {
    // Geocoding is best-effort: an external outage must never block saving an event.
    return null;
  }
}
