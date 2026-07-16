import { UNIT_ACTION_TYPES } from './unit.types';

const initialState = {
  units: [],
  selectedUnit: {},
  selectedUnits: [],
  selectedUnitIds: [],
  loading: true,
  error: null,
};

function unitReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case UNIT_ACTION_TYPES.SET_UNIT:
      return {
        ...state,
        selectedUnit: payload,
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.SET_UNITS:
      return {
        ...state,
        selectedUnits: payload,
        loading: false,
        error: null,
      };
    case UNIT_ACTION_TYPES.SET_UNIT_IDS:
      return {
        ...state,
        selectedUnitIds: payload,
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.SET_UNIT_FIELD:
      return {
        ...state,
        selectedUnit: { ...state.selectedUnit, [payload.name]: payload.value },
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.ADD_UNIT_SUCCESS:
      return {
        ...state,
        units: [...state.units, payload],
        selectedUnit: payload,
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.ADD_UNIT_FAILED:
      return {
        ...state,
        loading: false,
        error: payload,
      };

    case UNIT_ACTION_TYPES.GET_UNITS_SUCCESS:
      return {
        ...state,
        units: payload,
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.GET_UNITS_FAILED:
      return {
        ...state,
        units: [],
        loading: false,
        error: payload,
      };

    case UNIT_ACTION_TYPES.UPDATE_UNIT_SUCCESS:
      return {
        ...state,
        units: payload,
        selectedUnit: null,
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.UPDATE_UNIT_FAILED:
      return {
        ...state,
        loading: false,
        error: payload,
      };

    case UNIT_ACTION_TYPES.DELETE_UNIT_SUCCESS:
      return {
        ...state,
        units: state.units.filter((unit) => unit.id !== payload),
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.DELETE_UNIT_FAILED:
      return {
        ...state,
        loading: false,
        error: payload,
      };

    case UNIT_ACTION_TYPES.BULK_CREATE_UNITS_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case UNIT_ACTION_TYPES.BULK_CREATE_UNITS_SUCCESS:
      return {
        ...state,
        units: [...state.units, ...payload],
        loading: false,
        error: null,
      };

    case UNIT_ACTION_TYPES.BULK_CREATE_UNITS_FAILED:
      return {
        ...state,
        loading: false,
        error: payload,
      };

    default:
      return state;
  }
}

export default unitReducer;
