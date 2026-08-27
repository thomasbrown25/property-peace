import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  getRegisteredExpensesAction,
  getStaleExpensesAction,
  getTotalExpensesAction,
  registerExpenseListScopeAction,
  releaseExpenseListScopeAction
} from 'store/expense/expense.action';
import { selectTotalExpenses, selectExpenseListRequest } from 'store/expense/expense.selector';
import { buildExpenseListRequestKey, buildExpenseRequestPlan } from 'utils/expensesTab';
import useAuth from './useAuth';

export default function useFetchExpenses(filters = {}, options = {}) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const landlordId = user?.id;
  const { filters: requestFilters, includeTotal } = buildExpenseRequestPlan(filters, options);
  const filtersRef = useRef(requestFilters);
  filtersRef.current = requestFilters;

  const requestKey = buildExpenseListRequestKey(landlordId, requestFilters);
  const listRequest = useSelector((state) => selectExpenseListRequest(state, requestKey));
  const totalAmount = useSelector(selectTotalExpenses);
  const enabled = Boolean(landlordId);

  const refetch = useCallback(() => {
    if (!landlordId) return;

    const currentFilters = filtersRef.current;
    const request = dispatch(getRegisteredExpensesAction(landlordId, currentFilters, requestKey));
    if (request && includeTotal) dispatch(getTotalExpensesAction(landlordId, currentFilters));
  }, [dispatch, includeTotal, landlordId, requestKey]);

  const refreshStale = useCallback(() => {
    if (!landlordId) return;

    const currentFilters = filtersRef.current;
    const request = dispatch(getStaleExpensesAction(landlordId, currentFilters, requestKey));
    if (request && includeTotal) dispatch(getTotalExpensesAction(landlordId, currentFilters));
  }, [dispatch, includeTotal, landlordId, requestKey]);

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
