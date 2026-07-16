// ModalContext.js
import { createContext, useContext, useState } from 'react';
import useModalControls from 'hooks/useModalControls';

const ModalContext = createContext();

export function ModalProvider({ children }) {
  const modalControls = useModalControls();

  // ✅ Add state for selected rent
  const [selectedRent, setSelectedRent] = useState(null);

  // ✅ Override openPaymentModal to accept rent
  const openPaymentModal = (rent) => {
    setSelectedRent(rent);
    modalControls.openPaymentModal();
  };

  // ✅ Override closePaymentModal to clear rent
  const closePaymentModal = () => {
    setSelectedRent(null);
    modalControls.closePaymentModal();
  };

  const value = {
    ...modalControls,
    openPaymentModal,
    closePaymentModal,
    selectedRent
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used inside <ModalProvider>');
  return context;
}
