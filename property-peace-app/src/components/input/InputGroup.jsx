import { forwardRef } from 'react';
import { Grid, TextField, Typography } from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { Box } from '@mui/system';

const InputGroup = forwardRef(({ label, name, value, onChange, required, currency, type, placeHolder, helperText, rows, ...rest }, ref) => (
  <Box display="flex" alignItems="center" mb={1} sx={{ width: '100%' }}>
    <Box mr={2} sx={{ minWidth: '150px' }}>
      <Typography variant="body3">{label}</Typography>
    </Box>
    <Box>
      {currency ? (
        <NumericFormat
          name={name}
          value={value}
          customInput={TextField}
          onChange={onChange}
          placeholder={placeHolder}
          thousandSeparator
          prefix="$"
          decimalScale={2}
          fixedDecimalScale
          allowNegative={false}
          fullWidth
          InputProps={{
            sx: {
              height: '24px',
              borderRadius: '2px',
              fontSize: '0.8rem'
            }
          }}
          sx={{
            '& .MuiInputBase-input': {
              padding: '0 8px!important'
            }
          }}
        />
      ) : (
        <TextField
          {...rest}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeHolder}
          helperText={helperText}
          type={type || 'text'}
          rows={rows}
          multiline={Boolean(rows)}
          fullWidth
          required={required}
          inputRef={ref}
          InputProps={{
            sx: {
              ...(rows ? {} : { height: '24px' }),
              borderRadius: '2px',
              fontSize: '0.8rem'
            }
          }}
          sx={{
            '& .MuiInputBase-input': {
              padding: '0 8px!important'
            }
          }}
        />
      )}
    </Box>
  </Box>
));

export default InputGroup;
