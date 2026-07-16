import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const LeaseContext = createContext();

export const useLease = () => {
  const context = useContext(LeaseContext);
  if (!context) {
    throw new Error('useLease must be used within a LeaseProvider');
  }
  return context;
};

export const LeaseProvider = ({ children }) => {
  const [selectedLeaseId, setSelectedLeaseId] = useState(null);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load selected lease from localStorage on mount
  useEffect(() => {
    const savedLeaseId = localStorage.getItem('selectedLeaseId');
    if (savedLeaseId) {
      setSelectedLeaseId(Number(savedLeaseId));
    }
  }, []);

  // Save selected lease to localStorage when it changes
  useEffect(() => {
    if (selectedLeaseId !== null) {
      localStorage.setItem('selectedLeaseId', selectedLeaseId.toString());
    } else {
      localStorage.removeItem('selectedLeaseId');
    }
  }, [selectedLeaseId]);

  const selectLease = useCallback((leaseId) => {
    setSelectedLeaseId(leaseId);
  }, []);

  const getSelectedLease = useCallback(() => {
    if (!selectedLeaseId || !leases.length) return null;
    return leases.find(lease => lease.id === selectedLeaseId) || leases[0] || null;
  }, [selectedLeaseId, leases]);

  // Memoize the context value to prevent unnecessary re-renders
  // Note: setLeases and setLoading are stable state setters, so they don't need to be in deps
  const value = useMemo(() => ({
    selectedLeaseId,
    leases,
    setLeases,
    selectLease,
    getSelectedLease,
    loading,
    setLoading
  }), [selectedLeaseId, leases, selectLease, getSelectedLease, loading]);

  return <LeaseContext.Provider value={value}>{children}</LeaseContext.Provider>;
};
