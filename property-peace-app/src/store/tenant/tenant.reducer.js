import { TENANT_ACTION_TYPES } from './tenant.types';

const initialState = {
  tenants: [],
  leaseTenants: [],
  tenantsLoadedAt: null,
  selectedTenant: null,
  loading: false,
  error: null
};

function tenantReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case TENANT_ACTION_TYPES.SET_SELECTED_TENANT:
      return {
        ...state,
        selectedTenant: payload,
        loading: false,
        error: null
      };

    case TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_SUCCESS:
      return {
        ...state,
        tenants: [...state.tenants, payload],
        loading: false,
        error: null
      };

    case TENANT_ACTION_TYPES.ADD_UPDATE_TENANT_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };

    case TENANT_ACTION_TYPES.UPDATE_TENANT_SUCCESS:
      return {
        ...state,
        tenants: state.tenants.map((tenant) => (tenant.id === payload.id ? payload : tenant)),
        selectedTenant: payload,
        loading: false,
        error: null
      };

    case TENANT_ACTION_TYPES.UPDATE_TENANT_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };

    case TENANT_ACTION_TYPES.UPDATE_TENANT_FIELD:
      return {
        ...state,
        selectedTenant: {
          ...state.selectedTenant,
          [payload.name]: payload.value
        }
      };

    case TENANT_ACTION_TYPES.DELETE_TENANT_SUCCESS:
      return {
        ...state,
        tenants: state.tenants.filter((tenant) => tenant.id !== payload),
        selectedTenant: null,
        loading: false,
        error: null
      };

    case TENANT_ACTION_TYPES.GET_TENANTS_START:
      return {
        ...state,
        loading: true
      };

    case TENANT_ACTION_TYPES.GET_TENANTS_SUCCESS:
      return {
        ...state,
        leaseTenants: payload,
        loading: false,
        error: null
      };

    case TENANT_ACTION_TYPES.GET_ALL_TENANTS_SUCCESS:
      return {
        ...state,
        tenants: payload,
        tenantsLoadedAt: Date.now(),
        loading: false,
        error: null
      };

    case TENANT_ACTION_TYPES.GET_TENANTS_FAILED:
    case TENANT_ACTION_TYPES.GET_ALL_TENANTS_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };

    case TENANT_ACTION_TYPES.GET_TENANT_SUCCESS:
      return {
        ...state,
        selectedTenant: payload,
        loading: false,
        error: null
      };

    case TENANT_ACTION_TYPES.GET_TENANT_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };

    case TENANT_ACTION_TYPES.DELETE_TENANT_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload }
      };
    case TENANT_ACTION_TYPES.RESET_STATE:
      return {
        ...initialState
      };
    default:
      return state;
  }
}
export default tenantReducer;
