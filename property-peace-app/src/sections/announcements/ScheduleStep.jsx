import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import { Box, Typography, Radio, TextField, Stack, Alert, alpha, useTheme } from '@mui/material';
import { ClockCircleOutlined, SendOutlined } from '@ant-design/icons';

// ==============================|| SCHEDULE STEP ||============================== //

const scheduleOptions = [
  {
    value: 'now',
    title: 'Send immediately',
    description: 'Send as soon as you confirm the announcement.',
    icon: <SendOutlined />
  },
  {
    value: 'scheduled',
    title: 'Schedule for later',
    description: 'Pick a future date and time for the announcement.',
    icon: <ClockCircleOutlined />
  }
];

export default function ScheduleStep({ scheduleType, scheduledDateTime, onScheduleTypeChange, onScheduledDateTimeChange }) {
  const theme = useTheme();
  const [dateError, setDateError] = useState(null);

  // Get default datetime (current date/time)
  const getDefaultDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Initialize with default if not provided
  useEffect(() => {
    if (!scheduledDateTime) {
      const defaultDateTime = getDefaultDateTime();
      onScheduledDateTimeChange(defaultDateTime);
    }
  }, []); // Only run once on mount

  const handleScheduleTypeChange = (newType) => {
    onScheduleTypeChange(newType);
    
    // Clear date error when switching to "now"
    if (newType === 'now') {
      setDateError(null);
    }
  };

  const handleDateTimeChange = (event) => {
    const value = event.target.value;
    onScheduledDateTimeChange(value);
    
    // Validate that the date/time is in the future
    if (value) {
      const selectedDate = new Date(value);
      const now = new Date();
      
      if (selectedDate <= now) {
        setDateError('Scheduled time must be in the future');
      } else {
        setDateError(null);
      }
    } else {
      setDateError(null);
    }
  };

  // Get minimum datetime (now)
  const getMinDateTime = () => {
    return getDefaultDateTime();
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.75 }}>
        When should it send?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Send right away for urgent updates, or schedule the announcement for a better time.
      </Typography>

      <Stack spacing={1.5}>
        {scheduleOptions.map((option) => {
          const selected = scheduleType === option.value;
          return (
            <Box
              key={option.value}
              role="button"
              tabIndex={0}
              onClick={() => handleScheduleTypeChange(option.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleScheduleTypeChange(option.value);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.055) : 'background.paper',
                border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.45) : alpha(theme.palette.divider, 0.9)}`,
                transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.45),
                  bgcolor: selected ? alpha(theme.palette.primary.main, 0.075) : alpha(theme.palette.primary.main, 0.025)
                },
                '&:focus-visible': {
                  outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                  outlineOffset: 2
                }
              }}
            >
              <Radio checked={selected} onChange={() => handleScheduleTypeChange(option.value)} onClick={(event) => event.stopPropagation()} />
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '& .anticon': { fontSize: 18 }
                }}
              >
                {option.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={700}>{option.title}</Typography>
                <Typography variant="body2" color="text.secondary">{option.description}</Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>

      {scheduleType === 'scheduled' && (
        <Box sx={{ mt: 2.5, p: 2, borderRadius: 2, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.9)}` }}>
          <TextField
            fullWidth
            type="datetime-local"
            label="Scheduled Date & Time"
            value={scheduledDateTime || getDefaultDateTime()}
            onChange={handleDateTimeChange}
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: getMinDateTime()
            }}
            error={!!dateError}
            helperText={dateError || 'Select a future date and time.'}
          />
          {dateError && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>
              {dateError}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
}

ScheduleStep.propTypes = {
  scheduleType: PropTypes.oneOf(['now', 'scheduled']).isRequired,
  scheduledDateTime: PropTypes.string,
  onScheduleTypeChange: PropTypes.func.isRequired,
  onScheduledDateTimeChange: PropTypes.func.isRequired
};
