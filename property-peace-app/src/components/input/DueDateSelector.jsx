import { useState, useEffect } from 'react';
import {
  Box,
  InputLabel,
  TextField,
  Menu,
  MenuItem,
  Typography,
  Divider,
  Stack
} from '@mui/material';
import { KeyboardArrowDown } from '@mui/icons-material';

// Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinalSuffix = (day) => {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

// Convert backend value to display label
const getDisplayLabel = (value) => {
  if (value === -1 || value === 'last' || value === 'lastDay') {
    return 'Last day of the month';
  }
  if (value == null || value === '') {
    return '';
  }
  const day = parseInt(value, 10);
  if (isNaN(day) || day < 1 || day > 28) {
    return '';
  }
  return `${day}${getOrdinalSuffix(day)}`;
};

// Convert display value to backend value
const getBackendValue = (value) => {
  if (value === 'last' || value === 'lastDay' || value === -1) {
    return -1; // Use -1 for "last day of month"
  }
  const day = parseInt(value, 10);
  if (isNaN(day) || day < 1 || day > 28) {
    return null;
  }
  return day;
};

export default function DueDateSelector({ value, onChange, label = 'Due Date', helperText, error, disabled }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  
  // Generate day options (1-28)
  const dayOptions = [];
  for (let day = 1; day <= 28; day++) {
    dayOptions.push({
      value: day.toString(),
      label: `${day}${getOrdinalSuffix(day)}`
    });
  }

  const handleClick = (event) => {
    if (!disabled) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (optionValue) => {
    const backendValue = getBackendValue(optionValue);
    if (onChange) {
      onChange(backendValue);
    }
    handleClose();
  };

  return (
    <Stack sx={{ gap: 1 }}>
      {label && <InputLabel htmlFor={`due-date-selector`}>{label}</InputLabel>}
      <TextField
        id="due-date-selector"
        size="small"
        fullWidth
        disabled={disabled}
        value={getDisplayLabel(value)}
        onClick={handleClick}
        placeholder="Select day"
        error={!!error}
        InputProps={{
          readOnly: true,
          endAdornment: <KeyboardArrowDown sx={{ color: 'text.secondary' }} />
        }}
        sx={{
          cursor: disabled ? 'default' : 'pointer',
          '& .MuiInputBase-input': {
            cursor: disabled ? 'default' : 'pointer'
          }
        }}
      />
      {helperText && (
        <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'}>
          {helperText}
        </Typography>
      )}
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: '360px',
            mt: 1
          }
        }}
        MenuListProps={{
          sx: {
            py: 1
          }
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" fontWeight={600} color="text.secondary">
            Select Day of Month
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ px: 1, py: 1 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 0.5
            }}
          >
            {dayOptions.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => handleSelect(option.value)}
                selected={value === parseInt(option.value, 10)}
                sx={{
                  minHeight: 'auto',
                  py: 1,
                  px: 1,
                  justifyContent: 'center',
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'action.hover'
                  },
                  '&.Mui-selected': {
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
                    '&:hover': {
                      bgcolor: 'success.dark'
                    }
                  }
                }}
              >
                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                  {option.label}
                </Typography>
              </MenuItem>
            ))}
          </Box>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => handleSelect('last')}
          selected={value === -1}
          sx={{
            py: 1.5,
            px: 2,
            '&:hover': {
              bgcolor: 'action.hover'
            },
            '&.Mui-selected': {
              bgcolor: 'success.main',
              color: 'success.contrastText',
              '&:hover': {
                bgcolor: 'success.dark'
              }
            }
          }}
        >
          <Typography variant="body2" fontWeight={500}>
            Last day of the month
          </Typography>
        </MenuItem>
      </Menu>
    </Stack>
  );
}
