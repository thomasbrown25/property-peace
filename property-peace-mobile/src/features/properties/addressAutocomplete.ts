export type PropertyDraft = {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
};

export type GooglePlaceSuggestion = { placeId: string; text: string };

export type GooglePlaceDetails = {
  placeId: string;
  formattedAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
};

export const shouldFetchAddressSuggestions = (input: string) =>
  input.trim().length >= 3;

export const createLatestRequestGate = () => {
  let current = 0;
  return {
    begin: () => ++current,
    isCurrent: (requestId: number) => requestId === current,
    invalidate: () => { current += 1; },
  };
};

export const nextAddressSessionToken = (
  previousInput: string,
  nextInput: string,
  currentToken: string | null,
  createToken: () => string,
): string | null => {
  if (!nextInput.trim()) return null;
  if (!previousInput.trim() && !currentToken) return createToken();
  return currentToken ?? createToken();
};

export const applyGooglePlaceDetails = (
  form: PropertyDraft,
  details: GooglePlaceDetails,
): PropertyDraft => {
  const street = details.streetAddress.trim();
  return {
    ...form,
    name: form.name.trim() || street || form.name,
    address: street || form.address,
    city: details.city.trim() || form.city,
    state: details.state.trim() || form.state,
    zipCode: details.zipCode.trim() || form.zipCode,
  };
};