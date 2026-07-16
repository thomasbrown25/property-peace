// src/hooks/usePlacesSuggestions.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPlacesLibrary } from '../googleMaps';

export default function usePlacesSuggestions(opts = {}) {
  const {
    region = 'us',
    language = 'en',
    locationBias,
    locationRestriction,
    includedPrimaryTypes, // e.g. ['street_address']
    debounceMs = 0,
  } = opts;

  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const placesRef = useRef(null);
  const tokenRef = useRef(null);
  const timerRef = useRef();

  const getPlaces = useCallback(async () => {
    if (!placesRef.current) {
      placesRef.current = await loadPlacesLibrary(); // { AutocompleteSuggestion, Place, ... }
    }
    return placesRef.current;
  }, []);

  const ensureToken = useCallback(async () => {
    const places = await getPlaces();
    if (!tokenRef.current) {
      tokenRef.current = new places.AutocompleteSessionToken();
    }
    return tokenRef.current;
  }, [getPlaces]);

  const clear = useCallback(() => setSuggestions([]), []);

  const fetchSuggestions = useCallback(
    async (input) => {
      if (!input || !input.trim()) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const places = await getPlaces();

        // New API
        if (places.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
          try {
            const req = {
              input,
              region,
              language,
              sessionToken: await ensureToken(),
              ...(locationBias ? { locationBias } : {}),
              ...(locationRestriction ? { locationRestriction } : {}),
              ...(includedPrimaryTypes ? { includedPrimaryTypes } : {}),
            };
            const { suggestions: list } =
              await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(req);

            setSuggestions(list || []);
            setLoading(false);
            return;
          } catch (newApiError) {
            // If new API fails, fall through to legacy API
            console.warn('New Places API failed, falling back to legacy API:', newApiError);
          }
        }

        // Fallback to legacy for older keys/envs or if new API fails
        const svc = new places.AutocompleteService();
        // Legacy API: "establishment" cannot be mixed with other types. Use a single type to avoid INVALID_REQUEST.
        const legacyRequest = {
          input,
          sessionToken: await ensureToken(),
          types: ['address'],
        };
        
        const { predictions } = await svc.getPlacePredictions(legacyRequest);
        
        const mapped = (predictions || []).map((p) => ({
          // Minimal shim to keep rendering code simple
          placePrediction: {
            text: { toString: () => p.description },
            placeId: p.place_id,
            place_id: p.place_id, // Also store as place_id for legacy compatibility
            toPlace: () => null, // Will be handled in toPlaceDetails for legacy
          },
          _legacy: p,
        }));
        setSuggestions(mapped);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching place suggestions:', error);
        setSuggestions([]);
        setLoading(false);
      }
    },
    [
      getPlaces,
      ensureToken,
      region,
      language,
      locationBias,
      locationRestriction,
      includedPrimaryTypes,
    ]
  );

  useEffect(() => {
    // Guard against SSR
    if (typeof window === 'undefined') return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(value), debounceMs);
    return () => clearTimeout(timerRef.current);
  }, [value, fetchSuggestions, debounceMs]);

  const toPlaceDetails = useCallback(
    async (
      suggestion,
      fields = ['displayName', 'formattedAddress', 'location', 'addressComponents']
    ) => {
      try {
        // Validate suggestion structure
        if (!suggestion || !suggestion.placePrediction) {
          console.warn('Invalid suggestion structure');
          return null;
        }

        const placePrediction = suggestion.placePrediction;
        
        // Handle legacy API suggestions
        if (suggestion._legacy && placePrediction.place_id) {
          return new Promise((resolve) => {
            const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
            placesService.getDetails(
              {
                placeId: placePrediction.place_id,
                fields: ['formatted_address', 'address_components', 'geometry', 'name', 'photos']
              },
              (place, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                  // Convert legacy place to new API format
                  const convertedPlace = {
                    formattedAddress: place.formatted_address,
                    displayName: place.name,
                    location: place.geometry?.location,
                    addressComponents: place.address_components,
                    photos: place.photos,
                    fetchFields: async () => {} // No-op for legacy
                  };
                  resolve(convertedPlace);
                } else {
                  console.warn('Failed to get place details from legacy API:', status);
                  resolve(null);
                }
              }
            );
          });
        }
        
        // Handle new API suggestions
        const toPlace = placePrediction.toPlace;
        
        if (!toPlace || typeof toPlace !== 'function') return null;

        let place;
        try {
          // Call toPlace with the correct 'this' context by calling it on placePrediction
          // This ensures the method has access to placeId and other properties
          place = placePrediction.toPlace(); // Call directly on placePrediction to preserve 'this' context
        } catch (toPlaceError) {
          console.error('Error calling toPlace():', toPlaceError);
          if (process.env.NODE_ENV === 'development') {
            console.error('Suggestion object:', suggestion);
            console.error('PlacePrediction object:', placePrediction);
          }
          return null;
        }

        if (!place) return null;
        
        await place.fetchFields({ fields }); // promise
        return place;
      } catch (error) {
        console.error('Error in toPlaceDetails:', error);
        return null;
      }
    },
    []
  );

  const resetSession = useCallback(() => {
    tokenRef.current = null; // start a new billing session next time
  }, []);

  return { value, setValue, suggestions, loading, clear, toPlaceDetails, resetSession };
}
