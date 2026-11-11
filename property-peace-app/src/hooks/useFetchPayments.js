import { useEffect, useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { getPayments } from 'store/payment/payment.action';

export default function useFetchPayments(leaseId = null) {
  const dispatch = useDispatch();
  const requestId = useRef(0);
  const [state, setState] = useState({ leaseId: null, payments: [], loading: true, error: null });

  const refetch = useCallback(async () => {
    if (!leaseId) return;
    const currentRequest = ++requestId.current;
    setState({ leaseId, payments: [], loading: true, error: null });
    const result = await dispatch(getPayments(leaseId));
    if (currentRequest !== requestId.current) return;
    setState({ leaseId, payments: result.payments, loading: false, error: result.error });
  }, [dispatch, leaseId]);

  useEffect(() => {
    refetch();
    return () => { requestId.current += 1; };
  }, [refetch]);

  // Mask the previous lease synchronously, before the new fetch effect runs.
  const matchesLease = state.leaseId === leaseId;
  return {
    payments: matchesLease ? state.payments : [],
    loading: Boolean(leaseId) && (!matchesLease || state.loading),
    error: matchesLease ? state.error : null,
    refetch
  };
}
