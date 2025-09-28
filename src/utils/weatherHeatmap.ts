import type { WeatherData, WeatherHeatmapData } from '../types';

/**
 * Temperature ranges for color mapping (in Celsius)
 */
const TEMP_RANGES = {
  VERY_COLD: -20,
  COLD: 0,
  COOL: 10,
  MILD: 20,
  WARM: 25,
  HOT: 30,
  VERY_HOT: 35,
} as const;

/**
 * Color palette for temperature mapping
 */
const TEMP_COLORS = {
  VERY_COLD: '#1e3a8a', // Deep blue
  COLD: '#3b82f6',      // Blue
  COOL: '#06b6d4',      // Cyan
  MILD: '#10b981',      // Green
  WARM: '#f59e0b',      // Amber
  HOT: '#ef4444',       // Red
  VERY_HOT: '#dc2626',  // Dark red
} as const;

/**
 * Night time color adjustments (darker, more blue tones)
 */
const NIGHT_COLOR_ADJUSTMENTS = {
  VERY_COLD: '#1e40af',
  COLD: '#2563eb',
  COOL: '#0891b2',
  MILD: '#059669',
  WARM: '#d97706',
  HOT: '#dc2626',
  VERY_HOT: '#b91c1c',
} as const;

/**
 * Interpolates between two colors
 */
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.substr(0, 2), 16);
  const g1 = parseInt(hex1.substr(2, 2), 16);
  const b1 = parseInt(hex1.substr(4, 2), 16);
  
  const r2 = parseInt(hex2.substr(0, 2), 16);
  const g2 = parseInt(hex2.substr(2, 2), 16);
  const b2 = parseInt(hex2.substr(4, 2), 16);
  
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Determines if a given hour is during night time
 */
function isNightTime(hour: number, sunrise: number, sunset: number): boolean {
  const sunriseHour = new Date(sunrise * 1000).getHours();
  const sunsetHour = new Date(sunset * 1000).getHours();
  
  return hour < sunriseHour || hour > sunsetHour;
}

/**
 * Enhanced color palette with more dramatic contrast for narrow temperature ranges
 */
const ENHANCED_TEMP_COLORS = {
  VERY_COLD: '#0f172a',    // Very dark blue-gray
  COLD: '#1e3a8a',        // Deep blue
  COOL: '#0ea5e9',        // Bright sky blue
  MILD: '#10b981',        // Emerald green
  WARM: '#f59e0b',        // Amber
  HOT: '#ef4444',         // Red
  VERY_HOT: '#7c2d12',    // Dark red-brown
} as const;

/**
 * Enhanced night time colors with more dramatic contrast
 */
const ENHANCED_NIGHT_COLORS = {
  VERY_COLD: '#020617',    // Almost black blue
  COLD: '#1e40af',        // Deep blue
  COOL: '#0284c7',        // Ocean blue
  MILD: '#059669',        // Dark emerald
  WARM: '#d97706',        // Dark amber
  HOT: '#dc2626',         // Dark red
  VERY_HOT: '#991b1b',    // Very dark red
} as const;

/**
 * Calculates dynamic temperature ranges based on actual data
 */
function calculateDynamicTempRanges(temperatures: number[]): {
  min: number;
  max: number;
  range: number;
  segments: number[];
} {
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  const range = max - min;

  // For narrow ranges (< 10°C), create more segments for better contrast
  // For wider ranges, use fewer segments to avoid over-segmentation
  const segmentCount = range < 10 ? 6 : range < 20 ? 5 : 4;
  const segmentSize = range / segmentCount;

  const segments = Array.from({ length: segmentCount + 1 }, (_, i) =>
    min + (i * segmentSize)
  );

  return { min, max, range, segments };
}

/**
 * Maps temperature to color using dynamic ranges for enhanced contrast
 */
