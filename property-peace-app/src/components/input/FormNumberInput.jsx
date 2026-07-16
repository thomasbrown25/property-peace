import { useState, useEffect } from 'react';
import { Stack, InputLabel, TextField, FormHelperText } from '@mui/material';

export default function FormNumberInput({
  name = 'number',
  label = 'Number',
  value,
  onChange,
  setFieldValue,
  placeholder = '',
  errorText,
  touched,
  fullWidth = true,
  disabled = false,
  min,
  max,
  step,
  className = '',
  ...textFieldProps
}) {
  const [displayValue, setDisplayValue] = useState(value ?? '');

  // Sync from external changes (e.g., form reset)
  useEffect(() => {
    setDisplayValue(value ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    
    // Convert to number if not empty, otherwise set to empty string
    let numValue = '';
    if (raw !== '') {
      if (step && step !== 1) {
        numValue = parseFloat(raw);
      } else {
        numValue = parseInt(raw, 10);
      }
      // Check if conversion was successful (not NaN)
      if (isNaN(numValue)) {
        numValue = '';
      }
    }
    
    if (setFieldValue) setFieldValue(name, numValue);
    if (onChange) onChange(e);
  };

  const inputProps = {
    min: min !== undefined ? min : undefined,
    max: max !== undefined ? max : undefined,
    step: step !== undefined ? step : undefined
  };

  return (
    <Stack sx={{ gap: 1 }}>
      {label && <InputLabel htmlFor={`${name}-input`}>{label}</InputLabel>}
      <TextField
        id={`${name}-input`}
        name={name}
        type="number"
        size="small"
        fullWidth={fullWidth}
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        error={Boolean(touched && errorText)}
        inputProps={inputProps}
        className={className}
        {...textFieldProps}
      />
      {touched && errorText && (
        <FormHelperText error sx={{ mt: 0, mb: 0 }}>
          {errorText}
        </FormHelperText>
      )}
    </Stack>
  );
}

