import apiClient from '../services/apiClient';
import { ApiResponse } from '../types';
import {
  GooglePlaceDetails,
  GooglePlaceSuggestion,
} from '../features/properties/addressAutocomplete';

type AutocompleteData = { suggestions: GooglePlaceSuggestion[] };

const googlePlacesAPI = {
  async streetView(address: string): Promise<string | null> {
    try {
      const response = await apiClient.get<ApiResponse<string>>('/api/google-places/streetview', { params: { address } });
      return response.data || null;
    } catch {
      return null;
    }
  },
  async autocomplete(
    input: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<GooglePlaceSuggestion[]> {
    const response = await apiClient.post<ApiResponse<AutocompleteData>>(
      '/api/google-places/autocomplete',
      { input, sessionToken },
      { signal },
    );
    return response.data.suggestions;
  },

  async details(
    placeId: string,
    sessionToken: string,
    signal?: AbortSignal,
  ): Promise<GooglePlaceDetails> {
    const path = '/api/google-places/details/' + encodeURIComponent(placeId);
    const response = await apiClient.get<ApiResponse<GooglePlaceDetails>>(
      path,
      { params: { sessionToken }, signal },
    );
    return response.data;
  },
};

export default googlePlacesAPI;