function getTemperatureColorDynamic(
  temperature: number,
  isNight: boolean,
  tempRanges: { min: number; max: number; range: number; segments: number[] }
): string {
  const colors = isNight ? ENHANCED_NIGHT_COLORS : ENHANCED_TEMP_COLORS;
  const colorKeys = Object.keys(colors) as (keyof typeof colors)[];
  const { segments } = tempRanges;

  // Handle edge cases
  if (temperature <= segments[0]) {
    return colors[colorKeys[0]];
  }
  if (temperature >= segments[segments.length - 1]) {
    return colors[colorKeys[colorKeys.length - 1]];
  }

  // Find which segment the temperature falls into
  for (let i = 0; i < segments.length - 1; i++) {
    if (temperature >= segments[i] && temperature <= segments[i + 1]) {
      const factor = (temperature - segments[i]) / (segments[i + 1] - segments[i]);
      const colorIndex = Math.min(i, colorKeys.length - 2);
      return interpolateColor(
        colors[colorKeys[colorIndex]],
        colors[colorKeys[colorIndex + 1]],
        factor
      );
    }
  }

  // Fallback
  return colors.MILD;
}

/**
 * Maps temperature to color based on time of day (legacy function for backward compatibility)
 */
function getTemperatureColor(temperature: number, isNight: boolean): string {
  const colors = isNight ? NIGHT_COLOR_ADJUSTMENTS : TEMP_COLORS;

  if (temperature <= TEMP_RANGES.VERY_COLD) {
    return colors.VERY_COLD;
  } else if (temperature <= TEMP_RANGES.COLD) {
    const factor = (temperature - TEMP_RANGES.VERY_COLD) / (TEMP_RANGES.COLD - TEMP_RANGES.VERY_COLD);
    return interpolateColor(colors.VERY_COLD, colors.COLD, factor);
  } else if (temperature <= TEMP_RANGES.COOL) {
    const factor = (temperature - TEMP_RANGES.COLD) / (TEMP_RANGES.COOL - TEMP_RANGES.COLD);
    return interpolateColor(colors.COLD, colors.COOL, factor);
  } else if (temperature <= TEMP_RANGES.MILD) {
    const factor = (temperature - TEMP_RANGES.COOL) / (TEMP_RANGES.MILD - TEMP_RANGES.COOL);
    return interpolateColor(colors.COOL, colors.MILD, factor);
  } else if (temperature <= TEMP_RANGES.WARM) {
    const factor = (temperature - TEMP_RANGES.MILD) / (TEMP_RANGES.WARM - TEMP_RANGES.MILD);
    return interpolateColor(colors.MILD, colors.WARM, factor);
  } else if (temperature <= TEMP_RANGES.HOT) {
    const factor = (temperature - TEMP_RANGES.WARM) / (TEMP_RANGES.HOT - TEMP_RANGES.WARM);
    return interpolateColor(colors.WARM, colors.HOT, factor);
  } else if (temperature <= TEMP_RANGES.VERY_HOT) {
    const factor = (temperature - TEMP_RANGES.HOT) / (TEMP_RANGES.VERY_HOT - TEMP_RANGES.HOT);
    return interpolateColor(colors.HOT, colors.VERY_HOT, factor);
  } else {
    return colors.VERY_HOT;
  }
}

/**
 * Calculates opacity based on cloud cover and time of day with enhanced contrast
 */
function calculateOpacity(cloudCover: number, isNight: boolean, enhanceContrast: boolean = false): number {
  const baseOpacity = enhanceContrast ?
    (isNight ? 0.6 : 0.5) :  // Higher base opacity for enhanced contrast
    (isNight ? 0.4 : 0.3);   // Original opacity levels

  const cloudFactor = cloudCover / 100;

  // More clouds = slightly more opacity for better visibility
  // Enhanced contrast mode uses higher maximum opacity
  const maxOpacity = enhanceContrast ? 0.9 : 0.8;
  const opacityBoost = enhanceContrast ? 0.3 : 0.2;

  return Math.min(baseOpacity + (cloudFactor * opacityBoost), maxOpacity);
}

/**
 * Generates heatmap data from hourly weather data with enhanced contrast
 * This is now a wrapper around the enhanced version for backward compatibility
 */
export function generateWeatherHeatmap(
  hourlyData: WeatherData[],
  sunrise: number,
  sunset: number
): WeatherHeatmapData[] {
  return generateEnhancedWeatherHeatmap(hourlyData, sunrise, sunset, {
    enhanceNarrowRanges: true,
    contrastMultiplier: 2.0,
    minContrastThreshold: 8.0
  });
}

/**
 * Creates a CSS gradient string from heatmap data
 */
