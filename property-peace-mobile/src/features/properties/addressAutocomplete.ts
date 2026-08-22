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

export type AddressAutocompleteState = {
  input: string;
  suggestions: GooglePlaceSuggestion[];
  loading: boolean;
  open: boolean;
  error: string;
};

export const initialAddressAutocompleteState: AddressAutocompleteState = {
  input: '',
  suggestions: [],
  loading: false,
  open: false,
  error: '',
};

export type AddressAutocompleteAction =
  | { type: 'inputChanged'; value: string }
  | { type: 'requestStarted' }
  | { type: 'requestSucceeded'; suggestions: GooglePlaceSuggestion[] }
  | { type: 'requestFailed'; message: string }
  | { type: 'closed' };

export const addressAutocompleteReducer = (
  state: AddressAutocompleteState,
  action: AddressAutocompleteAction,
): AddressAutocompleteState => {
  switch (action.type) {
    case 'inputChanged':
      return {
        ...state,
        input: action.value,
        suggestions: [],
        loading: false,
        open: false,
        error: '',
      };
    case 'requestStarted':
      return {
        ...state,
        suggestions: [],
        loading: true,
        open: true,
        error: '',
      };
    case 'requestSucceeded':
      return {
        ...state,
        suggestions: action.suggestions,
        loading: false,
        open: action.suggestions.length > 0,
        error: '',
      };
    case 'requestFailed':
      return {
        ...state,
        suggestions: [],
        loading: false,
        open: false,
        error: action.message,
      };
    case 'closed':
      return { ...state, suggestions: [], loading: false, open: false };
  }
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