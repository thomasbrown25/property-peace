import { createSelector } from 'reselect';

const selectClientReducer = (state) => state.client;

export const selectClients = createSelector(
  [selectClientReducer],
  (client) => client.clients
);

export const selectSelectedClient = createSelector(
  [selectClientReducer],
  (client) => client.selectedClient
);

export const selectClientLoading = createSelector(
  [selectClientReducer],
  (client) => client.loading
);

export const selectClientError = createSelector(
  [selectClientReducer],
  (client) => client.error
);

export const selectActiveClients = createSelector([selectClients], (clients) =>
  clients.filter((client) => client.isActive)
);
