import { useState, useEffect } from 'react';
import { Stack, InputLabel, TextField } from '@mui/material';
import { parseCurrencyToDecimal, parseDecimalToCurrency, formatPhoneInput, cleanPhoneInput } from 'utils/formatters';

export default function FormInput({
  name = 'location',
  label = 'Location',
  value,
  onChange,
  setFieldValue,
  placeholder = '',
  errorText,
  touched,
  multiline = false,
  rows = 1,
  fullWidth = true,
  disabled = false,
  valueType = 'string',
  className = '',
  ...textFieldProps
}) {
  const [displayValue, setDisplayValue] = useState(value ?? '');

  // Sync from external changes (e.g., form reset)
  // Only update if value actually changed to prevent unnecessary re-renders
  useEffect(() => {
    if (valueType === 'currency') {
      if (typeof value === 'number') {
        const newValue = String(value);
        setDisplayValue(newValue); // raw while focused; we'll pretty on blur
      } else if (value == null || value === '') {
        setDisplayValue('');
      } else {
        setDisplayValue(String(value));
      }
    } else if (valueType === 'phone') {
      // Format phone number for display
      setDisplayValue(value ? formatPhoneInput(value) : '');
    } else {
      setDisplayValue(value ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, valueType]); // Only sync when external value changes, not internal displayValue

  const handleChange = (e) => {
    const raw = e.target.value;

    if (valueType === 'currency') {
      // Remove all non-numeric characters except decimal point
      const cleaned = raw.replace(/[^0-9.]/g, '');
      
      // Prevent multiple decimal points
      const parts = cleaned.split('.');
      const formatted = parts.length > 2 
        ? parts[0] + '.' + parts.slice(1).join('')
        : cleaned;
      
      // Limit to 2 decimal places
      const decimalParts = formatted.split('.');
      const limited = decimalParts.length > 1
        ? decimalParts[0] + '.' + decimalParts[1].slice(0, 2)
        : formatted;
      
      // Format with commas as user types
      if (limited === '' || limited === '.') {
        setDisplayValue(limited);
        if (setFieldValue) setFieldValue(name, 0);
        if (onChange) onChange(e);
        return;
      }
      
      const numericValue = parseFloat(limited);
      if (!isNaN(numericValue)) {
        // Format with commas but keep decimals
        const parts = limited.split('.');
        const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        const formattedValue = parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
        setDisplayValue(formattedValue);
        if (setFieldValue) setFieldValue(name, numericValue);
        if (onChange) onChange(e);
      } else {
        setDisplayValue(limited);
        if (setFieldValue) setFieldValue(name, 0);
        if (onChange) onChange(e);
      }
      return;
    }

    if (valueType === 'phone') {
      // Format phone as user types, store formatted value
      const formatted = formatPhoneInput(raw);
      setDisplayValue(formatted);
      if (setFieldValue) setFieldValue(name, formatted);
      if (onChange) onChange(e);
      return;
    }

    setDisplayValue(raw);
    if (setFieldValue) setFieldValue(name, raw);
    if (onChange) onChange(e);
  };

  const handleBlur = (e) => {
    if (valueType === 'currency') {
      const decimalValue = parseCurrencyToDecimal(displayValue);
      // pretty print on blur
      setDisplayValue(Number.isFinite(decimalValue) ? parseDecimalToCurrency(decimalValue, true) : '');
    }
    if (textFieldProps.onBlur) textFieldProps.onBlur(e);
  };

  const handleFocus = (e) => {
    if (valueType === 'currency') {
      // Keep formatted value on focus (with commas) for better UX
      // The formatting in handleChange will maintain the format
    }
    if (textFieldProps.onFocus) textFieldProps.onFocus(e);
  };

  return (
    <Stack sx={{ gap: 1 }}>
      {label && <InputLabel htmlFor={`${name}-input`}>{label}</InputLabel>}
      <TextField
        id={`${name}-input`}
        name={name}
        size="small"
        fullWidth={fullWidth}
        disabled={disabled}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        multiline={multiline}
        rows={rows}
        error={Boolean(touched && errorText)}
        helperText={touched && errorText}
        inputMode={valueType === 'currency' ? 'decimal' : valueType === 'phone' ? 'tel' : undefined} // nicer mobile keypad
        className={className}
        {...textFieldProps}
      />
    </Stack>
  );
}
