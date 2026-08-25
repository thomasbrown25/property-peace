import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getExpensesAction, getTotalExpensesAction } from 'store/expense/expense.action';
import { selectTotalExpenses, selectExpenseListRequest } from 'store/expense/expense.selector';
import { buildExpenseListRequestKey } from 'utils/expensesTab';
import useAuth from './useAuth';

export default function useFetchExpenses(filters = {}) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const landlordId = user?.id;
  const serializedFilters = JSON.stringify(filters);
  const filtersRef = useRef(filters);
  const serializedFiltersRef = useRef(serializedFilters);
  if (serializedFiltersRef.current !== serializedFilters) {
    filtersRef.current = filters;
    serializedFiltersRef.current = serializedFilters;
  }

  const requestKey = buildExpenseListRequestKey(landlordId, filters);
  const listRequest = useSelector((state) => selectExpenseListRequest(state, requestKey));
  const totalAmount = useSelector(selectTotalExpenses);
  const enabled = Boolean(landlordId);

  const refetch = useCallback(() => {
    if (!landlordId) return;

    const currentFilters = filtersRef.current;
    dispatch(getExpensesAction(landlordId, currentFilters, requestKey));
    dispatch(getTotalExpensesAction(landlordId, currentFilters));
  }, [dispatch, landlordId, requestKey, serializedFilters]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const loading = enabled && (!listRequest || listRequest.loading);
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
