import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getExpensesAction, getTotalExpensesAction } from 'store/expense/expense.action';
import { selectExpenses, selectTotalExpenses, selectExpenseLoading, selectExpenseError } from 'store/expense/expense.selector';
import useAuth from './useAuth';

export default function useFetchExpenses(filters = {}) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const expenses = useSelector(selectExpenses);
  const totalAmount = useSelector(selectTotalExpenses);
  const loading = useSelector(selectExpenseLoading);
  const error = useSelector(selectExpenseError);

  const landlordId = user?.id;

  // Build refetch function
  const refetch = useCallback(() => {
    if (!landlordId) return;

    // Dispatch both actions in parallel
    dispatch(getExpensesAction(landlordId, filters));
    dispatch(getTotalExpensesAction(landlordId, filters));
  }, [dispatch, landlordId, JSON.stringify(filters)]);

  // Fetch on mount + whenever landlordId or filters change
  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    expenses,
    totalAmount,
    loading,
    error,
    refetch
  };
}

