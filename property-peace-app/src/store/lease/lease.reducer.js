import { LEASE_ACTION_TYPES } from './lease.types';

const initialState = {
  leases: [],
  selectedLease: null,
  loading: true,
  error: null,
};

function leaseReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case LEASE_ACTION_TYPES.SET_LEASE:
      return {
        ...state,
        selectedLease: payload,
        loading: false,
        error: null,
      };

    case LEASE_ACTION_TYPES.SET_LEASE_FIELD:
      return {
        ...state,
        selectedLease: { ...state.selectedLease, [payload.name]: payload.value },
      };

    case LEASE_ACTION_TYPES.ADD_LEASE_SUCCESS:
      return {
        ...state,
        leases: [...state.leases, payload],
        loading: false,
        error: null,
      };

    case LEASE_ACTION_TYPES.ADD_LEASE_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload },
      };

    case LEASE_ACTION_TYPES.UPDATE_LEASE_SUCCESS:
      return {
        ...state,
        leases: state.leases.map((lease) => (lease.id === payload.id ? payload : lease)),
        selectedLease: payload,
        loading: false,
        error: null,
      };

    case LEASE_ACTION_TYPES.UPDATE_LEASE_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload },
      };

    case LEASE_ACTION_TYPES.UPDATE_LEASE_FIELD:
      return {
        ...state,
        selectedLease: {
          ...state.selectedLease,
          [payload.name]: payload.value,
        },
      };

    case LEASE_ACTION_TYPES.DELETE_LEASE_SUCCESS:
      return {
        ...state,
        leases: state.leases.filter((lease) => lease.id !== payload),
        selectedLease: null,
        loading: false,
        error: null,
      };

    case LEASE_ACTION_TYPES.GET_LEASES_START:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case LEASE_ACTION_TYPES.GET_LEASES_SUCCESS:
      return {
        ...state,
        leases: payload,
        loading: false,
        error: null,
      };

    case LEASE_ACTION_TYPES.GET_LEASES_FAILED:
      return {
        ...state,
        leases: [],
        loading: false,
        error: { ...state.error, payload },
      };

    case LEASE_ACTION_TYPES.GET_LEASE_SUCCESS:
      return {
        ...state,
        selectedLease: payload,
        loading: false,
        error: null,
      };

    case LEASE_ACTION_TYPES.GET_LEASE_FAILED:
      return {
        ...state,
        selectedLease: null,
        loading: false,
        error: { ...state.error, payload },
      };

    case LEASE_ACTION_TYPES.DELETE_LEASE_FAILED:
      return {
        ...state,
        loading: false,
        error: { ...state.error, payload },
      };

    case LEASE_ACTION_TYPES.SEND_LEASE_FOR_SIGNATURE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case LEASE_ACTION_TYPES.SEND_LEASE_FOR_SIGNATURE_SUCCESS:
      return {
        ...state,
        selectedLease: state.selectedLease?.id === payload.leaseId
          ? { ...state.selectedLease, leaseAgreement: { ...state.selectedLease.leaseAgreement, ...payload.signatureData } }
          : state.selectedLease,
        leases: state.leases.map(lease =>
          lease.id === payload.leaseId
            ? { ...lease, leaseAgreement: { ...lease.leaseAgreement, ...payload.signatureData } }
            : lease
        ),
        loading: false,
        error: null
      };

    case LEASE_ACTION_TYPES.SEND_LEASE_FOR_SIGNATURE_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case LEASE_ACTION_TYPES.GET_LEASE_SIGNATURE_STATUS_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case LEASE_ACTION_TYPES.GET_LEASE_SIGNATURE_STATUS_SUCCESS:
      return {
        ...state,
        selectedLease: state.selectedLease?.id === payload.leaseId
          ? { ...state.selectedLease, leaseAgreement: { ...state.selectedLease.leaseAgreement, ...payload.signatureData } }
          : state.selectedLease,
        leases: state.leases.map(lease =>
          lease.id === payload.leaseId
            ? { ...lease, leaseAgreement: { ...lease.leaseAgreement, ...payload.signatureData } }
            : lease
        ),
        loading: false,
        error: null
      };

    case LEASE_ACTION_TYPES.GET_LEASE_SIGNATURE_STATUS_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case LEASE_ACTION_TYPES.CANCEL_LEASE_SIGNATURE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case LEASE_ACTION_TYPES.CANCEL_LEASE_SIGNATURE_SUCCESS:
      return {
        ...state,
        selectedLease: state.selectedLease?.id === payload.leaseId
          ? { ...state.selectedLease, leaseAgreement: { ...state.selectedLease.leaseAgreement, ...payload.signatureData } }
          : state.selectedLease,
        leases: state.leases.map(lease =>
          lease.id === payload.leaseId
            ? { ...lease, leaseAgreement: { ...lease.leaseAgreement, ...payload.signatureData } }
            : lease
        ),
        loading: false,
        error: null
      };

    case LEASE_ACTION_TYPES.CANCEL_LEASE_SIGNATURE_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case LEASE_ACTION_TYPES.RESEND_LEASE_SIGNATURE_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case LEASE_ACTION_TYPES.RESEND_LEASE_SIGNATURE_SUCCESS:
      return {
        ...state,
        loading: false,
        error: null
      };

    case LEASE_ACTION_TYPES.RESEND_LEASE_SIGNATURE_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case LEASE_ACTION_TYPES.UPDATE_LEASE_AGREEMENT_SUCCESS:
      return {
        ...state,
        selectedLease: state.selectedLease?.id === payload.leaseId
          ? { ...state.selectedLease, leaseAgreement: { ...state.selectedLease.leaseAgreement, ...payload.leaseAgreement } }
          : state.selectedLease,
        leases: state.leases.map(lease =>
          lease.id === payload.leaseId
            ? { ...lease, leaseAgreement: { ...lease.leaseAgreement, ...payload.leaseAgreement } }
            : lease
        ),
      };

    case LEASE_ACTION_TYPES.RESET_STATE:
      return {
        ...initialState,
      };

    default:
      return state;
  }
}
export default leaseReducer;
