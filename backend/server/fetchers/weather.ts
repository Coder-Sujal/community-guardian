/**
 * Open-Meteo Weather Fetcher
 * Fetches weather alerts for a specific user location
 * https://open-meteo.com/ (free, no API key required, works globally)
 */
import { FetchedAlert } from './cisa.js';

const OPEN_METEO_API = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    precipitation?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
  };
}

// Weather code descriptions from WMO
const WEATHER_CODES: Record<number, { description: string; severity: string }> = {
  0: { description: 'Clear sky', severity: 'low' },
  1: { description: 'Mainly clear', severity: 'low' },
  2: { description: 'Partly cloudy', severity: 'low' },
  3: { description: 'Overcast', severity: 'low' },
  45: { description: 'Fog', severity: 'medium' },
  48: { description: 'Depositing rime fog', severity: 'medium' },
  51: { description: 'Light drizzle', severity: 'low' },
  53: { description: 'Moderate drizzle', severity: 'low' },
  55: { description: 'Dense drizzle', severity: 'medium' },
  56: { description: 'Light freezing drizzle', severity: 'medium' },
  57: { description: 'Dense freezing drizzle', severity: 'high' },
  61: { description: 'Slight rain', severity: 'low' },
  63: { description: 'Moderate rain', severity: 'medium' },
  65: { description: 'Heavy rain', severity: 'high' },
  66: { description: 'Light freezing rain', severity: 'high' },
  67: { description: 'Heavy freezing rain', severity: 'critical' },
  71: { description: 'Slight snow fall', severity: 'medium' },
  73: { description: 'Moderate snow fall', severity: 'high' },
  75: { description: 'Heavy snow fall', severity: 'critical' },
  77: { description: 'Snow grains', severity: 'medium' },
  80: { description: 'Slight rain showers', severity: 'low' },
  81: { description: 'Moderate rain showers', severity: 'medium' },
  82: { description: 'Violent rain showers', severity: 'high' },
  85: { description: 'Slight snow showers', severity: 'medium' },
  86: { description: 'Heavy snow showers', severity: 'high' },
  95: { description: 'Thunderstorm', severity: 'high' },
  96: { description: 'Thunderstorm with slight hail', severity: 'critical' },
  99: { description: 'Thunderstorm with heavy hail', severity: 'critical' },
};

/**
 * Fetch weather alerts for a specific user location
 * @param lat - User's latitude
 * @param lng - User's longitude
 * @param userId - User ID for unique external_id
 */
export async function fetchWeatherAlerts(
  lat: number,
  lng: number,
  userId: string
): Promise<FetchedAlert[]> {
  try {
    // Validate coordinates are in valid range
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.warn(`[Weather] Invalid coordinates for user ${userId}: (${lat}, ${lng})`);
      return [];
    }

    // Open-Meteo API requires proper parameter formatting
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: 'temperature_2m,weather_code,wind_speed_10m,precipitation',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
      timezone: 'auto',
    });
    const url = `${OPEN_METEO_API}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CommunityGuardian/1.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Weather] API error:', response.status, response.statusText, errorText);
      return [];
    }

    const data = (await response.json()) as OpenMeteoResponse;
    const alerts: FetchedAlert[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Get current weather code
    const currentCode = data.current?.weather_code;
    const weatherInfo = currentCode !== undefined ? WEATHER_CODES[currentCode] : null;

    // Only create alert for notable weather (not clear/partly cloudy)
    if (weatherInfo && currentCode !== undefined && currentCode > 3) {
      const temp = data.current?.temperature_2m;
      const wind = data.current?.wind_speed_10m;
      const precip = data.current?.precipitation;

      let description = `Current conditions: ${weatherInfo.description}`;
      if (temp !== undefined) description += `. Temperature: ${temp}°C`;
      if (wind !== undefined) description += `. Wind speed: ${wind} km/h`;
      if (precip !== undefined && precip > 0) description += `. Precipitation: ${precip} mm`;

      // Add daily forecast summary if available
      if (data.daily?.temperature_2m_max?.[0] !== undefined) {
        const maxTemp = data.daily.temperature_2m_max[0];
        const minTemp = data.daily.temperature_2m_min?.[0];
        description += `. Today's forecast: High ${maxTemp}°C`;
        if (minTemp !== undefined) description += `, Low ${minTemp}°C`;
      }

      const expires_at = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // 6 hours

      alerts.push({
        external_id: `WEATHER-${userId}-${today}`,
        title: `Weather Alert: ${weatherInfo.description}`,
        description,
        category: 'weather',
        severity: weatherInfo.severity,
        source: 'Open-Meteo',
        source_url: 'https://open-meteo.com/',
        verified: true,
        ai_processed: true, // No AI processing needed for weather
        expires_at,
      });
    }

    return alerts;
  } catch (error) {
    console.error('[Weather] Fetch error:', error);
    return [];
  }
}

export default fetchWeatherAlerts;
