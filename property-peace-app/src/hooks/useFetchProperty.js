import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getPropertyById, setProperty } from 'store/property/property.action';
import { selectProperty, selectProperties } from 'store/property/property.selector';

export default function useFetchProperty(propertyId) {
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const allProperties = useSelector(selectProperties);

  // Seed selectedProperty instantly from the already-loaded list so the property
  // page can render without a loading flash, then fetch fresh data in the background.
  useEffect(() => {
    if (!propertyId) return;
    const id = Number(propertyId);
    if (selectedProperty?.id === id) return; // already correct, nothing to do

    const cached = allProperties?.find((p) => p.id === id);
    if (cached) {
      dispatch(setProperty(cached));
    }
  }, [propertyId]); // intentionally omit allProperties/selectedProperty to run once on mount

  const refetch = useCallback(async () => {
    if (propertyId) {
      await dispatch(getPropertyById(propertyId));
    }
  }, [dispatch, propertyId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { refetch, selectedProperty };
}
