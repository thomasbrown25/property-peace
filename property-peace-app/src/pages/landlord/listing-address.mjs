// Google Places returns longText/shortText (new API) or long_name/short_name (legacy API).
export function parseListingAddress(place) {
  const components = place?.addressComponents || [];
  const find = (type, short = false) => {
    const item = components.find((part) => part.types?.includes(type));
    return (short ? item?.shortText ?? item?.short_name : item?.longText ?? item?.long_name) || '';
  };
  return {
    streetAddress: [find('street_number'), find('route')].filter(Boolean).join(' '),
    unit: find('subpremise'),
    city: find('locality') || find('postal_town') || find('sublocality_level_1'),
    state: find('administrative_area_level_1', true),
    zipCode: [find('postal_code'), find('postal_code_suffix')].filter(Boolean).join('-'),
    country: find('country', true)
  };
}
