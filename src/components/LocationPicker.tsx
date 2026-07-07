import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, LocateFixed, Loader2 } from 'lucide-react';
import { searchLocations, type GeocodingResult } from '../services/geocodingService';
import { getCurrentLocation, reverseGeocode } from '../services/weatherService';
import type { Location } from '../types';

interface LocationPickerProps {
  currentLocation: Location | null | undefined;
  onSelect: (location: Location) => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ currentLocation, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reset search state whenever the popover closes, so reopening starts fresh
  useEffect(() => {
    if (isOpen) return;
    setQuery('');
    setResults([]);
    setSearchError(null);
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    const id = setTimeout(async () => {
      try {
        const found = await searchLocations(query);
        setResults(found);
      } catch {
        setSearchError('Search failed. Please try again.');
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const handleSelect = (location: Location) => {
    onSelect(location);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setSearchError(null);
    try {
      const location = await reverseGeocode(await getCurrentLocation());
      handleSelect(location);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Failed to get your location.');
    } finally {
      setIsLocating(false);
    }
  };

  const label = currentLocation?.city && currentLocation?.country
    ? `${currentLocation.city}, ${currentLocation.country}`
    : currentLocation
      ? `${currentLocation.latitude.toFixed(2)}, ${currentLocation.longitude.toFixed(2)}`
      : 'Set location';

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        aria-label="Change location"
      >
        <MapPin size={12} />
        <span>{label}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 z-50">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city..."
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
          >
            {isLocating ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={12} />}
            Use my current location
          </button>

          {searchError && (
            <div className="mt-2 text-xs text-red-500">{searchError}</div>
          )}

          {isSearching && (
            <div className="mt-2 text-xs text-gray-400">Searching...</div>
          )}

          {!isSearching && results.length > 0 && (
            <ul className="mt-2 max-h-48 overflow-auto divide-y divide-gray-100 dark:divide-gray-700">
              {results.map((result, i) => (
                <li key={i}>
                  <button
                    onClick={() => handleSelect(result)}
                    className="w-full text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    {result.name}
                    {result.admin1 ? `, ${result.admin1}` : ''}
                    {result.country ? `, ${result.country}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationPicker;
