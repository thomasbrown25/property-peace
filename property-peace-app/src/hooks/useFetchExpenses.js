import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  getExpensesAction,
  getStaleExpensesAction,
  getTotalExpensesAction,
  registerExpenseListScopeAction,
  releaseExpenseListScopeAction
} from 'store/expense/expense.action';
import { selectTotalExpenses, selectExpenseListRequest } from 'store/expense/expense.selector';
import { buildExpenseListRequestKey } from 'utils/expensesTab';
import useAuth from './useAuth';

export default function useFetchExpenses(filters = {}) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const landlordId = user?.id;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const requestKey = buildExpenseListRequestKey(landlordId, filters);
  const listRequest = useSelector((state) => selectExpenseListRequest(state, requestKey));
  const totalAmount = useSelector(selectTotalExpenses);
  const enabled = Boolean(landlordId);

  const refetch = useCallback(() => {
    if (!landlordId) return;

    const currentFilters = filtersRef.current;
    dispatch(getExpensesAction(landlordId, currentFilters, requestKey));
    dispatch(getTotalExpensesAction(landlordId, currentFilters));
  }, [dispatch, landlordId, requestKey]);

  const refreshStale = useCallback(() => {
    if (!landlordId) return;

    const currentFilters = filtersRef.current;
    const request = dispatch(getStaleExpensesAction(landlordId, currentFilters, requestKey));
    if (request) dispatch(getTotalExpensesAction(landlordId, currentFilters));
  }, [dispatch, landlordId, requestKey]);

  useEffect(() => {
    if (!enabled) return undefined;

    dispatch(registerExpenseListScopeAction(requestKey));
    return () => dispatch(releaseExpenseListScopeAction(requestKey));
  }, [dispatch, enabled, requestKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (listRequest?.stale && !listRequest.loading) refreshStale();
  }, [listRequest?.loading, listRequest?.stale, refreshStale]);

  const loading = enabled && (!listRequest || listRequest.loading || listRequest.stale);
  const error = listRequest?.error ?? null;
  const expenses = listRequest?.expenses || [];
  const available = enabled && Boolean(listRequest?.settled) && !loading && !error;

  return {
    expenses,
    totalAmount,
    loading,
    error,
    available,
    requestKey,
    refetch
  };
}
