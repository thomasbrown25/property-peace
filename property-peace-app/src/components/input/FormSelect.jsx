import PropTypes from 'prop-types';
import {
  Stack,
  InputLabel,
  FormControl,
  Select,
  OutlinedInput,
  MenuItem,
  ListItemText,
  Typography,
  FormHelperText,
  Tooltip
} from '@mui/material';

/**
 * Reusable select component for forms (Formik-friendly).
 *
 * Props:
 * - name: field name (e.g., "status")
 * - label: input label text (e.g., "Property Type")
 * - options: [{ value: number|string, label: string }]
 * - value: current value (number|string|undefined)
 * - onChange: (event) => void  // optional; if omitted, setFieldValue is used
 * - setFieldValue: (name, value) => void  // optional Formik helper
 * - placeholder: string (e.g., "Select Status")
 * - errorText: string  // error message to show
 * - touched: boolean   // whether field has been touched
 * - valueType: "number" | "string"  // how to coerce selected values (default "number")
 * - fullWidth: boolean
 * - disabled: boolean
 */
export default function FormSelect({
  name = 'status',
  label = 'Property Type',
  options = [],
  value,
  onChange,
  setFieldValue,
  placeholder = 'Select Status',
  errorText,
  touched,
  valueType = 'number',
  fullWidth = true,
  disabled = false,
  onClick,
  ...selectProps
}) {
  // Coerce the selected value based on valueType
  const coerce = (v) => (valueType === 'number' ? Number(v) : String(v));

  const handleChange = (event) => {
    const next = coerce(event.target.value);
    if (onChange) {
      onChange(event);
    } else if (setFieldValue) {
      setFieldValue(name, next);
    }
  };

  // Find the label for the current value
  const selectedOption = options.find((opt) => coerce(opt.value) === coerce(value));

  return (
    <Stack sx={{ gap: 1 }}>
      <InputLabel htmlFor={`${name}-select`}>{label}</InputLabel>
      <FormControl fullWidth={fullWidth} disabled={disabled} error={Boolean(touched && errorText)} onClick={onClick}>
        <Select
          id={`${name}-select`}
          displayEmpty
          size="small"
          value={value ?? ''}
          onChange={handleChange}
          input={<OutlinedInput id={`${name}-outlined-input`} placeholder="Sort by" />}
          renderValue={(selected) => {
            if (selected === '' || selected === undefined || selected === null) {
              return (
                <Typography variant="body3" color="text.secondary">
                  {placeholder}
                </Typography>
              );
            }
            return (
              <Typography variant="body3" color="text.primary">
                {selectedOption ? selectedOption.label : String(selected)}
              </Typography>
            );
          }}
          {...selectProps}
        >
          {options.map((opt) => (
            <MenuItem
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              sx={{
                py: 0.5,
                minHeight: '32px',
                fontSize: '0.875rem'
              }}
            >
              {opt.disabled ? <ListItemText primary={`${opt.label} (has lease)`} /> : <ListItemText primary={opt.label} />}
            </MenuItem>
          ))}
        </Select>
        {touched && errorText && <FormHelperText id={`${name}-helper-text`}>{errorText}</FormHelperText>}
      </FormControl>
    </Stack>
  );
}

FormSelect.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired, label: PropTypes.string.isRequired })
  ),
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func,
  setFieldValue: PropTypes.func,
  placeholder: PropTypes.string,
  errorText: PropTypes.string,
  touched: PropTypes.bool,
  valueType: PropTypes.oneOf(['number', 'string']),
  fullWidth: PropTypes.bool,
  disabled: PropTypes.bool
};
