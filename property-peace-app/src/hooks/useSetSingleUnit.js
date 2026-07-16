import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { setUnit } from 'store/unit/unit.action';

export default function useSetSingleUnit() {
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);

  const isSingleFamily = useMemo(
    () => selectedProperty?.propertyType === 'singleFamily',
    [selectedProperty?.propertyType]
  );

  useEffect(() => {
    if (!isSingleFamily) return;
    const first = selectedProperty?.units?.[0] || {};
    dispatch(setUnit(first));
  }, [dispatch, isSingleFamily, selectedProperty?.units]);
}
