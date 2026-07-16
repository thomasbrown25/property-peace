import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllPayments } from 'store/payment/payment.action';
import { selectAllPaymentsLoadedAt } from 'store/payment/payment.selector';
import useAuth from './useAuth';

const STALE_MS = 5 * 60 * 1000; // 5 minutes

export default function useFetchAllPayments() {
  const dispatch = useDispatch();
  const { isLoggedIn } = useAuth();
  const loadedAt = useSelector(selectAllPaymentsLoadedAt);

  const refetch = useCallback(async () => {
    await dispatch(getAllPayments());
  }, [dispatch]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (loadedAt && Date.now() - loadedAt < STALE_MS) return;
    refetch();
  }, [isLoggedIn, loadedAt, refetch]);

  return { refetch };
}
