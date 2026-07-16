import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isSingleUnitPortfolio } from 'store/property/property.action';
import { selectIsSingleUnitPortfolio } from 'store/property/property.selector';
import useAuth from './useAuth';

export default function useIsSingleUnitProfile() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const isSingleUnitProfile = useSelector(selectIsSingleUnitPortfolio);

  const isSingleProfileRefetch = useCallback(() => {
    const result = dispatch(isSingleUnitPortfolio(user?.id));

    // If you're using RTK createAsyncThunk, unwrap will exist:
    return typeof result.unwrap === 'function' ? result.unwrap() : result;
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (user?.id) {
      isSingleProfileRefetch();
    }
  }, [isSingleProfileRefetch, user?.id]);

  return { isSingleUnitProfile, isSingleProfileRefetch };
}
