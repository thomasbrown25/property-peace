import { PROPERTY_ACTION_TYPES } from './property.types';

const initialState = {
  properties: [],
  propertiesLoadedAt: null,
  selectedProperty: null,
  selectedPropertyIds: [],
  isSingleUnitPortfolio: true,
  updatedProperty: null,
  occupiedCount: 0,
  vacantCount: 0,
  loading: true,
  error: null
};

function propertyReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case PROPERTY_ACTION_TYPES.UPDATE_PROPERTY_FIELD:
      return {
        ...state,
        selectedProperty: {
          ...state.selectedProperty,
          [payload.name]: payload.value
        },
        error: null
      };

    case PROPERTY_ACTION_TYPES.SET_PROPERTY:
      return {
        ...state,
        selectedProperty: payload
      };

    case PROPERTY_ACTION_TYPES.SET_PROPERTY_FIELD:
      return {
        ...state,
        selectedProperty: { ...state.selectedProperty, [payload.name]: payload.value },
        error: null
      };

    case PROPERTY_ACTION_TYPES.SET_PROPERTY_IDS:
      return {
        ...state,
        selectedPropertyIds: payload
      };

    case PROPERTY_ACTION_TYPES.GET_PROPERTIES_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case PROPERTY_ACTION_TYPES.GET_PROPERTIES_SUCCESS:
      return {
        ...state,
        properties: payload,
        propertiesLoadedAt: Date.now(),
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.GET_PROPERTIES_FAILED:
      return {
        ...state,
        properties: [],
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.GET_PROPERTY_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case PROPERTY_ACTION_TYPES.GET_PROPERTY_SUCCESS:
      return {
        ...state,
        selectedProperty: payload,
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.GET_PROPERTY_FAILED:
      return {
        ...state,
        selectedProperty: null,
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.ADD_PROPERTY_SUCCESS:
      return {
        ...state,
        properties: [...state.properties, payload],
        selectedProperty: payload,
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.ADD_PROPERTY_FAILED:
      return {
        ...state,
        properties: state.properties,
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.UPDATE_PROPERTY_SUCCESS:
      return {
        ...state,
        properties: state.properties.map((property) => (property.id === payload.id ? payload : property)),
        selectedProperty: payload,
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.UPDATE_PROPERTY_FAILED:
      return {
        ...state,
        properties: state.properties,
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.UPDATE_MAINTENANCE_FIELD:
      return {
        ...state,
        selectedProperty: {
          ...state.selectedProperty,
          selectedMaintenance: {
            ...state.selectedProperty?.selectedMaintenance,
            [payload.name]: payload.value
          }
        },
        error: null
      };

    case PROPERTY_ACTION_TYPES.ADD_MAINTENANCE_SUCCESS:
      return {
        ...state,
        selectedProperty: {
          ...state.selectedProperty,
          selectedMaintenance: payload
        },
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.ADD_MAINTENANCE_FAILED:
      return {
        ...state,
        selectedProperty: {
          ...state.selectedProperty,
          selectedMaintenance: null
        },
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.REMOVE_MAINTENANCE_SUCCESS:
      return {
        ...state,
        selectedProperty: {
          ...state.selectedProperty
        },
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.REMOVE_MAINTENANCE_FAILED:
      return {
        ...state,
        selectedProperty: {
          ...state.selectedProperty,
          selectedMaintenance: null
        },
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.SET_SELECTED_MAINTENANCE:
      return {
        ...state,
        selectedProperty: {
          ...state.selectedProperty,
          selectedMaintenance: payload
        },
        error: null
      };

    case PROPERTY_ACTION_TYPES.GET_OCCUPIED_COUNT_SUCCESS:
      return {
        ...state,
        occupiedCount: payload,
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.GET_OCCUPIED_COUNT_FAILED:
      return {
        ...state,
        occupiedCount: 0,
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.GET_VACANT_COUNT_SUCCESS:
      return {
        ...state,
        vacantCount: payload,
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.GET_VACANT_COUNT_FAILED:
      return {
        ...state,
        vacantCount: 0,
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.DELETE_PROPERTY_SUCCESS:
      return {
        ...state,
        properties: state.properties.filter((property) => property.id !== payload.id),
        loading: false,
        error: null
      };

    case PROPERTY_ACTION_TYPES.DELETE_PROPERTY_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };

    case PROPERTY_ACTION_TYPES.IS_SINGLE_UNIT_PORTFOLIO_SUCCESS:
      return {
        ...state,
        isSingleUnitPortfolio: payload
      };

    case PROPERTY_ACTION_TYPES.IS_SINGLE_UNIT_PORTFOLIO_FAILED:
      return {
        ...state,
        isSingleUnitPortfolio: false,
        error: { ...state.error, payload }
      };

    default:
      return state;
  }
}

export default propertyReducer;
