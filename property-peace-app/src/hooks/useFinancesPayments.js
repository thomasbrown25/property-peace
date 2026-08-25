import { useCallback, useEffect, useRef, useState } from 'react';
import axiosServices from 'utils/axios';
import { buildFinancesPaymentRequestScope } from 'utils/paymentsTab';

const paymentsFrom = (response) => {
  const data = Array.isArray(response?.data)
    ? response.data
    : response?.data?.data ?? response?.data?.Data ?? response?.data;
  return Array.isArray(data) ? data : [];
};

export default function useFinancesPayments(propertyId, unitId, mutationVersion) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestIdRef.current += 1;
    const { params } = buildFinancesPaymentRequestScope(propertyId, unitId);
    setLoading(true);
    setError('');

    axiosServices.get('/api/payment/all', { params, signal: controller.signal })
      .then((response) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setPayments(paymentsFrom(response));
      })
      .catch((requestError) => {
        if (requestId !== requestIdRef.current || controller.signal.aborted) return;
        setError(requestError?.response?.data?.errors || requestError?.message || 'Payments could not be loaded.');
      })
      .finally(() => {
        if (requestId === requestIdRef.current && !controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [propertyId, unitId, mutationVersion, retryVersion]);

  const retry = useCallback(() => setRetryVersion((version) => version + 1), []);

  return { payments, loading, error, available: !loading && !error, retry };
}
