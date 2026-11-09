import { useEffect, useRef, useState } from 'react';
import axiosServices from 'utils/axios';

// A draft belongs to a saved lease, never to a property's current-unit projection.
export default function useSupplementalLease(leaseId, leaseData, hydrate) {
  const hydrateRef = useRef(hydrate);
  hydrateRef.current = hydrate;
  const hydratedId = useRef(null);
  const [state, setState] = useState({ lease: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    if (!Number.isInteger(leaseId) || leaseId <= 0) {
      hydratedId.current = null;
      setState({ lease: null, loading: false, error: 'A saved lease is required. Open this page with a valid leaseId.' });
      return;
    }
    // Parent refreshes must not overwrite edits already hydrated for this lease.
    if (hydratedId.current === leaseId) return;
    setState({ lease: null, loading: true, error: null });
    const load = async () => {
      try {
        let savedLease = leaseData;
        if (!savedLease) {
          const response = await axiosServices.get(`/api/Lease/${leaseId}`);
          if (response.data?.success === false) throw new Error(response.data.message || 'Unable to load lease.');
          savedLease = response.data?.data ?? response.data;
        }
        if (!savedLease || Number(savedLease.id ?? savedLease.Id) !== leaseId) {
          throw new Error('The requested saved lease could not be found.');
        }
        if (!active) return;
        hydrateRef.current(savedLease);
        hydratedId.current = leaseId;
        setState({ lease: savedLease, loading: false, error: null });
      } catch (error) {
        if (active) setState({ lease: null, loading: false, error: error?.response?.data?.message || error.message || 'Unable to load lease.' });
      }
    };
    load();
    return () => { active = false; };
  }, [leaseId, leaseData]);

  const matches = Number(state.lease?.id ?? state.lease?.Id) === leaseId;
  return { ...state, lease: matches ? state.lease : null, loading: state.loading || (!!state.lease && !matches) };
}
