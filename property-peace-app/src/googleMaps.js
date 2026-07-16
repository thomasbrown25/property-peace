// src/googleMaps.js (pure JS)
import { Loader } from '@googlemaps/js-api-loader';

const API_KEY = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
  console.error('Missing Google Maps key — check build-time env.');
}

let mapsPromise = null; // resolves when window.google is ready
let placesPromise = null; // resolves to PlacesLibrary

export function loadMaps() {
  // Never run on the server
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps must be loaded in the browser'));
  }
  if (!mapsPromise) {
    const loader = new Loader({
      apiKey: API_KEY,
      version: 'weekly',
      libraries: ['places', 'geometry']
    });

    mapsPromise = loader.load().then(() => {
      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps failed to load');
      }
      return window.google; // <-- safe now
    });
  }
  return mapsPromise;
}

export async function loadPlacesLibrary() {
  await loadMaps(); // ensure window.google exists
  if (!placesPromise) {
    placesPromise = window.google.maps.importLibrary('places'); // Promise<PlacesLibrary>
  }
  return placesPromise;
}
