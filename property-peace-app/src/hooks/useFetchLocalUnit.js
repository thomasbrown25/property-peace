import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectMaintenance } from 'store/maintenance/maintenance.selector';
import { selectUnits } from 'store/unit/unit.selector';

export default function useFetchLocalUnit() {
  const [localUnit, setLocalUnit] = useState(null);
  const units = useSelector(selectUnits);
  const maintenance = useSelector(selectMaintenance);

  useEffect(() => {
    if (maintenance?.unitId) {
      const foundUnit = units.find((unit) => unit.id === maintenance.unitId);
      setLocalUnit(foundUnit);
    }
  }, [maintenance, units]);

  return { localUnit };
}
