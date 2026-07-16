import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getPayments } from 'store/payment/payment.action';
import { selectPayment } from '../store/payment/payment.selector';

export default function useFetchPayments(leaseId = null) {
  const dispatch = useDispatch();
  const payments = useSelector(selectPayment);

  // build query payload
  const refetch = useCallback(() => {
    if (!leaseId) return;

    dispatch(getPayments(leaseId));
  }, [dispatch, leaseId]);

  // fetch on mount
  useEffect(() => {
    refetch();
  }, [refetch, leaseId]);

  return {
    payments,
    refetch
  };
}
