import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setLease } from 'store/lease/lease.action';
import { setPropertyField } from 'store/property/property.action';
import { defaultLease } from 'utils/models';

export default function useSetPropertyDefaults() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setPropertyField('propertyType', 'singleFamily'));
  }, [dispatch]);

  useEffect(() => {
    dispatch(setLease(defaultLease));
  }, [dispatch]);
}
