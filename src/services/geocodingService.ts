import type { Location } from '../types';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export interface GeocodingResult extends Location {
  name: string;
  admin1?: string;
}

interface OpenMeteoGeocodingResponse {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
    country?: string;
    admin1?: string;
    timezone?: string;
  }>;
}

/**
 * Searches for locations by name using Open-Meteo's free geocoding API (no key required).
 */
export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Geocoding search failed: ${response.status}`);

  const data: OpenMeteoGeocodingResponse = await response.json();
  return (data.results ?? []).map((r) => ({
    latitude: r.latitude,
    longitude: r.longitude,
    city: r.name,
    country: r.country,
    timezone: r.timezone,
    name: r.name,
    admin1: r.admin1,
  }));
}
