import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setLease } from 'store/lease/lease.action';
import { setProperty, setPropertyIds } from 'store/property/property.action';
import { selectProperties } from 'store/property/property.selector';

export default function useSetProperty(propertyId) {
  const dispatch = useDispatch();
  const properties = useSelector(selectProperties);

  useEffect(() => {
    if (properties.length > 0) {
      const found = properties.find((property) => property.id.toString() === propertyId);
      if (found) {
        dispatch(setProperty(found));
        dispatch(setPropertyIds([found.id]));

        if (found?.propertyType === 'singleFamily' && found?.units?.length === 1) {
          dispatch(setLease(found?.units[0]?.lease || {}));
        }
      }
    }
  }, [properties, propertyId]);

  return;
}
