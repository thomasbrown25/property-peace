import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { getUnits } from 'store/unit/unit.action';

export default function useFetchUnits(propertyId) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getUnits(propertyId));
  }, [dispatch, propertyId]);
}
