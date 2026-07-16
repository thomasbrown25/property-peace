import { VENDOR_ACTION_TYPES } from './vendor.types';

const initialState = {
  vendors: [],
  selectedVendor: null,
  loading: false,
  error: null,
  searchResults: []
};

function vendorReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case VENDOR_ACTION_TYPES.GET_VENDORS_START:
    case VENDOR_ACTION_TYPES.GET_VENDOR_START:
    case VENDOR_ACTION_TYPES.ADD_VENDOR_START:
    case VENDOR_ACTION_TYPES.UPDATE_VENDOR_START:
    case VENDOR_ACTION_TYPES.DELETE_VENDOR_START:
    case VENDOR_ACTION_TYPES.SEARCH_VENDORS_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case VENDOR_ACTION_TYPES.GET_VENDORS_SUCCESS:
      return {
        ...state,
        vendors: payload,
        loading: false,
        error: null
      };

    case VENDOR_ACTION_TYPES.GET_VENDOR_SUCCESS:
      return {
        ...state,
        selectedVendor: payload,
        loading: false,
        error: null
      };

    case VENDOR_ACTION_TYPES.ADD_VENDOR_SUCCESS:
      return {
        ...state,
        vendors: [...state.vendors, payload],
        selectedVendor: payload,
        loading: false,
        error: null
      };

    case VENDOR_ACTION_TYPES.UPDATE_VENDOR_SUCCESS:
      return {
        ...state,
        vendors: state.vendors.map((vendor) => (vendor.id === payload.id ? payload : vendor)),
        selectedVendor: payload,
        loading: false,
        error: null
      };

    case VENDOR_ACTION_TYPES.DELETE_VENDOR_SUCCESS:
      return {
        ...state,
        vendors: state.vendors.filter((vendor) => vendor.id !== payload),
        selectedVendor: state.selectedVendor?.id === payload ? null : state.selectedVendor,
        loading: false,
        error: null
      };

    case VENDOR_ACTION_TYPES.SEARCH_VENDORS_SUCCESS:
      return {
        ...state,
        searchResults: payload,
        loading: false,
        error: null
      };

    case VENDOR_ACTION_TYPES.GET_VENDORS_FAILED:
    case VENDOR_ACTION_TYPES.GET_VENDOR_FAILED:
    case VENDOR_ACTION_TYPES.ADD_VENDOR_FAILED:
    case VENDOR_ACTION_TYPES.UPDATE_VENDOR_FAILED:
    case VENDOR_ACTION_TYPES.DELETE_VENDOR_FAILED:
    case VENDOR_ACTION_TYPES.SEARCH_VENDORS_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case VENDOR_ACTION_TYPES.RESET_STATE:
      return initialState;

    default:
      return state;
  }
}

export default vendorReducer;

