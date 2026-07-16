import { useEffect, useMemo } from 'react';
import { Box } from '@mui/system';
import Autocomplete from 'components/@extended/AutoComplete';
import { useDispatch, useSelector } from 'react-redux';
import { selectVendors, selectVendorLoading } from 'store/vendor/vendor.selector';
import { getVendors } from 'store/vendor/vendor.action';
import useAuth from 'hooks/useAuth';

const VendorSelect = ({ 
  width, 
  value, 
  onChange, 
  label = 'Select Vendor', 
  includeInactive = false,
  landlordId = null 
}) => {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const vendors = useSelector(selectVendors);
  const loading = useSelector(selectVendorLoading);

  const effectiveLandlordId = landlordId || user?.id;

  useEffect(() => {
    if (effectiveLandlordId) {
      dispatch(getVendors(effectiveLandlordId, includeInactive));
    }
  }, [dispatch, effectiveLandlordId, includeInactive]);

  const options = useMemo(() => {
    return vendors?.map((vendor) => ({
      label: vendor.name,
      id: vendor.id,
      vendor: vendor
    })) ?? [];
  }, [vendors]);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    const vendor = vendors?.find((v) => String(v.id) === String(value));
    if (vendor) {
      return { label: vendor.name, id: vendor.id, vendor: vendor };
    }
    // Fallback if vendor not found but value is provided
    return { label: `Vendor #${value}`, id: value };
  }, [value, vendors]);

  const handleChange = (newValue) => {
    if (onChange) {
      onChange(newValue?.id || null, newValue?.vendor || null);
    }
  };

  return (
    <Box 
      width="100%" 
      display="flex" 
      flexDirection="column" 
      justifyContent="space-between" 
      alignItems="start" 
      gap={2}
      sx={{ position: 'relative', zIndex: 1 }}
    >
      <Autocomplete
        options={options}
        width={width}
        label={label}
        value={selectedOption}
        onChange={(_, val) => handleChange(val)}
        isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
        getOptionLabel={(option) => option?.label ?? ''}
        loading={loading}
        disablePortal={false}
      />
    </Box>
  );
};

export default VendorSelect;

