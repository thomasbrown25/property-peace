import { createContext, useContext, useState, useCallback } from 'react';

const AICopilotContext = createContext(null);

export const useAICopilot = () => {
  const context = useContext(AICopilotContext);
  if (!context) {
    throw new Error('useAICopilot must be used within AICopilotProvider');
  }
  return context;
};

export const AICopilotProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true); // Start open but collapsed
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  const [conversation, setConversation] = useState([]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const addToConversation = useCallback((message) => {
    setConversation((prev) => [...prev, message]);
  }, []);

  const clearConversation = useCallback(() => {
    setConversation([]);
  }, []);

  const setConversationState = useCallback((messages) => {
    setConversation(messages);
  }, []);

  return (
    <AICopilotContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar,
        openSidebar,
        closeSidebar,
        isCollapsed,
        setIsCollapsed,
        conversation,
        addToConversation,
        clearConversation,
        setConversationState
      }}
    >
      {children}
    </AICopilotContext.Provider>
  );
};
