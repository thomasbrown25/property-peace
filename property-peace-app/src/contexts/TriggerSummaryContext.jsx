import { createContext, useContext, useCallback, useRef } from 'react';

const TriggerSummaryContext = createContext(null);

export const useTriggerSummary = () => {
  const context = useContext(TriggerSummaryContext);
  return context ?? {
    registerGenerateSummary: () => () => {},
    triggerGenerateSummary: () => {}
  };
};

export const TriggerSummaryProvider = ({ children }) => {
  const generateSummaryRef = useRef(null);

  const registerGenerateSummary = useCallback((fn) => {
    generateSummaryRef.current = fn;
    return () => {
      generateSummaryRef.current = null;
    };
  }, []);

  const triggerGenerateSummary = useCallback(() => {
    if (typeof generateSummaryRef.current === 'function') {
      generateSummaryRef.current();
    }
  }, []);

  return (
    <TriggerSummaryContext.Provider
      value={{
        registerGenerateSummary,
        triggerGenerateSummary
      }}
    >
      {children}
    </TriggerSummaryContext.Provider>
  );
};
