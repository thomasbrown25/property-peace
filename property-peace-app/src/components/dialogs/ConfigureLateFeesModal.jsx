import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  InputLabel,
  IconButton,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Divider,
  Grid,
  CircularProgress
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { CloseOutlined } from '@ant-design/icons';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import { openSnackbar } from 'api/snackbar';

// Generate day options for "Applied" and "Starting" dropdowns
const generateDayOptions = (maxDays = 30) => {
  const options = [];
  for (let i = 1; i <= maxDays; i++) {
    options.push({
      id: i,
      label: `${i} day${i !== 1 ? 's' : ''} after rent is due`,
      value: i
    });
  }
  return options;
};

const dayOptions = generateDayOptions(30);

export default function ConfigureLateFeesModal({ 
  open, 
  onClose, 
  onSave, 
  leaseId, 
  propertyState,
  existingLateFees = []
}) {
  const [loading, setLoading] = useState(false);

  // One-time initial fee state
  const [oneTimeEnabled, setOneTimeEnabled] = useState(false);
  const [oneTimeFeeType, setOneTimeFeeType] = useState('Flat');
  const [oneTimeAmount, setOneTimeAmount] = useState('');
  const [oneTimePercentValue, setOneTimePercentValue] = useState('');
  const [oneTimeAppliedAfterDays, setOneTimeAppliedAfterDays] = useState(1);

  // Daily late fees state
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [dailyAmount, setDailyAmount] = useState('');
  const [dailyStartingAfterDays, setDailyStartingAfterDays] = useState(2);
  const [limitType, setLimitType] = useState('NoLimit');
  const [limitDays, setLimitDays] = useState(1);
  const [limitAmount, setLimitAmount] = useState('');
  const [limitAmountType, setLimitAmountType] = useState('Flat');

  // Load existing late fees
  useEffect(() => {
    if (open && existingLateFees && existingLateFees.length > 0) {
      const oneTimeFee = existingLateFees.find(f => f.lateFeeType === 'OneTime');
      const dailyFee = existingLateFees.find(f => f.lateFeeType === 'Daily');

      if (oneTimeFee) {
        setOneTimeEnabled(true);
        setOneTimeFeeType(oneTimeFee.feeType || 'Flat');
        setOneTimeAmount(oneTimeFee.feeType === 'Flat' ? oneTimeFee.amount?.toString() || '' : '');
        setOneTimePercentValue(oneTimeFee.feeType !== 'Flat' ? oneTimeFee.percentValue?.toString() || '' : '');
        setOneTimeAppliedAfterDays(oneTimeFee.appliedAfterDays || 1);
      }

      if (dailyFee) {
        setDailyEnabled(true);
        setDailyAmount(dailyFee.amount?.toString() || '');
        setDailyStartingAfterDays(dailyFee.startingAfterDays || 2);
        setLimitType(dailyFee.limitType || 'NoLimit');
        setLimitDays(dailyFee.limitDays || 1);
        setLimitAmount(dailyFee.limitAmount?.toString() || '');
        setLimitAmountType(dailyFee.limitAmountType || 'Flat');
      }
    } else if (open) {
      // Reset form when opening with no existing fees
      resetForm();
    }
  }, [open, existingLateFees]);

  const resetForm = () => {
    setOneTimeEnabled(false);
    setOneTimeFeeType('Flat');
    setOneTimeAmount('');
    setOneTimePercentValue('');
    setOneTimeAppliedAfterDays(1);
    setDailyEnabled(false);
    setDailyAmount('');
    setDailyStartingAfterDays(2);
    setLimitType('NoLimit');
    setLimitDays(1);
    setLimitAmount('');
    setLimitAmountType('Flat');
  };

  const handleSave = async () => {
    if (!oneTimeEnabled && !dailyEnabled) {
      openSnackbar({
        open: true,
        message: 'Please enable at least one late fee type',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    // Validate one-time fee if enabled
    if (oneTimeEnabled) {
      if (oneTimeFeeType === 'Flat' && (!oneTimeAmount || parseFloat(oneTimeAmount) <= 0)) {
        openSnackbar({
          open: true,
          message: 'Please enter a valid one-time fee amount',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
      if (oneTimeFeeType !== 'Flat' && (!oneTimePercentValue || parseFloat(oneTimePercentValue) <= 0)) {
        openSnackbar({
          open: true,
          message: 'Please enter a valid percentage value',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
    }

    // Validate daily fee if enabled
    if (dailyEnabled) {
      if (!dailyAmount || parseFloat(dailyAmount) <= 0) {
        openSnackbar({
          open: true,
          message: 'Please enter a valid daily fee amount',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
      if (limitType === 'MaxTotal') {
        if (!limitAmount || parseFloat(limitAmount) <= 0) {
          openSnackbar({
            open: true,
            message: 'Please enter a valid limit amount',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          return;
        }
      }
    }

    setLoading(true);
    try {
      const lateFees = [];

      // Create one-time fee if enabled
      if (oneTimeEnabled) {
        lateFees.push({
          name: 'Late Fee (One-time)',
          isLateFee: true,
          lateFeeType: 'OneTime',
          feeType: oneTimeFeeType,
          amount: oneTimeFeeType === 'Flat' ? parseFloat(oneTimeAmount) : 0,
          percentValue: oneTimeFeeType !== 'Flat' ? parseFloat(oneTimePercentValue) : null,
          appliedAfterDays: oneTimeAppliedAfterDays,
          dueDate: new Date().toISOString() // Placeholder, will be calculated based on rent due date
        });
      }

      // Create daily fee if enabled
      if (dailyEnabled) {
        lateFees.push({
          name: 'Late Fee (Daily)',
          isLateFee: true,
          lateFeeType: 'Daily',
          feeType: 'Flat', // Daily fees are always flat
          amount: parseFloat(dailyAmount),
          startingAfterDays: dailyStartingAfterDays,
          limitType: limitType,
          limitDays: limitType === 'StopAfterDays' ? limitDays : null,
          limitAmount: limitType === 'MaxTotal' ? parseFloat(limitAmount) : null,
          limitAmountType: limitType === 'MaxTotal' ? limitAmountType : null,
          dueDate: new Date().toISOString() // Placeholder
        });
      }

      await onSave(lateFees);
      onClose();
    } catch (error) {
      console.error('Error saving late fees:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save late fees',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Configure automatic late fees
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary'
          }}
        >
          <CloseOutlined />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={3}>
          {/* One-time Initial Fee Section */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={oneTimeEnabled}
                  onChange={(e) => setOneTimeEnabled(e.target.checked)}
                />
              }
              label={
                <Typography variant="subtitle1" fontWeight={600}>
                  One-time initial fee
                </Typography>
              }
            />

            {oneTimeEnabled && (
              <Box sx={{ mt: 2, ml: 4 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <FormControl fullWidth>
                      <FormLabel sx={{ mb: 1 }}>Fee Type</FormLabel>
                      <ToggleButtonGroup
                        value={oneTimeFeeType}
                        exclusive
                        onChange={(e, newValue) => {
                          if (newValue !== null) {
                            setOneTimeFeeType(newValue);
                            // Clear amount when switching types
                            setOneTimeAmount('');
                            setOneTimePercentValue('');
                          }
                        }}
                        fullWidth
                        size="small"
                      >
                        <ToggleButton value="Flat">Flat</ToggleButton>
                        <ToggleButton value="PercentRent">% Rent</ToggleButton>
                        <ToggleButton value="PercentUnpaid">% Unpaid</ToggleButton>
                      </ToggleButtonGroup>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    {oneTimeFeeType === 'Flat' ? (
                      <Stack sx={{ gap: 1 }}>
                        <InputLabel htmlFor="one-time-amount-input">Amount</InputLabel>
                        <NumericFormat
                          customInput={TextField}
                          id="one-time-amount-input"
                          fullWidth
                          size="small"
                          value={oneTimeAmount || ''}
                          onValueChange={(values) => {
                            setOneTimeAmount(values.floatValue != null ? String(values.floatValue) : '');
                          }}
                          thousandSeparator
                          prefix="$"
                          decimalScale={2}
                          fixedDecimalScale
                          placeholder="$0.00"
                        />
                      </Stack>
                    ) : (
                      <FormInput
                        name="oneTimePercentValue"
                        label="Amount (%)"
                        type="text"
                        placeholder="0"
                        value={oneTimePercentValue}
                        setFieldValue={(name, value) => {
                          setOneTimePercentValue(value);
                        }}
                        fullWidth
                      />
                    )}
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormSelect
                      name="oneTimeAppliedAfterDays"
                      label="Applied"
                      options={dayOptions}
                      value={oneTimeAppliedAfterDays}
                      setFieldValue={(name, value) => {
                        setOneTimeAppliedAfterDays(value);
                      }}
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>

          <Divider />

          {/* Daily Late Fees Section */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={dailyEnabled}
                  onChange={(e) => setDailyEnabled(e.target.checked)}
                />
              }
              label={
                <Typography variant="subtitle1" fontWeight={600}>
                  Daily late fees
                </Typography>
              }
            />

            {dailyEnabled && (
              <Box sx={{ mt: 2, ml: 4 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack sx={{ gap: 1 }}>
                      <InputLabel htmlFor="daily-amount-input">Amount</InputLabel>
                      <NumericFormat
                        customInput={TextField}
                        id="daily-amount-input"
                        fullWidth
                        size="small"
                        value={dailyAmount || ''}
                        onValueChange={(values) => {
                          setDailyAmount(values.floatValue != null ? String(values.floatValue) : '');
                        }}
                        thousandSeparator
                        prefix="$"
                        decimalScale={2}
                        fixedDecimalScale
                        placeholder="$0.00"
                      />
                    </Stack>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormSelect
                      name="dailyStartingAfterDays"
                      label="Starting"
                      options={dayOptions}
                      value={dailyStartingAfterDays}
                      setFieldValue={(name, value) => {
                        setDailyStartingAfterDays(value);
                      }}
                      fullWidth
                    />
                  </Grid>

                  {/* Late Fee Limit Section */}
                  <Grid size={{ xs: 12 }}>
                    <FormControl component="fieldset" fullWidth>
                      <FormLabel sx={{ mb: 1 }}>Late fee limit</FormLabel>
                      <RadioGroup
                        value={limitType}
                        onChange={(e) => setLimitType(e.target.value)}
                      >
                        <FormControlLabel
                          value="NoLimit"
                          control={<Radio size="small" />}
                          label="No limit"
                        />
                        <FormControlLabel
                          value="StopAfterDays"
                          control={<Radio size="small" />}
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography>Stop daily fees after</Typography>
                              {limitType === 'StopAfterDays' && (
                                <Box sx={{ minWidth: 100 }}>
                                  <FormSelect
                                    name="limitDays"
                                    options={dayOptions}
                                    value={limitDays}
                                    setFieldValue={(name, value) => {
                                      setLimitDays(value);
                                    }}
                                    fullWidth={false}
                                  />
                                </Box>
                              )}
                              <Typography>days</Typography>
                            </Box>
                          }
                        />
                        <FormControlLabel
                          value="MaxTotal"
                          control={<Radio size="small" />}
                          label={
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 1 }}>
                              <Typography>Total late fees should not exceed</Typography>
                              {limitType === 'MaxTotal' && (
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <ToggleButtonGroup
                                    value={limitAmountType}
                                    exclusive
                                    onChange={(e, newValue) => {
                                      if (newValue !== null) {
                                        setLimitAmountType(newValue);
                                        setLimitAmount('');
                                      }
                                    }}
                                    size="small"
                                  >
                                    <ToggleButton value="Flat">Flat</ToggleButton>
                                    <ToggleButton value="PercentRent">% Rent</ToggleButton>
                                  </ToggleButtonGroup>
                                  <Box sx={{ minWidth: 120 }}>
                                    {limitAmountType === 'Flat' ? (
                                      <NumericFormat
                                        customInput={TextField}
                                        id="limit-amount-input"
                                        fullWidth
                                        size="small"
                                        value={limitAmount || ''}
                                        onValueChange={(values) => {
                                          setLimitAmount(values.floatValue != null ? String(values.floatValue) : '');
                                        }}
                                        thousandSeparator
                                        prefix="$"
                                        decimalScale={2}
                                        fixedDecimalScale
                                        placeholder="$0.00"
                                      />
                                    ) : (
                                      <FormInput
                                        name="limitAmount"
                                        type="text"
                                        placeholder="0"
                                        value={limitAmount}
                                        setFieldValue={(name, value) => {
                                          setLimitAmount(value);
                                        }}
                                        fullWidth={false}
                                      />
                                    )}
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          }
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
