import { loadMaps } from 'googleMaps';

const API_KEY = import.meta.env.VITE_APP_GOOGLE_MAPS_API_KEY;

/**
 * Build full address string from components
 */
export function buildFullAddress(streetAddress, city, state, zipCode) {
  const parts = [streetAddress, city, state, zipCode].filter(Boolean).map((s) => String(s).trim());
  return parts.join(', ');
}

/**
 * Parse Geocoder address_components into street, city, state, zip
 */
function parseAddressComponents(components) {
  if (!components || !Array.isArray(components)) {
    return { streetAddress: '', city: '', state: '', zipCode: '' };
  }

  let streetNumber = '';
  let route = '';
  let city = '';
  let state = '';
  let zipCode = '';

  for (const c of components) {
    const types = c.types || [];
    const longName = c.long_name || '';
    const shortName = c.short_name || '';

    if (types.includes('street_number')) streetNumber = longName || shortName;
    else if (types.includes('route')) route = longName || shortName;
    else if (types.includes('locality') || types.includes('sublocality') || types.includes('sublocality_level_1')) {
      if (!city) city = longName || shortName;
    } else if (types.includes('administrative_area_level_1')) {
      if (!state) state = shortName || longName;
    } else if (types.includes('postal_code')) {
      if (!zipCode) zipCode = longName || shortName;
    }
  }

  const streetAddress = [streetNumber, route].filter(Boolean).join(' ').trim();
  return { streetAddress, city, state, zipCode };
}

/**
 * Geocode an address using Google Maps Geocoder.
 * Returns parsed address components and formatted address, or null if not found.
 */
export async function geocodeAddress(streetAddress, city, state, zipCode) {
  try {
    const google = await loadMaps();
    const geocoder = new google.maps.Geocoder();
    const fullAddress = buildFullAddress(streetAddress, city, state, zipCode);

    return new Promise((resolve) => {
      geocoder.geocode({ address: fullAddress }, (results, status) => {
        if (status !== 'OK' || !results?.[0]) {
          resolve(null);
          return;
        }
        const result = results[0];
        const parsed = parseAddressComponents(result.address_components);
        const formattedAddress = result.formatted_address || fullAddress;
        resolve({
          ...parsed,
          formattedAddress
        });
      });
    });
  } catch (err) {
    console.warn('Geocode error:', err);
    return null;
  }
}

/**
 * Check if Street View imagery exists at the given address
 */
async function checkStreetViewMetadata(address) {
  if (!API_KEY) return false;
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encoded}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.status === 'OK';
  } catch (err) {
    console.warn('Street View metadata check error:', err);
    return false;
  }
}

/**
 * Get Street View image URL for an address
 */
function getStreetViewImageUrl(address, width = 800, height = 600) {
  if (!API_KEY) return null;
  const encoded = encodeURIComponent(address);
  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encoded}&key=${API_KEY}`;
}

/**
 * Fetch a property image from Google (Street View) for the given address.
 * Returns a File suitable for upload, or null if no imagery exists (use placeholder).
 */
export async function fetchPropertyImageFromAddress(address) {
  if (!address || !address.trim()) return null;

  const fullAddress = typeof address === 'string' ? address : buildFullAddress(
    address.streetAddress,
    address.city,
    address.state,
    address.zipCode
  );

  const hasImagery = await checkStreetViewMetadata(fullAddress);
  if (!hasImagery) return null;

  const imageUrl = getStreetViewImageUrl(fullAddress);
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const file = new File([blob], 'property-image.jpg', { type: blob.type || 'image/jpeg' });
    return file;
  } catch (err) {
    console.warn('Error fetching Street View image:', err);
    return null;
  }
}
