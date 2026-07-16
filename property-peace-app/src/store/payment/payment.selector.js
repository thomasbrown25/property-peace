export const selectPayment = (state) => state.payment?.payments;
export const selectAllPayments = (state) => state.payment?.allPayments ?? [];
export const selectAllPaymentsLoadedAt = (state) => state.payment?.allPaymentsLoadedAt;
