import { useEffect } from 'react';
import { batch, useDispatch, useSelector } from 'react-redux';
import { setLease } from 'store/lease/lease.action';
import { getTenants } from 'store/tenant/tenant.action';
import { selectUnit } from 'store/unit/unit.selector';

export default function useFetchTenantsSetLease() {
  const dispatch = useDispatch();
  const selectedUnit = useSelector(selectUnit);

  useEffect(() => {
    const lease = selectedUnit?.lease;
    if (!lease?.id) return;

    batch(() => {
      dispatch(setLease(lease));
      dispatch(getTenants(lease.id));
    });
  }, [dispatch, selectedUnit?.lease?.id]);
}
