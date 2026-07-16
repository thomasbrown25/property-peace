import { useState, useCallback } from 'react';

export default function useModalControls() {
  const [openPayment, setOpenPayment] = useState(false);

  return {
    openPayment,
    openPaymentModal: useCallback(() => setOpenPayment(true), []),
    closePaymentModal: useCallback(() => setOpenPayment(false), [])
  };
}
