import React, { useState, useEffect } from 'react';
import { 
  generateEnhancedWeatherHeatmap, 
  analyzeTemperatureData,
  createTemperatureLegend 
} from '../utils/weatherHeatmap';
import type { WeatherData } from '../types';

interface TemperatureGradientDemoProps {
  className?: string;
}

const TemperatureGradientDemo: React.FC<TemperatureGradientDemoProps> = ({ className = '' }) => {
  const [selectedRange, setSelectedRange] = useState<'narrow' | 'wide'>('narrow');
  const [contrastLevel, setContrastLevel] = useState<number>(2.0);

  const mockSunrise = 1640995200; // 6:00 AM
  const mockSunset = 1641031200;  // 6:00 PM

  // Narrow range data (9°C to 16°C)
  const narrowRangeData: WeatherData[] = [
    { timestamp: 1641024000, temperature: 9.2, feelsLike: 8.5, humidity: 75, pressure: 1013, windSpeed: 2.1, windDirection: 180, cloudCover: 20, visibility: 10000, uvIndex: 0, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01n' },
    { timestamp: 1641027600, temperature: 10.1, feelsLike: 9.4, humidity: 72, pressure: 1013, windSpeed: 2.3, windDirection: 185, cloudCover: 15, visibility: 10000, uvIndex: 0, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01n' },
    { timestamp: 1641031200, temperature: 11.5, feelsLike: 10.8, humidity: 68, pressure: 1014, windSpeed: 2.5, windDirection: 190, cloudCover: 10, visibility: 10000, uvIndex: 1, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641034800, temperature: 12.8, feelsLike: 12.3, humidity: 62, pressure: 1014, windSpeed: 2.8, windDirection: 195, cloudCover: 8, visibility: 10000, uvIndex: 2, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641038400, temperature: 13.9, feelsLike: 13.5, humidity: 58, pressure: 1015, windSpeed: 3.0, windDirection: 200, cloudCover: 5, visibility: 10000, uvIndex: 3, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641042000, temperature: 14.7, feelsLike: 14.4, humidity: 52, pressure: 1015, windSpeed: 3.2, windDirection: 205, cloudCover: 3, visibility: 10000, uvIndex: 3, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641045600, temperature: 15.3, feelsLike: 15.1, humidity: 48, pressure: 1015, windSpeed: 3.5, windDirection: 210, cloudCover: 2, visibility: 10000, uvIndex: 4, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641049200, temperature: 15.8, feelsLike: 15.6, humidity: 45, pressure: 1016, windSpeed: 3.8, windDirection: 215, cloudCover: 0, visibility: 10000, uvIndex: 4, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641052800, temperature: 16.1, feelsLike: 15.9, humidity: 42, pressure: 1016, windSpeed: 4.0, windDirection: 220, cloudCover: 0, visibility: 10000, uvIndex: 4, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
  ];

  // Wide range data (-5°C to 25°C)
  const wideRangeData: WeatherData[] = [
    { timestamp: 1641024000, temperature: -5.0, feelsLike: -8.0, humidity: 80, pressure: 1010, windSpeed: 5.0, windDirection: 180, cloudCover: 30, visibility: 8000, uvIndex: 0, condition: { main: 'Snow', description: 'light snow', id: 600 }, icon: '13n' },
    { timestamp: 1641027600, temperature: -2.0, feelsLike: -5.0, humidity: 75, pressure: 1011, windSpeed: 4.5, windDirection: 185, cloudCover: 25, visibility: 9000, uvIndex: 0, condition: { main: 'Clouds', description: 'few clouds', id: 801 }, icon: '02n' },
    { timestamp: 1641031200, temperature: 2.0, feelsLike: -1.0, humidity: 70, pressure: 1012, windSpeed: 4.0, windDirection: 190, cloudCover: 20, visibility: 10000, uvIndex: 1, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641034800, temperature: 8.0, feelsLike: 6.0, humidity: 65, pressure: 1013, windSpeed: 3.5, windDirection: 195, cloudCover: 15, visibility: 10000, uvIndex: 2, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641038400, temperature: 15.0, feelsLike: 14.0, humidity: 55, pressure: 1015, windSpeed: 3.0, windDirection: 200, cloudCover: 10, visibility: 10000, uvIndex: 5, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641042000, temperature: 20.0, feelsLike: 19.0, humidity: 45, pressure: 1017, windSpeed: 2.5, windDirection: 205, cloudCover: 5, visibility: 10000, uvIndex: 7, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641045600, temperature: 23.0, feelsLike: 22.0, humidity: 40, pressure: 1018, windSpeed: 2.0, windDirection: 210, cloudCover: 0, visibility: 10000, uvIndex: 8, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
    { timestamp: 1641049200, temperature: 25.0, feelsLike: 24.0, humidity: 35, pressure: 1020, windSpeed: 1.5, windDirection: 215, cloudCover: 0, visibility: 10000, uvIndex: 9, condition: { main: 'Clear', description: 'clear sky', id: 800 }, icon: '01d' },
  ];

  const currentData = selectedRange === 'narrow' ? narrowRangeData : wideRangeData;

  // Generate heatmap data
  const standardHeatmap = generateEnhancedWeatherHeatmap(currentData, mockSunrise, mockSunset, {
    enhanceNarrowRanges: false,
    contrastMultiplier: 1.0,
    minContrastThreshold: 5.0
  });

  const enhancedHeatmap = generateEnhancedWeatherHeatmap(currentData, mockSunrise, mockSunset, {
    enhanceNarrowRanges: true,
    contrastMultiplier: contrastLevel,
    minContrastThreshold: 10.0
  });

  // Analyze temperature data
  const temperatures = currentData.map(d => d.temperature);
  const analysis = analyzeTemperatureData(temperatures);

  // Create legends
  const standardLegend = createTemperatureLegend(standardHeatmap, 5);
  const enhancedLegend = createTemperatureLegend(enhancedHeatmap, 5);

  const renderGradientBar = (heatmapData: any[], title: string) => {
    const gradientStops = heatmapData.map((data, index) => {
      const percentage = (index / (heatmapData.length - 1)) * 100;
      const hex = data.color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${data.opacity}) ${percentage}%`;
    });

    const gradient = `linear-gradient(to right, ${gradientStops.join(', ')})`;

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">{title}</h3>
        <div 
          className="h-16 rounded-lg border-2 border-gray-300 shadow-sm"
          style={{ background: gradient }}
        />
        <div className="flex justify-between mt-2 text-sm text-gray-600">
          <span>{analysis.min.toFixed(1)}°C</span>
          <span>{analysis.max.toFixed(1)}°C</span>
        </div>
      </div>
    );
  };

  const renderTemperaturePoints = (heatmapData: any[]) => {
    return (
      <div className="grid grid-cols-3 gap-2 mt-4">
        {heatmapData.map((data, index) => (
          <div key={index} className="text-center">
            <div 
              className="w-8 h-8 rounded-full mx-auto mb-1 border-2 border-white shadow-sm"
              style={{ backgroundColor: data.color }}
            />
            <div className="text-xs text-gray-600">
              {data.temperature.toFixed(1)}°C
            </div>
            <div className="text-xs text-gray-500">
              {new Date(currentData[index].timestamp * 1000).getHours()}:00
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        Enhanced Temperature Gradient Demonstration
      </h2>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Temperature Range:
          </label>
          <div className="flex space-x-4">
            <button
              onClick={() => setSelectedRange('narrow')}
              className={`px-4 py-2 rounded-lg ${
                selectedRange === 'narrow'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Narrow (9°C - 16°C)
            </button>
            <button
              onClick={() => setSelectedRange('wide')}
              className={`px-4 py-2 rounded-lg ${
                selectedRange === 'wide'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Wide (-5°C - 25°C)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contrast Multiplier: {contrastLevel.toFixed(1)}
          </label>
          <input
            type="range"
            min="1.0"
            max="4.0"
            step="0.1"
            value={contrastLevel}
            onChange={(e) => setContrastLevel(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Analysis */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-800">Temperature Analysis</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Range:</span> {analysis.range.toFixed(1)}°C
          </div>
          <div>
            <span className="font-medium">Is Narrow:</span> {analysis.isNarrowRange ? 'Yes' : 'No'}
          </div>
          <div>
            <span className="font-medium">Recommendation:</span> {analysis.contrastRecommendation}
          </div>
          <div>
            <span className="font-medium">Std Deviation:</span> {analysis.standardDeviation.toFixed(2)}°C
          </div>
        </div>
      </div>

      {/* Gradient Comparisons */}
      <div className="space-y-6">
        {renderGradientBar(standardHeatmap, 'Standard Gradient')}
        {renderGradientBar(enhancedHeatmap, 'Enhanced Gradient (Improved Contrast)')}
      </div>

      {/* Temperature Points */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          Individual Temperature Colors (Enhanced)
        </h3>
        {renderTemperaturePoints(enhancedHeatmap)}
      </div>

      {/* Improvement Summary */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-blue-900">
          🎨 Enhancement Summary
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Dynamic temperature range analysis</li>
          <li>• Extreme contrast mode for narrow ranges (&lt; 10°C)</li>
          <li>• Enhanced color palette with better visual separation</li>
          <li>• Adaptive opacity based on contrast needs</li>
          <li>• Night/day color variations maintained</li>
        </ul>
      </div>
    </div>
  );
};

export default TemperatureGradientDemo;
