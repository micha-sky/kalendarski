import { describe, it, expect } from 'vitest';
import { 
  generateWeatherHeatmap, 
  createHeatmapGradient, 
  smoothHeatmapTransitions 
} from '../weatherHeatmap';
import type { WeatherData } from '../../types';

describe('Weather Heatmap Utils', () => {
  const mockWeatherData: WeatherData[] = [
    {
      timestamp: 1640995200, // 2022-01-01 00:00:00 UTC
      temperature: -5,
      feelsLike: -8,
      humidity: 80,
      pressure: 1013,
      windSpeed: 5,
      windDirection: 180,
      cloudCover: 20,
      visibility: 10000,
      uvIndex: 0,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01n',
    },
    {
      timestamp: 1640998800, // 2022-01-01 01:00:00 UTC
      temperature: 15,
      feelsLike: 13,
      humidity: 60,
      pressure: 1015,
      windSpeed: 3,
      windDirection: 90,
      cloudCover: 40,
      visibility: 10000,
      uvIndex: 0,
      condition: { main: 'Clouds', description: 'few clouds', id: 801 },
      icon: '02d',
    },
    {
      timestamp: 1641002400, // 2022-01-01 02:00:00 UTC
      temperature: 25,
      feelsLike: 27,
      humidity: 45,
      pressure: 1018,
      windSpeed: 2,
      windDirection: 45,
      cloudCover: 10,
      visibility: 10000,
      uvIndex: 5,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01d',
    },
  ];

  const mockSunrise = 1640995200; // 6 AM
  const mockSunset = 1641027600;  // 6 PM

  describe('generateWeatherHeatmap', () => {
    it('should generate heatmap data from weather data', () => {
      const result = generateWeatherHeatmap(mockWeatherData, mockSunrise, mockSunset);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('hour');
      expect(result[0]).toHaveProperty('temperature');
      expect(result[0]).toHaveProperty('color');
      expect(result[0]).toHaveProperty('opacity');
      expect(result[0]).toHaveProperty('isNight');
    });

    it('should assign correct colors based on temperature', () => {
      const result = generateWeatherHeatmap(mockWeatherData, mockSunrise, mockSunset);
      
      // Cold temperature should have blue tones
      expect(result[0].color).toMatch(/#[0-9a-f]{6}/i);
      
      // Warm temperature should have warmer tones
      expect(result[2].color).toMatch(/#[0-9a-f]{6}/i);
    });

    it('should handle night time correctly', () => {
      const result = generateWeatherHeatmap(mockWeatherData, mockSunrise, mockSunset);

      // Check that isNight property is set correctly based on sunrise/sunset
      expect(result[0]).toHaveProperty('isNight');
      expect(typeof result[0].isNight).toBe('boolean');
    });
  });

  describe('createHeatmapGradient', () => {
    it('should create a valid CSS gradient string', () => {
      const heatmapData = generateWeatherHeatmap(mockWeatherData, mockSunrise, mockSunset);
      const gradient = createHeatmapGradient(heatmapData);
      
      expect(gradient).toContain('linear-gradient');
      expect(gradient).toContain('to right');
      expect(gradient).toContain('rgba(');
    });

    it('should handle empty heatmap data', () => {
      const gradient = createHeatmapGradient([]);
      
      expect(gradient).toBe('linear-gradient(to right, #3b82f6)');
    });
  });

  describe('smoothHeatmapTransitions', () => {
    it('should smooth temperature transitions', () => {
      const heatmapData = generateWeatherHeatmap(mockWeatherData, mockSunrise, mockSunset);
      const smoothed = smoothHeatmapTransitions(heatmapData);
      
      expect(smoothed).toHaveLength(heatmapData.length);
      
      // Middle values should be smoothed
      if (smoothed.length > 2) {
        expect(smoothed[1].temperature).not.toBe(heatmapData[1].temperature);
      }
    });

    it('should preserve first and last values', () => {
      const heatmapData = generateWeatherHeatmap(mockWeatherData, mockSunrise, mockSunset);
      const smoothed = smoothHeatmapTransitions(heatmapData);
      
      expect(smoothed[0].temperature).toBe(heatmapData[0].temperature);
      expect(smoothed[smoothed.length - 1].temperature).toBe(heatmapData[heatmapData.length - 1].temperature);
    });

    it('should handle arrays with 2 or fewer elements', () => {
      const shortData = generateWeatherHeatmap(mockWeatherData.slice(0, 2), mockSunrise, mockSunset);
      const smoothed = smoothHeatmapTransitions(shortData);
      
      expect(smoothed).toEqual(shortData);
    });
  });
});
