import { MAINTENANCE_ACTION_TYPES } from './maintenance.types';

const initialState = {
  maintenance: null,
  maintenances: [],
  historyMaintenances: [],
  maintenanceIds: [],
  categories: null,
  selectedMaintenance: null,
  selectedImages: [],
  loading: true,
  error: null
};

function maintenanceReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case MAINTENANCE_ACTION_TYPES.SET_MAINTENANCE:
      return {
        ...state,
        maintenance: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.SET_MAINTENANCE_FIELD:
      return {
        ...state,
        selectedMaintenance: {
          ...state.selectedMaintenance,
          [payload.name]: payload.value
        },
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.SET_SELECTED_MAINTENANCE:
      return {
        ...state,
        selectedMaintenance: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.SET_MAINTENANCE_IMAGES:
      return {
        ...state,
        selectedImages: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.SET_MAINTENANCE_IDS:
      return {
        ...state,
        maintenanceIds: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.ADD_MAINTENANCE_SUCCESS:
      return {
        ...state,
        selectedMaintenance: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.ADD_MAINTENANCE_FAILED:
      return {
        ...state,
        selectedMaintenance: null,
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.UPDATE_MAINTENANCE_SUCCESS:
      return {
        ...state,
        selectedMaintenance: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.UPDATE_MAINTENANCE_FAILED:
      return {
        ...state,
        selectedMaintenance: null,
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.REMOVE_MAINTENANCE_SUCCESS:
      return {
        ...state,
        selectedMaintenance: null,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.REMOVE_MAINTENANCE_FAILED:
      return {
        ...state,
        selectedMaintenance: null,
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.RESOLVE_MAINTENANCE_SUCCESS:
      return {
        ...state,
        selectedMaintenance: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.RESOLVE_MAINTENANCE_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_CATEGORIES_SUCCESS:
      return {
        ...state,
        categories: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_CATEGORIES_FAILED:
      return {
        ...state,
        categories: null,
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_IMAGES_SUCCESS:
      return {
        ...state,
        selectedMaintenance: {
          ...state.selectedMaintenance,
          images: payload
        },
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCE_IMAGES_FAILED:
      return {
        ...state,
        selectedMaintenance: {
          ...state.selectedMaintenance,
          images: null
        },
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_SUCCESS:
      return {
        ...state,
        maintenances: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_FAILED:
      return {
        ...state,
        maintenances: [],
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.GET_CURRENT_MAINTENANCES_SUCCESS:
      return {
        ...state,
        maintenances: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.GET_CURRENT_MAINTENANCES_FAILED:
      return {
        ...state,
        maintenances: [],
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_HISTORY_SUCCESS:
      return {
        ...state,
        historyMaintenances: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.GET_MAINTENANCES_HISTORY_FAILED:
      return {
        ...state,
        historyMaintenances: [],
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.REOPEN_MAINTENANCE_SUCCESS:
      return {
        ...state,
        historyMaintenances: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.REOPEN_MAINTENANCE_FAILED:
      return {
        ...state,
        historyMaintenances: [],
        loading: false,
        error: { ...state.error, payload }
      };

    case MAINTENANCE_ACTION_TYPES.ASSIGN_MAINTENANCE_SUCCESS:
      return {
        ...state,
        maintenances: state.maintenances.map((m) => (m.id === payload?.id ? payload : m)),
        selectedMaintenance: payload,
        loading: false,
        error: null
      };

    case MAINTENANCE_ACTION_TYPES.ASSIGN_MAINTENANCE_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };

    default:
      return state;
  }
}

export default maintenanceReducer;
