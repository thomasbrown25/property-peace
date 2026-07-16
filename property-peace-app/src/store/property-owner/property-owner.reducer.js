import { PROPERTY_OWNER_ACTION_TYPES } from './property-owner.types';

const initialState = {
  owners: [],
  selectedOwner: null,
  loading: false,
  error: null
};

function propertyOwnerReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case PROPERTY_OWNER_ACTION_TYPES.GET_OWNERS_START:
    case PROPERTY_OWNER_ACTION_TYPES.GET_OWNER_START:
    case PROPERTY_OWNER_ACTION_TYPES.ADD_OWNER_START:
    case PROPERTY_OWNER_ACTION_TYPES.UPDATE_OWNER_START:
    case PROPERTY_OWNER_ACTION_TYPES.DELETE_OWNER_START:
    case PROPERTY_OWNER_ACTION_TYPES.LINK_PROPERTY_START:
    case PROPERTY_OWNER_ACTION_TYPES.UNLINK_PROPERTY_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case PROPERTY_OWNER_ACTION_TYPES.GET_OWNERS_SUCCESS:
      return {
        ...state,
        owners: payload,
        loading: false,
        error: null
      };

    case PROPERTY_OWNER_ACTION_TYPES.GET_OWNER_SUCCESS:
      return {
        ...state,
        selectedOwner: payload,
        loading: false,
        error: null
      };

    case PROPERTY_OWNER_ACTION_TYPES.ADD_OWNER_SUCCESS:
      return {
        ...state,
        owners: [...state.owners, payload],
        selectedOwner: payload,
        loading: false,
        error: null
      };

    case PROPERTY_OWNER_ACTION_TYPES.UPDATE_OWNER_SUCCESS:
      return {
        ...state,
        owners: state.owners.map((owner) => (owner.id === payload.id ? payload : owner)),
        selectedOwner: payload,
        loading: false,
        error: null
      };

    case PROPERTY_OWNER_ACTION_TYPES.DELETE_OWNER_SUCCESS:
      return {
        ...state,
        owners: state.owners.filter((owner) => owner.id !== payload),
        selectedOwner: state.selectedOwner?.id === payload ? null : state.selectedOwner,
        loading: false,
        error: null
      };

    case PROPERTY_OWNER_ACTION_TYPES.LINK_PROPERTY_SUCCESS:
    case PROPERTY_OWNER_ACTION_TYPES.UNLINK_PROPERTY_SUCCESS:
      // Refresh the owner data after linking/unlinking
      return {
        ...state,
        owners: state.owners.map((owner) =>
          owner.id === payload.ownerId
            ? { ...owner, propertyCount: payload.data?.propertyCount ?? owner.propertyCount }
            : owner
        ),
        selectedOwner:
          state.selectedOwner?.id === payload.ownerId
            ? { ...state.selectedOwner, propertyCount: payload.data?.propertyCount ?? state.selectedOwner.propertyCount }
            : state.selectedOwner,
        loading: false,
        error: null
      };

    case PROPERTY_OWNER_ACTION_TYPES.GET_OWNERS_FAILED:
    case PROPERTY_OWNER_ACTION_TYPES.GET_OWNER_FAILED:
    case PROPERTY_OWNER_ACTION_TYPES.ADD_OWNER_FAILED:
    case PROPERTY_OWNER_ACTION_TYPES.UPDATE_OWNER_FAILED:
    case PROPERTY_OWNER_ACTION_TYPES.DELETE_OWNER_FAILED:
    case PROPERTY_OWNER_ACTION_TYPES.LINK_PROPERTY_FAILED:
    case PROPERTY_OWNER_ACTION_TYPES.UNLINK_PROPERTY_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case PROPERTY_OWNER_ACTION_TYPES.RESET_STATE:
      return initialState;

    default:
      return state;
  }
}

export default propertyOwnerReducer;
