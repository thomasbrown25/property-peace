// DrawerContext.js
import { createContext, useContext } from 'react';
import useDrawerControls from 'hooks/useDrawerControls';

const DrawerContext = createContext(null);
export function DrawerProvider({ children }) {
  const value = useDrawerControls();
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}
export function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) throw new Error('useDrawer must be used inside <DrawerProvider>');
  return context;
}
