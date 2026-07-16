import { useState, useCallback } from 'react';
import { loadPlacesLibrary } from 'googleMaps';

const API_KEY = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;

/**
 * Generate a Google Street View Static API URL for an address
 * @param {string} address - The full address
 * @param {number} width - Image width (default: 800)
 * @param {number} height - Image height (default: 600)
 * @returns {string} Street View Static API URL
 */
function getStreetViewUrl(address, width = 800, height = 600) {
  if (!API_KEY) {
    console.warn('Google Maps API key not found');
    return null;
  }
  
  // Encode the address for the URL
  const encodedAddress = encodeURIComponent(address);
  
  // Street View Static API URL
  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encodedAddress}&key=${API_KEY}`;
}

/**
 * Generate a Google Street View Static API URL using lat/lng coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} width - Image width (default: 800)
 * @param {number} height - Image height (default: 600)
 * @returns {string} Street View Static API URL
 */
function getStreetViewUrlFromCoords(lat, lng, width = 800, height = 600) {
  if (!API_KEY) {
    console.warn('Google Maps API key not found');
    return null;
  }
  
  // Street View Static API URL with coordinates
  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lng}&key=${API_KEY}`;
}

export function useGooglePlacePhotos() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPhotosFromPlace = useCallback(async (place, address = null) => {
    setLoading(true);
    setError(null);

    try {
      let photoUrl = null;
      let photoSource = null; // 'streetview' or 'places'

      // First, try to get Street View image (better coverage)
      try {
        // Try to get location from place object
        let streetViewUrl = null;
        
        if (place?.location) {
          const loc = place.location;
          const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
          
          if (typeof lat === 'number' && typeof lng === 'number') {
            streetViewUrl = getStreetViewUrlFromCoords(lat, lng);
          }
        }
        
        // If we have an address but no coordinates, use address
        if (!streetViewUrl && address) {
          streetViewUrl = getStreetViewUrl(address);
        }
        
        // If we have formatted address from place, use that
        if (!streetViewUrl && place?.formattedAddress) {
          streetViewUrl = getStreetViewUrl(place.formattedAddress);
        }
        
        if (streetViewUrl) {
          // Test if Street View image exists by trying to load it
          // Note: Street View API returns an image even if no imagery exists (shows error image)
          // We'll use it anyway and let the user decide
          photoUrl = streetViewUrl;
          photoSource = 'streetview';
        }
      } catch (err) {
        console.warn('Error generating Street View URL:', err);
      }

      // If no Street View URL, fallback to Google Places photos
      if (!photoUrl && place) {
        try {
          // Check if photos are already available (they might have been fetched in toPlaceDetails)
          let hasPhotos = place.photos && place.photos.length > 0;
          
          // If photos aren't available, try to fetch them
          if (!hasPhotos && typeof place.fetchFields === 'function') {
            try {
              await place.fetchFields({ fields: ['photos'] });
              hasPhotos = place.photos && place.photos.length > 0;
            } catch (fetchError) {
              console.warn('Error fetching photos field (may already be loaded):', fetchError);
            }
          }

          if (hasPhotos) {
            // Get the first photo (usually the best one)
            const photo = place.photos[0];
            
            // Get photo URI with max dimensions
            if (typeof photo.getURI === 'function') {
              photoUrl = photo.getURI({ maxWidth: 800, maxHeight: 800 });
              photoSource = 'places';
            }
          }
        } catch (err) {
          console.warn('Error fetching Google Places photos:', err);
        }
      }

      return photoUrl ? { url: photoUrl, source: photoSource } : null;
    } catch (err) {
      console.error('Error fetching property photos:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchPhotosFromPlace, loading, error };
}