export function createHeatmapGradient(heatmapData: WeatherHeatmapData[]): string {
  if (heatmapData.length === 0) return 'linear-gradient(to right, #3b82f6)';
  
  const gradientStops = heatmapData.map((data, index) => {
    const percentage = (index / (heatmapData.length - 1)) * 100;
    const color = data.color;
    const alpha = data.opacity;
    
    // Convert hex to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha}) ${percentage}%`;
  });
  
  return `linear-gradient(to right, ${gradientStops.join(', ')})`;
}

/**
 * Gets the current hour's heatmap data
 */
export function getCurrentHourHeatmap(heatmapData: WeatherHeatmapData[]): WeatherHeatmapData | null {
  const currentHour = new Date().getHours();
  return heatmapData.find(data => data.hour === currentHour) || null;
}

/**
 * Analyzes temperature data and provides insights for contrast enhancement
 */
export function analyzeTemperatureData(temperatures: number[]): {
  min: number;
  max: number;
  range: number;
  average: number;
  median: number;
  standardDeviation: number;
  isNarrowRange: boolean;
  contrastRecommendation: 'low' | 'medium' | 'high' | 'extreme';
} {
  const sorted = [...temperatures].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;
  const average = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  // Calculate standard deviation
  const variance = temperatures.reduce((sum, temp) => sum + Math.pow(temp - average, 2), 0) / temperatures.length;
  const standardDeviation = Math.sqrt(variance);

  // Determine if range is narrow and recommend contrast level
  const isNarrowRange = range < 8;
  let contrastRecommendation: 'low' | 'medium' | 'high' | 'extreme';

  if (range < 3) {
    contrastRecommendation = 'extreme';
  } else if (range < 6) {
    contrastRecommendation = 'high';
  } else if (range < 12) {
    contrastRecommendation = 'medium';
  } else {
    contrastRecommendation = 'low';
  }

  return {
    min,
    max,
    range,
    average,
    median,
    standardDeviation,
    isNarrowRange,
    contrastRecommendation
  };
}

/**
 * Creates a temperature legend for the heatmap
 */
export function createTemperatureLegend(
  heatmapData: WeatherHeatmapData[],
  steps: number = 5
): Array<{ temperature: number; color: string; label: string }> {
  if (heatmapData.length === 0) return [];

  const temperatures = heatmapData.map(data => data.temperature);
  const analysis = analyzeTemperatureData(temperatures);

  const legend = Array.from({ length: steps }, (_, i) => {
    const temp = analysis.min + (analysis.range * i / (steps - 1));
    const matchingData = heatmapData.find(data =>
      Math.abs(data.temperature - temp) < analysis.range / (steps * 2)
    ) || heatmapData[0];

    return {
      temperature: temp,
      color: matchingData.color,
      label: `${temp.toFixed(1)}°C`
    };
  });

  return legend;
}

/**
 * Smooths temperature transitions between hours with enhanced contrast
 */
export function smoothHeatmapTransitions(heatmapData: WeatherHeatmapData[]): WeatherHeatmapData[] {
  if (heatmapData.length <= 2) return heatmapData;

  // Calculate dynamic temperature ranges for the smoothed data
  const temperatures = heatmapData.map(data => data.temperature);
  const tempRanges = calculateDynamicTempRanges(temperatures);

  return heatmapData.map((data, index) => {
    if (index === 0 || index === heatmapData.length - 1) {
      return data;
    }

    const prev = heatmapData[index - 1];
    const next = heatmapData[index + 1];

    // Smooth temperature using weighted average
    const smoothedTemp = (prev.temperature * 0.25 + data.temperature * 0.5 + next.temperature * 0.25);

    // Recalculate color based on smoothed temperature using dynamic mapping
    const color = getTemperatureColorDynamic(smoothedTemp, data.isNight, tempRanges);

    return {
      ...data,
      temperature: smoothedTemp,
      color,
    };
  });
}

/**
 * Generates enhanced heatmap with maximum contrast for narrow temperature ranges
 */
