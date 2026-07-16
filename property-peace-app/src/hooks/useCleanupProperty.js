import { useEffect } from 'react';
import { batch, useDispatch } from 'react-redux';
import { setProperty } from 'store/property/property.action';
import { setPropertyIds } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';

export default function useCleanupProperty() {
  const dispatch = useDispatch();

  useEffect(() => {
    return () => {
      batch(() => {
        dispatch(setPropertyIds([]));
        dispatch(setProperty(null));
        dispatch(setUnit({}));
      });
    };
  }, [dispatch]);
}
