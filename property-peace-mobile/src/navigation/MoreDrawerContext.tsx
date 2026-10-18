import React, { createContext, useContext, useState } from 'react';

const MoreDrawerContext = createContext<{ open: boolean; show: () => void; hide: () => void }>({
  open: false, show: () => {}, hide: () => {},
});

export function MoreDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MoreDrawerContext.Provider value={{ open, show: () => setOpen(true), hide: () => setOpen(false) }}>
      {children}
    </MoreDrawerContext.Provider>
  );
}

export const useMoreDrawer = () => useContext(MoreDrawerContext);