export function generateEnhancedWeatherHeatmap(
  hourlyData: WeatherData[],
  sunrise: number,
  sunset: number,
  options: {
    enhanceNarrowRanges?: boolean;
    contrastMultiplier?: number;
    minContrastThreshold?: number;
  } = {}
): WeatherHeatmapData[] {
  const {
    enhanceNarrowRanges = true,
    contrastMultiplier = 2.0,
    minContrastThreshold = 5.0
  } = options;

  // Extract all temperatures to analyze the range
  const temperatures = hourlyData.map(data => data.temperature);
  const tempRanges = calculateDynamicTempRanges(temperatures);

  // For very narrow ranges, apply additional contrast enhancement
  const isNarrowRange = tempRanges.range < minContrastThreshold;

  console.log(`🌡️ Temperature Analysis:`, {
    range: `${tempRanges.min.toFixed(1)}°C to ${tempRanges.max.toFixed(1)}°C`,
    span: `${tempRanges.range.toFixed(1)}°C`,
    isNarrow: isNarrowRange,
    enhancement: enhanceNarrowRanges && isNarrowRange ? '🎨 EXTREME CONTRAST ACTIVE' : '📊 STANDARD MAPPING',
    segments: tempRanges.segments.length,
    contrastMultiplier: enhanceNarrowRanges && isNarrowRange ? contrastMultiplier : 1.0
  });

  return hourlyData.map((data) => {
    const hour = new Date(data.timestamp * 1000).getHours();
    const isNight = isNightTime(hour, sunrise, sunset);

    let color: string;

    if (enhanceNarrowRanges && isNarrowRange) {
      // For narrow ranges, use extreme contrast enhancement
      color = getExtremeContrastColor(data.temperature, isNight, tempRanges, contrastMultiplier);
    } else {
      // Use standard dynamic color mapping
      color = getTemperatureColorDynamic(data.temperature, isNight, tempRanges);
    }

    // Use enhanced opacity for narrow ranges
    const opacity = calculateOpacity(data.cloudCover, isNight, enhanceNarrowRanges && isNarrowRange);

    return {
      hour,
      temperature: data.temperature,
      color,
      opacity,
      isNight,
    };
  });
}

/**
 * Generates extreme contrast colors for very narrow temperature ranges
 */
function getExtremeContrastColor(
  temperature: number,
  isNight: boolean,
  tempRanges: { min: number; max: number; range: number; segments: number[] },
  contrastMultiplier: number = 2.0
): string {
  // Extreme contrast color palette
  const extremeColors = isNight ? [
    '#000814',  // Almost black
    '#001d3d',  // Very dark blue
    '#003566',  // Dark blue
    '#ffd60a',  // Bright yellow (high contrast)
    '#ffb700',  // Orange
    '#ff8500',  // Dark orange
    '#ff6b00'   // Red-orange
  ] : [
    '#03045e',  // Very dark blue
    '#0077b6',  // Blue
    '#00b4d8',  // Light blue
    '#90e0ef',  // Very light blue
    '#ffd166',  // Yellow
    '#f77f00',  // Orange
    '#d62828'   // Red
  ];

  // Normalize temperature to 0-1 range
  const normalizedTemp = tempRanges.range === 0 ? 0.5 :
    (temperature - tempRanges.min) / tempRanges.range;

  // Apply contrast multiplier to make differences more dramatic
  const enhancedTemp = Math.pow(normalizedTemp, 1 / contrastMultiplier);

  // Map to color index
  const colorIndex = Math.floor(enhancedTemp * (extremeColors.length - 1));
  const nextColorIndex = Math.min(colorIndex + 1, extremeColors.length - 1);

  // Interpolate between colors
  const factor = (enhancedTemp * (extremeColors.length - 1)) - colorIndex;

  return interpolateColor(extremeColors[colorIndex], extremeColors[nextColorIndex], factor);
}

/**
 * Generates a 24-hour heatmap for a specific date with enhanced contrast
 */
export function generate24HourHeatmap(
  weatherData: WeatherData[],
  targetDate: Date,
  sunrise: number,
  sunset: number
): WeatherHeatmapData[] {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Filter weather data for the target date
  const dayWeatherData = weatherData.filter(data => {
    const dataDate = new Date(data.timestamp * 1000);
    return dataDate >= startOfDay && dataDate <= endOfDay;
  });

  // Generate enhanced heatmap data with maximum contrast
  const heatmapData = generateEnhancedWeatherHeatmap(dayWeatherData, sunrise, sunset, {
    enhanceNarrowRanges: true,
    contrastMultiplier: 2.5,
    minContrastThreshold: 10.0
  });

  // Smooth transitions for better visual appeal
  return smoothHeatmapTransitions(heatmapData);
}
