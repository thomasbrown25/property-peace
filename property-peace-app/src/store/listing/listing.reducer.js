import { LISTING_ACTION_TYPES } from './listing.types';

const initialState = {
  listings: [],
  selectedListing: null,
  loading: false,
  error: null
};

function listingReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case LISTING_ACTION_TYPES.GET_LISTINGS_START:
    case LISTING_ACTION_TYPES.GET_LISTING_START:
    case LISTING_ACTION_TYPES.CREATE_LISTING_START:
    case LISTING_ACTION_TYPES.UPDATE_LISTING_START:
    case LISTING_ACTION_TYPES.DELETE_LISTING_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case LISTING_ACTION_TYPES.GET_LISTINGS_SUCCESS:
      return {
        ...state,
        listings: payload,
        loading: false,
        error: null
      };

    case LISTING_ACTION_TYPES.GET_LISTING_SUCCESS:
      return {
        ...state,
        selectedListing: payload,
        loading: false,
        error: null
      };

    case LISTING_ACTION_TYPES.CREATE_LISTING_SUCCESS:
      return {
        ...state,
        listings: [payload, ...state.listings],
        selectedListing: payload,
        loading: false,
        error: null
      };

    case LISTING_ACTION_TYPES.UPDATE_LISTING_SUCCESS:
      return {
        ...state,
        listings: state.listings.map(listing =>
          listing.id === payload.id ? payload : listing
        ),
        selectedListing: payload,
        loading: false,
        error: null
      };

    case LISTING_ACTION_TYPES.DELETE_LISTING_SUCCESS:
      return {
        ...state,
        listings: state.listings.filter(listing => listing.id !== payload),
        selectedListing: state.selectedListing?.id === payload ? null : state.selectedListing,
        loading: false,
        error: null
      };

    case LISTING_ACTION_TYPES.GET_LISTINGS_FAILED:
    case LISTING_ACTION_TYPES.GET_LISTING_FAILED:
    case LISTING_ACTION_TYPES.CREATE_LISTING_FAILED:
    case LISTING_ACTION_TYPES.UPDATE_LISTING_FAILED:
    case LISTING_ACTION_TYPES.DELETE_LISTING_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case LISTING_ACTION_TYPES.SET_SELECTED_LISTING:
      return {
        ...state,
        selectedListing: payload
      };

    case LISTING_ACTION_TYPES.CLEAR_SELECTED_LISTING:
      return {
        ...state,
        selectedListing: null
      };

    default:
      return state;
  }
}

export default listingReducer;
