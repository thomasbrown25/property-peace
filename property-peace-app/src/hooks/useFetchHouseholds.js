import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getHouseholds } from 'store/household/household.action';
import { selectHouseholds } from 'store/household/household.selector';
import useAuth from './useAuth';

export default function useFetchHouseholds() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const households = useSelector(selectHouseholds);

  const householdsRefetch = useCallback(() => {
    const action = getHouseholds(user?.id);

    const result = dispatch(action);
    return typeof result.unwrap === 'function' ? result.unwrap() : result;
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (user?.id && user?.id !== '') {
      householdsRefetch();
    }
  }, [householdsRefetch, user?.id]);

  return { households, householdsRefetch };
}
