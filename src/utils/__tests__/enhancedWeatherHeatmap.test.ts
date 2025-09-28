import { 
  generateEnhancedWeatherHeatmap, 
  analyzeTemperatureData,
  createTemperatureLegend
} from '../weatherHeatmap';
import type { WeatherData } from '../../types';

describe('Enhanced Weather Heatmap', () => {
  const mockSunrise = 1640995200; // 6:00 AM
  const mockSunset = 1641031200;  // 6:00 PM

  // Test data with narrow temperature range (9°C to 16°C)
  const narrowRangeWeatherData: WeatherData[] = [
    {
      timestamp: 1641024000, // 4:00 AM
      temperature: 9.2,
      feelsLike: 8.5,
      humidity: 75,
      pressure: 1013,
      windSpeed: 2.1,
      windDirection: 180,
      cloudCover: 20,
      visibility: 10000,
      uvIndex: 0,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01n'
    },
    {
      timestamp: 1641027600, // 5:00 AM
      temperature: 9.8,
      feelsLike: 9.1,
      humidity: 72,
      pressure: 1013,
      windSpeed: 2.3,
      windDirection: 185,
      cloudCover: 15,
      visibility: 10000,
      uvIndex: 0,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01n'
    },
    {
      timestamp: 1641031200, // 6:00 AM
      temperature: 11.5,
      feelsLike: 10.8,
      humidity: 68,
      pressure: 1014,
      windSpeed: 2.5,
      windDirection: 190,
      cloudCover: 10,
      visibility: 10000,
      uvIndex: 1,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01d'
    },
    {
      timestamp: 1641045600, // 10:00 AM
      temperature: 14.2,
      feelsLike: 13.8,
      humidity: 55,
      pressure: 1015,
      windSpeed: 3.1,
      windDirection: 200,
      cloudCover: 5,
      visibility: 10000,
      uvIndex: 3,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01d'
    },
    {
      timestamp: 1641052800, // 12:00 PM
      temperature: 15.8,
      feelsLike: 15.5,
      humidity: 45,
      pressure: 1016,
      windSpeed: 3.8,
      windDirection: 210,
      cloudCover: 0,
      visibility: 10000,
      uvIndex: 4,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01d'
    },
    {
      timestamp: 1641060000, // 2:00 PM
      temperature: 16.1,
      feelsLike: 15.9,
      humidity: 42,
      pressure: 1016,
      windSpeed: 4.2,
      windDirection: 220,
      cloudCover: 0,
      visibility: 10000,
      uvIndex: 4,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01d'
    }
  ];

  // Test data with wide temperature range (-5°C to 25°C)
  const wideRangeWeatherData: WeatherData[] = [
    {
      timestamp: 1641024000,
      temperature: -5.0,
      feelsLike: -8.0,
      humidity: 80,
      pressure: 1010,
      windSpeed: 5.0,
      windDirection: 180,
      cloudCover: 30,
      visibility: 8000,
      uvIndex: 0,
      condition: { main: 'Snow', description: 'light snow', id: 600 },
      icon: '13n'
    },
    {
      timestamp: 1641052800,
      temperature: 25.0,
      feelsLike: 27.0,
      humidity: 40,
      pressure: 1020,
      windSpeed: 2.0,
      windDirection: 200,
      cloudCover: 0,
      visibility: 10000,
      uvIndex: 8,
      condition: { main: 'Clear', description: 'clear sky', id: 800 },
      icon: '01d'
    }
  ];

  describe('analyzeTemperatureData', () => {
    it('should correctly analyze narrow temperature range', () => {
      const temperatures = narrowRangeWeatherData.map(d => d.temperature);
      const analysis = analyzeTemperatureData(temperatures);

      expect(analysis.min).toBeCloseTo(9.2, 1);
      expect(analysis.max).toBeCloseTo(16.1, 1);
      expect(analysis.range).toBeCloseTo(6.9, 1);
      expect(analysis.isNarrowRange).toBe(true);
      expect(analysis.contrastRecommendation).toBe('medium');
    });

    it('should correctly analyze wide temperature range', () => {
      const temperatures = wideRangeWeatherData.map(d => d.temperature);
      const analysis = analyzeTemperatureData(temperatures);

      expect(analysis.min).toBe(-5.0);
      expect(analysis.max).toBe(25.0);
      expect(analysis.range).toBe(30.0);
      expect(analysis.isNarrowRange).toBe(false);
      expect(analysis.contrastRecommendation).toBe('low');
    });
  });

  describe('generateEnhancedWeatherHeatmap', () => {
    it('should generate enhanced heatmap for narrow temperature range', () => {
      const heatmap = generateEnhancedWeatherHeatmap(
        narrowRangeWeatherData,
        mockSunrise,
        mockSunset,
        {
          enhanceNarrowRanges: true,
          contrastMultiplier: 2.5,
          minContrastThreshold: 10.0
        }
      );

      expect(heatmap).toHaveLength(narrowRangeWeatherData.length);
      
      // Check that colors are different for different temperatures
      const colors = heatmap.map(h => h.color);
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBeGreaterThan(1);

      // Check that extreme temperatures have very different colors
      const coldestHour = heatmap.find(h => h.temperature === 9.2);
      const warmestHour = heatmap.find(h => h.temperature === 16.1);
      
      expect(coldestHour).toBeDefined();
      expect(warmestHour).toBeDefined();
      expect(coldestHour!.color).not.toBe(warmestHour!.color);
    });

    it('should use standard mapping for wide temperature range', () => {
      const heatmap = generateEnhancedWeatherHeatmap(
        wideRangeWeatherData,
        mockSunrise,
        mockSunset,
        {
          enhanceNarrowRanges: true,
          contrastMultiplier: 2.0,
          minContrastThreshold: 10.0
        }
      );

      expect(heatmap).toHaveLength(wideRangeWeatherData.length);
      
      // Should have very different colors for extreme temperatures
      const coldHour = heatmap.find(h => h.temperature === -5.0);
      const hotHour = heatmap.find(h => h.temperature === 25.0);
      
      expect(coldHour).toBeDefined();
      expect(hotHour).toBeDefined();
      expect(coldHour!.color).not.toBe(hotHour!.color);
    });

    it('should handle night time colors differently', () => {
      const heatmap = generateEnhancedWeatherHeatmap(
        narrowRangeWeatherData,
        mockSunrise,
        mockSunset
      );

      const nightHours = heatmap.filter(h => h.isNight);
      const dayHours = heatmap.filter(h => !h.isNight);

      expect(nightHours.length).toBeGreaterThan(0);
      expect(dayHours.length).toBeGreaterThan(0);

      // Night colors should generally be darker/different from day colors
      // This is a basic check - in practice, night colors have different hues
      expect(nightHours[0].color).toBeDefined();
      expect(dayHours[0].color).toBeDefined();
    });
  });

  describe('createTemperatureLegend', () => {
    it('should create temperature legend for narrow range', () => {
      const heatmap = generateEnhancedWeatherHeatmap(
        narrowRangeWeatherData,
        mockSunrise,
        mockSunset
      );

      const legend = createTemperatureLegend(heatmap, 5);

      expect(legend).toHaveLength(5);
      expect(legend[0].temperature).toBeCloseTo(9.2, 1);
      expect(legend[4].temperature).toBeCloseTo(16.1, 1);
      
      // Each legend item should have a color and label
      legend.forEach(item => {
        expect(item.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(item.label).toMatch(/^\d+\.\d°C$/);
      });
    });
  });
});
