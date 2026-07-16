import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Collapse,
  Divider
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';

// ==============================|| TIMESPAN FILTER ||============================== //

const TIMESPAN_OPTIONS = [
  { value: '1hour', label: 'Last 1 hour' },
  { value: '6hours', label: 'Last 6 hours' },
  { value: '24hours', label: 'Last 24 hours' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
  { value: 'custom', label: 'Custom' }
];

export default function TimespanFilter({ value, onChange }) {
  const [timespan, setTimespan] = useState(value?.timespan || 'month');
  const [customStartDate, setCustomStartDate] = useState(value?.customStartDate || null);
  const [customStartTime, setCustomStartTime] = useState(value?.customStartTime || null);
  const [customEndDate, setCustomEndDate] = useState(value?.customEndDate || null);
  const [customEndTime, setCustomEndTime] = useState(value?.customEndTime || null);

  // Calculate date ranges for presets
  const calculateDateRange = (preset) => {
    const now = new Date();
    let startDate = new Date();

    switch (preset) {
      case '1hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6hours':
        startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24hours':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return null;
    }

    return {
      dateFrom: startDate,
      dateTo: now
    };
  };

  // Sync local state with prop value
  useEffect(() => {
    if (value) {
      setTimespan(value.timespan || 'month');
      setCustomStartDate(value.customStartDate || null);
      setCustomStartTime(value.customStartTime || null);
      setCustomEndDate(value.customEndDate || null);
      setCustomEndTime(value.customEndTime || null);
    }
  }, [value]);

  // Update parent when timespan changes
  useEffect(() => {
    if (timespan !== 'custom') {
      const range = calculateDateRange(timespan);
      if (range) {
        onChange({
          timespan,
          dateFrom: range.dateFrom,
          dateTo: range.dateTo
        });
      }
    } else {
      // For custom, use the date/time pickers
      if (customStartDate && customEndDate) {
        const startDateTime = new Date(customStartDate);
        if (customStartTime) {
          startDateTime.setHours(customStartTime.getHours(), customStartTime.getMinutes(), customStartTime.getSeconds());
        }

        const endDateTime = new Date(customEndDate);
        if (customEndTime) {
          endDateTime.setHours(customEndTime.getHours(), customEndTime.getMinutes(), customEndTime.getSeconds());
        }

        onChange({
          timespan: 'custom',
          dateFrom: startDateTime,
          dateTo: endDateTime,
          customStartDate,
          customStartTime,
          customEndDate,
          customEndTime
        });
      }
    }
  }, [timespan, customStartDate, customStartTime, customEndDate, customEndTime]);

  const handleTimespanChange = (event) => {
    setTimespan(event.target.value);
  };

  const isCustom = timespan === 'custom';

  return (
    <Box sx={{ minWidth: 320, maxWidth: 400 }}>
      <FormControl component="fieldset" fullWidth>
        <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 500 }}>
          Timespan
        </FormLabel>
        <RadioGroup
          value={timespan}
          onChange={handleTimespanChange}
          sx={{ gap: 0.5 }}
        >
          {TIMESPAN_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio size="small" />}
              label={option.label}
              sx={{
                margin: 0,
                '& .MuiFormControlLabel-label': {
                  fontSize: '0.875rem'
                }
              }}
            />
          ))}
        </RadioGroup>

        {/* Custom date/time pickers - expand/collapse */}
        <Collapse in={isCustom} timeout="auto" unmountOnExit>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={2.5}>
            <Box>
              <FormLabel sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                Start time
              </FormLabel>
              <Stack spacing={1} direction="row">
                <DatePicker
                  label="Date"
                  value={customStartDate}
                  onChange={setCustomStartDate}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
                <TimePicker
                  label="Time"
                  value={customStartTime}
                  onChange={setCustomStartTime}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Stack>
            </Box>

            <Box>
              <FormLabel sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 500 }}>
                End time
              </FormLabel>
              <Stack spacing={1} direction="row">
                <DatePicker
                  label="Date"
                  value={customEndDate}
                  onChange={setCustomEndDate}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
                <TimePicker
                  label="Time"
                  value={customEndTime}
                  onChange={setCustomEndTime}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Stack>
            </Box>
          </Stack>
        </Collapse>
      </FormControl>
    </Box>
  );
}

TimespanFilter.propTypes = {
  value: PropTypes.shape({
    timespan: PropTypes.string,
    dateFrom: PropTypes.instanceOf(Date),
    dateTo: PropTypes.instanceOf(Date),
    customStartDate: PropTypes.instanceOf(Date),
    customStartTime: PropTypes.instanceOf(Date),
    customEndDate: PropTypes.instanceOf(Date),
    customEndTime: PropTypes.instanceOf(Date)
  }),
  onChange: PropTypes.func.isRequired
};
