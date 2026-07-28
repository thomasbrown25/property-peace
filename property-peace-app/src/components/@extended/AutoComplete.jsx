import { TextField } from '@mui/material';
import { Autocomplete as MuiAutocomplete } from '@mui/material';

export default function Autocomplete({ options, width = '100%', label, placeholder, isOptionEqualToValue, getOptionLabel, disablePortal = false, ...props }) {
  return (
    <MuiAutocomplete
      size="small"
      disablePortal={disablePortal}
      options={options}
      getOptionLabel={getOptionLabel ?? ((option) => option?.label ?? '')}
      isOptionEqualToValue={isOptionEqualToValue ?? ((opt, val) => String(opt?.id) === String(val?.id))}
      sx={{ 
        width,
        '& .MuiAutocomplete-popper': {
          zIndex: 1300 // Ensure dropdown appears above other elements
        }
      }}
      componentsProps={{
        popper: {
          sx: {
            zIndex: 1300 // Additional z-index for the popper
          }
        }
      }}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
      {...props}
    />
  );
}
