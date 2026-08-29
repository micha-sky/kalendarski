// WMO weather-interpretation codes (used by Open-Meteo) → condition + emoji.
// Shared by header current-conditions (weatherService) and per-event weather
// (eventWeatherService). Reference: https://open-meteo.com/en/docs

export interface ConditionInfo {
  main: string;
  description: string;
  emoji: string;
}

export function describeWeatherCode(code: number, isDay: boolean): ConditionInfo {
  switch (code) {
    case 0:
      return { main: 'Clear', description: 'clear sky', emoji: isDay ? '☀️' : '🌙' };
    case 1:
      return { main: 'Clear', description: 'mainly clear', emoji: isDay ? '🌤️' : '🌙' };
    case 2:
      return { main: 'Clouds', description: 'partly cloudy', emoji: isDay ? '⛅' : '☁️' };
    case 3:
      return { main: 'Clouds', description: 'overcast', emoji: '☁️' };
    case 45:
    case 48:
      return { main: 'Fog', description: 'fog', emoji: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { main: 'Drizzle', description: 'drizzle', emoji: '🌦️' };
    case 56:
    case 57:
      return { main: 'Drizzle', description: 'freezing drizzle', emoji: '🌧️' };
    case 61:
    case 63:
    case 65:
      return { main: 'Rain', description: 'rain', emoji: '🌧️' };
    case 66:
    case 67:
      return { main: 'Rain', description: 'freezing rain', emoji: '🌧️' };
    case 71:
    case 73:
    case 75:
      return { main: 'Snow', description: 'snow', emoji: '🌨️' };
    case 77:
      return { main: 'Snow', description: 'snow grains', emoji: '🌨️' };
    case 80:
    case 81:
    case 82:
      return { main: 'Rain', description: 'rain showers', emoji: '🌦️' };
    case 85:
    case 86:
      return { main: 'Snow', description: 'snow showers', emoji: '🌨️' };
    case 95:
      return { main: 'Thunderstorm', description: 'thunderstorm', emoji: '⛈️' };
    case 96:
    case 99:
      return { main: 'Thunderstorm', description: 'thunderstorm with hail', emoji: '⛈️' };
    default:
      return { main: 'Unknown', description: 'unknown conditions', emoji: '🌡️' };
  }
}
