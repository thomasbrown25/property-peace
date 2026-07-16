import { CLIENT_ACTION_TYPES } from './client.types';

const initialState = {
  clients: [],
  selectedClient: null,
  loading: false,
  error: null
};

function clientReducer(state = initialState, action) {
  const { type, payload } = action;

  switch (type) {
    case CLIENT_ACTION_TYPES.GET_CLIENTS_START:
    case CLIENT_ACTION_TYPES.GET_CLIENT_START:
    case CLIENT_ACTION_TYPES.ADD_CLIENT_START:
    case CLIENT_ACTION_TYPES.UPDATE_CLIENT_START:
    case CLIENT_ACTION_TYPES.DELETE_CLIENT_START:
    case CLIENT_ACTION_TYPES.LINK_PROPERTY_START:
    case CLIENT_ACTION_TYPES.UNLINK_PROPERTY_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case CLIENT_ACTION_TYPES.GET_CLIENTS_SUCCESS:
      return {
        ...state,
        clients: payload,
        loading: false,
        error: null
      };

    case CLIENT_ACTION_TYPES.GET_CLIENT_SUCCESS:
      return {
        ...state,
        selectedClient: payload,
        loading: false,
        error: null
      };

    case CLIENT_ACTION_TYPES.ADD_CLIENT_SUCCESS:
      return {
        ...state,
        clients: [...state.clients, payload],
        selectedClient: payload,
        loading: false,
        error: null
      };

    case CLIENT_ACTION_TYPES.UPDATE_CLIENT_SUCCESS:
      return {
        ...state,
        clients: state.clients.map((client) => (client.id === payload.id ? payload : client)),
        selectedClient: payload,
        loading: false,
        error: null
      };

    case CLIENT_ACTION_TYPES.DELETE_CLIENT_SUCCESS:
      return {
        ...state,
        clients: state.clients.filter((client) => client.id !== payload),
        selectedClient: state.selectedClient?.id === payload ? null : state.selectedClient,
        loading: false,
        error: null
      };

    case CLIENT_ACTION_TYPES.LINK_PROPERTY_SUCCESS:
    case CLIENT_ACTION_TYPES.UNLINK_PROPERTY_SUCCESS:
      // Refresh the client data after linking/unlinking
      return {
        ...state,
        clients: state.clients.map((client) =>
          client.id === payload.clientId
            ? { ...client, propertyCount: payload.data?.propertyCount ?? client.propertyCount }
            : client
        ),
        selectedClient:
          state.selectedClient?.id === payload.clientId
            ? { ...state.selectedClient, propertyCount: payload.data?.propertyCount ?? state.selectedClient.propertyCount }
            : state.selectedClient,
        loading: false,
        error: null
      };

    case CLIENT_ACTION_TYPES.GET_CLIENTS_FAILED:
    case CLIENT_ACTION_TYPES.GET_CLIENT_FAILED:
    case CLIENT_ACTION_TYPES.ADD_CLIENT_FAILED:
    case CLIENT_ACTION_TYPES.UPDATE_CLIENT_FAILED:
    case CLIENT_ACTION_TYPES.DELETE_CLIENT_FAILED:
    case CLIENT_ACTION_TYPES.LINK_PROPERTY_FAILED:
    case CLIENT_ACTION_TYPES.UNLINK_PROPERTY_FAILED:
      return {
        ...state,
        loading: false,
        error: payload
      };

    case CLIENT_ACTION_TYPES.RESET_STATE:
      return initialState;

    default:
      return state;
  }
}

export default clientReducer;
