import React, { useEffect, useState } from 'react';
import type { WeatherHeatmapData, WeatherForecast } from '../types';
import { createHeatmapGradient } from '../utils/weatherHeatmap';

interface WeatherHeatmapBackgroundProps {
  heatmapData?: WeatherHeatmapData[];
  weatherData?: WeatherForecast | null;
  className?: string;
}

const WeatherHeatmapBackground: React.FC<WeatherHeatmapBackgroundProps> = ({
  heatmapData,
  weatherData,
  className = '',
}) => {
  const [currentGradient, setCurrentGradient] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!heatmapData || heatmapData.length === 0) {
      // Default gradient when no weather data is available
      setCurrentGradient('linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
      return;
    }

    // Create the gradient from heatmap data
    const gradient = createHeatmapGradient(heatmapData);
    
    // Animate gradient changes
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentGradient(gradient);
      setIsAnimating(false);
    }, 150);
  }, [heatmapData]);

  // Create animated particles for visual interest
  const renderParticles = () => {
    if (!weatherData?.current) return null;

    const particleCount = Math.min(weatherData.current.cloudCover / 10, 20);
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const delay = Math.random() * 10;
      const duration = 15 + Math.random() * 10;
      const size = 2 + Math.random() * 4;
      const opacity = 0.1 + Math.random() * 0.2;

      particles.push(
        <div
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity,
            animation: `float ${duration}s ease-in-out infinite ${delay}s`,
          }}
        />
      );
    }

    return particles;
  };

  // Create weather-based overlay patterns
  const getWeatherOverlay = () => {
    if (!weatherData?.current) return null;

    const { condition, windSpeed } = weatherData.current;
    
    // Different patterns based on weather conditions
    switch (condition.main.toLowerCase()) {
      case 'rain':
        return (
          <div className="absolute inset-0 opacity-20">
            <div 
              className="absolute inset-0"
              style={{
                background: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 2px,
                  rgba(59, 130, 246, 0.1) 2px,
                  rgba(59, 130, 246, 0.1) 4px
                )`,
                animation: 'rain 2s linear infinite',
              }}
            />
          </div>
        );
      
      case 'snow':
        return (
          <div className="absolute inset-0 opacity-30">
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `snow ${3 + Math.random() * 2}s linear infinite ${Math.random() * 3}s`,
                }}
              />
            ))}
          </div>
        );
      
      case 'clouds':
        return (
          <div className="absolute inset-0 opacity-20">
            <div 
              className="absolute inset-0"
              style={{
                background: `radial-gradient(
                  ellipse at ${20 + Math.random() * 60}% ${20 + Math.random() * 60}%,
                  rgba(255, 255, 255, 0.3) 0%,
                  transparent 50%
                ),
                radial-gradient(
                  ellipse at ${20 + Math.random() * 60}% ${20 + Math.random() * 60}%,
                  rgba(255, 255, 255, 0.2) 0%,
                  transparent 60%
                )`,
                animation: `clouds ${20 + windSpeed}s ease-in-out infinite`,
              }}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        @keyframes rain {
          0% { transform: translateY(-100vh) translateX(0); }
          100% { transform: translateY(100vh) translateX(-50px); }
        }
        
        @keyframes snow {
          0% { transform: translateY(-100vh) translateX(0) rotate(0deg); }
          100% { transform: translateY(100vh) translateX(100px) rotate(360deg); }
        }
        
        @keyframes clouds {
          0%, 100% { transform: translateX(-10px); }
          50% { transform: translateX(10px); }
        }
        
        @keyframes gradientShift {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {/* Main Background */}
      <div 
        className={`fixed inset-0 z-0 transition-all duration-1000 ${
          isAnimating ? 'opacity-80' : 'opacity-100'
        } ${className}`}
        style={{
          background: currentGradient,
          animation: 'gradientShift 30s ease-in-out infinite',
        }}
      >
        {/* Animated particles */}
        {renderParticles()}
        
        {/* Weather-specific overlays */}
        {getWeatherOverlay()}
        
        {/* Subtle noise texture for depth */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10" />
      </div>
    </>
  );
};

export default WeatherHeatmapBackground;
