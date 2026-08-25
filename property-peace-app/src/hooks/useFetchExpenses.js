import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getExpensesAction, getTotalExpensesAction } from 'store/expense/expense.action';
import {
  selectExpenses,
  selectTotalExpenses,
  selectExpenseListLoading,
  selectExpenseListError,
  selectExpenseListRequestKey,
  selectExpenseListSettledRequestKey
} from 'store/expense/expense.selector';
import useAuth from './useAuth';

export default function useFetchExpenses(filters = {}) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const storedExpenses = useSelector(selectExpenses);
  const totalAmount = useSelector(selectTotalExpenses);
  const listLoading = useSelector(selectExpenseListLoading);
  const listError = useSelector(selectExpenseListError);
  const activeRequestKey = useSelector(selectExpenseListRequestKey);
  const settledRequestKey = useSelector(selectExpenseListSettledRequestKey);

  const landlordId = user?.id;
  const serializedFilters = JSON.stringify(filters);
  const filtersRef = useRef(filters);
  const serializedFiltersRef = useRef(serializedFilters);
  if (serializedFiltersRef.current !== serializedFilters) {
    filtersRef.current = filters;
    serializedFiltersRef.current = serializedFilters;
  }
  const requestKey = String(landlordId ?? 'anonymous') + ':' + serializedFilters;
  const currentRequest = activeRequestKey === requestKey;
  const requestSettled = settledRequestKey === requestKey;
  const enabled = Boolean(landlordId);

  const refetch = useCallback(() => {
    if (!landlordId) return;

    const currentFilters = filtersRef.current;
    dispatch(getExpensesAction(landlordId, currentFilters, requestKey));
    dispatch(getTotalExpensesAction(landlordId, currentFilters));
  }, [dispatch, landlordId, requestKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const loading = enabled && (!currentRequest || listLoading);
  const error = currentRequest ? listError : null;
  const expenses = currentRequest && requestSettled ? storedExpenses : [];
  const available = enabled && currentRequest && requestSettled && !listLoading && !listError;

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
