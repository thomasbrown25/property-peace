import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Switch,
  FormControlLabel,
  CircularProgress,
  Slide,
  alpha,
  useTheme,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled,
  Card,
  CardContent,
  Chip,
  IconButton,
  Divider
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { CheckCircleOutlined, ArrowLeftOutlined, CloseOutlined } from '@ant-design/icons';
import PropertySelect from 'components/PropertySelect';
import Autocomplete from 'components/@extended/AutoComplete';
import MaintenanceSelect from 'components/MaintenanceSelect';
import ExpenseReceiptUpload from 'components/expense/ExpenseReceiptUpload';
import {
  addExpenseAction, createExpenseWithReceipts, runCompositeExpenseMutation } from 'store/expense/expense.action';
import { addRecurringExpenseAction } from 'store/recurring-expense/recurring-expense.action';
import { addFutureExpenseAction } from 'store/future-expense/future-expense.action';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { getTodayLocalDate } from 'utils/formatters';
import { categorizeExpense } from 'utils/expenseCategorization';

const STEPS = {
  AMOUNT_PROPERTY: 1,
  EXPENSE_TYPE: 2,
  RECEIPTS: 3,
  REVIEW: 4,
  PROCESSING: 5,
  SUCCESS: 6
};

const FREQUENCY_OPTIONS = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Yearly', label: 'Yearly' },
  { value: 'Weekly', label: 'Weekly' }
];

const expenseSteps = ['Details', 'Expense Type', 'Receipts', 'Review'];

const EMPTY_FORM = {
  expenseDescription: '',
  amount: '',
  isRecurring: false,
  frequency: 'Monthly',
  dayOfPeriod: null,
  expenseDate: getTodayLocalDate(),
  endDate: null,
  propertyId: null,
  unitId: null,
  maintenanceRequestId: null,
  receipts: [],
  alreadyPaid: true,
  setToAutoPay: false
};

const getEntityId = (entity) => entity?.id ?? entity?.Id ?? null;

export default function ExpenseAddDrawer({ open, onClose, onSuccess, initialSelection = null }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { properties } = useFetchProperties();

  const isMaintenanceContext = Boolean(initialSelection?.skipPropertyAndMaintenanceSteps || initialSelection?.maintenance);

  const [currentStep, setCurrentStep] = useState(STEPS.EXPENSE_TYPE);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);
  const wasOpenRef = useRef(false);

  // Reset form only when the drawer transitions from closed to open. Parent rerenders
  // can create a new initialSelection object while the drawer is open, especially after
  // maintenance ledger refreshes; those should not bounce the user back to step 1.
  useEffect(() => {
    const shouldInitialize = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (shouldInitialize) {
      const maintenance = initialSelection?.maintenance || null;
      const selectedPropertyId = initialSelection?.propertyId ?? getEntityId(initialSelection?.property) ?? maintenance?.propertyId ?? maintenance?.PropertyId ?? null;
      const selectedUnitId = initialSelection?.unitId ?? getEntityId(initialSelection?.unit) ?? maintenance?.unitId ?? maintenance?.UnitId ?? null;
      const selectedMaintenanceId = initialSelection?.maintenanceRequestId ?? getEntityId(maintenance) ?? null;
      const contextProperty = initialSelection?.property || null;

      setFormData({
        ...EMPTY_FORM,
        expenseDate: getTodayLocalDate(),
        propertyId: selectedPropertyId,
        unitId: selectedUnitId,
        maintenanceRequestId: selectedMaintenanceId
      });
      setSelectedProperty(contextProperty);
      setCurrentStep(STEPS.AMOUNT_PROPERTY);
      setSlideDirection('left');
      setAiResult(null);
      setError(null);
      setProcessing(false);
    }
  }, [open, initialSelection]);

  useEffect(() => {
    if (!open || selectedProperty || !formData.propertyId) return;
    const contextProperty = properties?.find((property) => getEntityId(property) === formData.propertyId) || null;
    if (contextProperty) setSelectedProperty(contextProperty);
  }, [open, selectedProperty, formData.propertyId, properties]);

  const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.active}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
    },
    [`&.${stepConnectorClasses.completed}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
    },
    [`&.${stepConnectorClasses.disabled}`]: {
      [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.grey[300] }
    },
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.grey[300],
      borderTopWidth: 2,
      borderRadius: 1
    }
  }));

  const activeExpenseSteps = useMemo(() => expenseSteps, []);

  const getStepperStep = () => {
    if (currentStep === STEPS.AMOUNT_PROPERTY) return 0;
    if (currentStep === STEPS.EXPENSE_TYPE) return 1;
    if (currentStep === STEPS.RECEIPTS) return 2;
    if (currentStep === STEPS.REVIEW) return 3;
    return 0;
  };

  const isMultiUnitProperty = useMemo(() => {
    const units = selectedProperty?.units || selectedProperty?.Units;
    if (!units) return false;
    return units.length > 1;
  }, [selectedProperty]);

  const unitOptions = useMemo(() => {
    const units = selectedProperty?.units || selectedProperty?.Units;
    if (!units) return [];
    return units.map(unit => ({
      id: getEntityId(unit),
      label: unit.name || unit.Name || `Unit ${getEntityId(unit)}`,
      unit
    }));
  }, [selectedProperty]);

  const hasMultiUnitProperties = useMemo(() => {
    return properties?.some(p => (p.units || p.Units || []).length > 1) || false;
  }, [properties]);

  const isFutureDate = useMemo(() => {
    if (!formData.expenseDate) return false;
    const [y, m, d] = formData.expenseDate.split('-').map(Number);
    const selected = new Date(y, m - 1, d);
    selected.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected.getTime() > today.getTime();
  }, [formData.expenseDate]);

  const isPastDate = useMemo(() => {
    if (!formData.expenseDate) return false;
    const [y, m, d] = formData.expenseDate.split('-').map(Number);
    const selected = new Date(y, m - 1, d);
    selected.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected.getTime() < today.getTime();
  }, [formData.expenseDate]);

  const getDaySuffix = (day) => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep === STEPS.AMOUNT_PROPERTY) {
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setError('Please enter a valid amount');
        return;
      }
      if (!formData.expenseDate) {
        setError('Please choose an expense date');
        return;
      }
      if (!formData.propertyId) {
        setError('Please select a property');
        return;
      }
      if (isMaintenanceContext && !formData.maintenanceRequestId) {
        setError('This maintenance request is missing maintenance linkage. Please refresh and try again.');
        return;
      }
      setError(null);
      transitionToStep(STEPS.EXPENSE_TYPE, 'left');
    } else if (currentStep === STEPS.EXPENSE_TYPE) {
      if (!formData.expenseDescription.trim()) {
        setError('Please describe the expense');
        return;
      }
      setError(null);
      transitionToStep(STEPS.RECEIPTS, 'left');
    } else if (currentStep === STEPS.RECEIPTS) {
      setError(null);
      transitionToStep(STEPS.REVIEW, 'left');
    } else if (currentStep === STEPS.REVIEW) {
      transitionToStep(STEPS.PROCESSING, 'left');
      handleCreateExpense();
    }
  };

  const handleBack = () => {
    if (currentStep === STEPS.REVIEW) {
      transitionToStep(STEPS.RECEIPTS, 'right');
    } else if (currentStep > STEPS.AMOUNT_PROPERTY) {
      transitionToStep(currentStep - 1, 'right');
    }
  };

  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setTimeout(() => setIsAnimating(false), 600);
    }, 50);
  };

  const handlePropertyChange = (property) => {
    setSelectedProperty(property);
    handleChange('propertyId', getEntityId(property));
    handleChange('unitId', null);
  };

  const categorizeExpenseLocally = (description) => categorizeExpense(description);

  const handleCreateExpense = async () => {
    setError(null);
    setProcessing(true);
    const createCompositeExpense = async (commitCoreMutation) => {
      const aiResult = categorizeExpenseLocally(formData.expenseDescription);
      setAiResult(aiResult);
      const dayOfPeriod = formData.isRecurring ? new Date(formData.expenseDate).getDate() : null;
      const receiptFiles = formData.receipts.filter(r => r.file instanceof File).map(r => r.file);

      const calculatePastOccurrences = (startDate, frequency, dayOfPeriod) => {
        const occurrences = [];
        const start = new Date(startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let currentDate = new Date(start);
        currentDate.setDate(dayOfPeriod);
        if (start.getDate() > dayOfPeriod) {
          currentDate = new Date(start);
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(dayOfPeriod);
        }
        const incrementMonths = { 'Monthly': 1, 'Quarterly': 3, 'Yearly': 12 }[frequency] || 1;
        while (currentDate < today) {
          occurrences.push(new Date(currentDate));
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + incrementMonths);
          currentDate.setDate(dayOfPeriod);
        }
        return occurrences;
      };

      let expenseId = null;
      let receiptOutcome = null;

      if (formData.isRecurring) {
        if (formData.alreadyPaid) {
          if (isPastDate) {
            const pastOccurrences = calculatePastOccurrences(formData.expenseDate, formData.frequency, dayOfPeriod);
            for (const occurrenceDate of pastOccurrences) {
              const pastPayload = {
                landlordId: user.id || user.Id,
                propertyId: Number(formData.propertyId),
                unitId: formData.unitId ? Number(formData.unitId) : null,
                name: aiResult.name,
                category: aiResult.category,
                amount: parseFloat(formData.amount),
                expenseDate: occurrenceDate.toISOString().split('T')[0],
                vendor: null, vendorId: null, paymentMethod: null, receiptUrl: null,
                isRecurring: true,
                isTaxDeductible: true, taxCategory: null,
                maintenanceRequestId: formData.maintenanceRequestId || null,
                frequency: formData.frequency,
                dayOfPeriod,
                startDate: formData.expenseDate,
                endDate: formData.endDate || null,
                isPaused: false,
                dueDate: occurrenceDate.toISOString().split('T')[0],
                billDate: occurrenceDate.toISOString().split('T')[0],
                isPaid: true,
                paidDate: new Date().toISOString()
              };
              try { await commitCoreMutation(addExpenseAction(pastPayload, { invalidateLists: false })); } catch { /* non-critical */ }
            }
          }
          const payload = {
            landlordId: user.id || user.Id,
            propertyId: Number(formData.propertyId),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            expenseDate: formData.expenseDate,
            vendor: null, vendorId: null, paymentMethod: null, receiptUrl: null,
            isRecurring: true,
            isTaxDeductible: true, taxCategory: null,
            maintenanceRequestId: formData.maintenanceRequestId || null,
            frequency: formData.frequency,
            dayOfPeriod,
            startDate: formData.expenseDate,
            endDate: formData.endDate || null,
            isPaused: false,
            dueDate: formData.expenseDate,
            billDate: formData.expenseDate,
            isPaid: true,
            paidDate: new Date().toISOString()
          };
          receiptOutcome = await createExpenseWithReceipts({
            commitCoreMutation,
            dispatch,
            createAction: addExpenseAction(payload, { invalidateLists: false }),
            receiptFiles
          });
          expenseId = receiptOutcome.expenseId;
        } else if (receiptFiles.length > 0) {
          const payload = {
            landlordId: user.id || user.Id,
            propertyId: Number(formData.propertyId),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            expenseDate: formData.expenseDate,
            vendor: null, vendorId: null, paymentMethod: null, receiptUrl: null,
            isRecurring: true,
            isTaxDeductible: true, taxCategory: null,
            maintenanceRequestId: formData.maintenanceRequestId || null,
            frequency: formData.frequency,
            dayOfPeriod,
            startDate: formData.expenseDate,
            endDate: formData.endDate || null,
            isPaused: false,
            dueDate: formData.expenseDate,
            billDate: formData.expenseDate,
            isPaid: false,
            paidDate: null
          };
          receiptOutcome = await createExpenseWithReceipts({
            commitCoreMutation,
            dispatch,
            createAction: addExpenseAction(payload, { invalidateLists: false }),
            receiptFiles
          });
          expenseId = receiptOutcome.expenseId;
        }
      } else {
        if (isFutureDate && receiptFiles.length === 0) {
          const futureExpensePayload = {
            landlordId: user.id || user.Id,
            propertyId: Number(formData.propertyId),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            dueDate: formData.expenseDate,
            vendor: null, vendorId: null, paymentMethod: null, notes: null,
            isTaxDeductible: true,
            maintenanceRequestId: formData.maintenanceRequestId || null
          };
          const futureResult = await dispatch(addFutureExpenseAction(futureExpensePayload));
          console.log('[ExpenseAddDrawer] FutureExpense created:', futureResult);
        } else {
          const payload = {
            landlordId: user.id || user.Id,
            propertyId: Number(formData.propertyId),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            expenseDate: formData.expenseDate,
            vendor: null, vendorId: null, paymentMethod: null, receiptUrl: null,
            isRecurring: false,
            isTaxDeductible: true, taxCategory: null,
            maintenanceRequestId: formData.maintenanceRequestId || null,
            frequency: null, dayOfPeriod: null, startDate: null,
            endDate: null,
            isPaused: false,
            dueDate: formData.expenseDate,
            billDate: formData.expenseDate,
            isPaid: !isFutureDate,
            paidDate: isFutureDate ? null : new Date().toISOString()
          };
          receiptOutcome = await createExpenseWithReceipts({
            commitCoreMutation,
            dispatch,
            createAction: addExpenseAction(payload, { invalidateLists: false }),
            receiptFiles
          });
          expenseId = receiptOutcome.expenseId;
        }
      }

      if (formData.isRecurring) {
        try {
          const recurringPayload = {
            landlordId: user.id || user.Id,
            propertyId: Number(formData.propertyId),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            frequency: formData.frequency,
            dayOfPeriod,
            startDate: formData.expenseDate,
            endDate: formData.endDate || null,
            notes: formData.setToAutoPay ? 'Auto-pay enabled' : null,
            vendor: null,
            paymentMethod: formData.setToAutoPay ? 'Auto-Pay' : null,
            isTaxDeductible: true,
            maintenanceRequestId: formData.maintenanceRequestId || null
          };
          await dispatch(addRecurringExpenseAction(recurringPayload));
        } catch (recurringError) {
          console.error('[ExpenseAddDrawer] Error creating recurring template:', recurringError);
          openSnackbar({
            open: true,
            message: 'Expense created but failed to create recurring template',
            variant: 'alert',
            alert: { color: 'warning' }
          });
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setProcessing(false);
      transitionToStep(STEPS.SUCCESS, 'left');
      return receiptOutcome;
    };

    try {
      const creationResult = await runCompositeExpenseMutation(dispatch, createCompositeExpense);
      onSuccess?.();
      if (creationResult?.status === 'created-without-receipts') {
        openSnackbar({
          open: true,
          message: 'Expense created, but receipt upload failed. Open the expense in Finances and use Edit to retry the receipt.',
          variant: 'alert',
          alert: { color: 'warning' }
        });
      }
    } catch (error) {
      console.error('[ExpenseAddDrawer] Error creating expense:', error);
      setError(error?.response?.data?.message || error?.message || 'Failed to create expense');
      setProcessing(false);
      transitionToStep(STEPS.REVIEW, 'right');
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to create expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleAddAnother = () => {
    setFormData({
      ...EMPTY_FORM,
      expenseDate: getTodayLocalDate(),
      propertyId: isMaintenanceContext ? formData.propertyId : null,
      unitId: isMaintenanceContext ? formData.unitId : null,
      maintenanceRequestId: isMaintenanceContext ? formData.maintenanceRequestId : null
    });
    if (!isMaintenanceContext) setSelectedProperty(null);
    setAiResult(null);
    setError(null);
    transitionToStep(STEPS.AMOUNT_PROPERTY, 'right');
  };

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.AMOUNT_PROPERTY:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Add the expense details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Start with the amount, date, property, and unit.
            </Typography>

            <NumericFormat
              customInput={TextField}
              fullWidth
              label="Amount *"
              value={formData.amount}
              onValueChange={(values) => handleChange('amount', values.floatValue || '')}
              thousandSeparator
              prefix="$"
              decimalScale={2}
              fixedDecimalScale
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              type="date"
              label={formData.isRecurring ? 'Start Date *' : 'Expense Date *'}
              value={formData.expenseDate}
              onChange={(e) => handleChange('expenseDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />

            {!formData.isRecurring && isFutureDate && (
              <Alert severity="info" sx={{ mb: 2, textAlign: 'left' }}>
                This expense is due on {new Date(formData.expenseDate + 'T00:00:00').toLocaleDateString()}.
              </Alert>
            )}

            <Box sx={{ mt: 2, textAlign: 'left' }}>
              <PropertySelect
                width="100%"
                onPropertyChange={handlePropertyChange}
                localSelectedProperty={selectedProperty}
              />
            </Box>

            {isMultiUnitProperty && (
              <Box sx={{ mt: 3 }}>
                <Autocomplete
                  options={unitOptions}
                  value={unitOptions.find(u => u.id === formData.unitId) || null}
                  onChange={(event, newValue) => handleChange('unitId', newValue?.id || null)}
                  getOptionLabel={(option) => option?.label || ''}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  label="Unit (Optional)"
                />
              </Box>
            )}

            {hasMultiUnitProperties && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'left' }}>
                If the expense covers the whole property, leave the unit blank.
              </Typography>
            )}

            {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}
          </Box>
        );

      case STEPS.EXPENSE_TYPE:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
              What kind of expense are you adding?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={formData.expenseDescription}
              onChange={(e) => handleChange('expenseDescription', e.target.value)}
              placeholder='e.g., "repair for leaking sink" or "HOA fee"'
              sx={{ mt: 2 }}
            />
            <Stack spacing={2.5} sx={{ mt: 3, textAlign: 'left' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isRecurring}
                    onChange={(e) => handleChange('isRecurring', e.target.checked)}
                    color="primary"
                  />
                }
                label="Is this a recurring expense?"
              />

              {formData.isRecurring && (
                <>
                  <FormControl fullWidth>
                    <InputLabel>Frequency</InputLabel>
                    <Select
                      value={formData.frequency}
                      onChange={(e) => handleChange('frequency', e.target.value)}
                      label="Frequency"
                      sx={{ borderRadius: 2 }}
                    >
                      {FREQUENCY_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    type="date"
                    label="End Date (Optional)"
                    value={formData.endDate || ''}
                    onChange={(e) => handleChange('endDate', e.target.value || null)}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: formData.expenseDate || undefined }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.setToAutoPay}
                        onChange={(e) => handleChange('setToAutoPay', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Set to auto-pay?"
                  />
                  {formData.expenseDate && (() => {
                    const day = parseInt(formData.expenseDate.split('-')[2], 10);
                    return (
                      <Alert severity="info" sx={{ textAlign: 'left' }}>
                        This expense repeats every {formData.frequency.toLowerCase()} on the {day}{getDaySuffix(day)}
                        {formData.endDate ? ` until ${new Date(formData.endDate + 'T00:00:00').toLocaleDateString()}` : ''}.
                      </Alert>
                    );
                  })()}
                </>
              )}

              {isPastDate && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.alreadyPaid}
                      onChange={(e) => handleChange('alreadyPaid', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Have previous payments already been paid?"
                />
              )}

              {!isMaintenanceContext && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Do you want to link this to maintenance?
                  </Typography>
                  <MaintenanceSelect
                    width="100%"
                    value={formData.maintenanceRequestId}
                    onChange={(value) => handleChange('maintenanceRequestId', value)}
                    label="Maintenance Request (Optional)"
                  />
                </Box>
              )}

              {isMaintenanceContext && formData.maintenanceRequestId && (
                <Alert severity="info" sx={{ textAlign: 'left' }}>
                  Linked to maintenance request #{formData.maintenanceRequestId}.
                </Alert>
              )}
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>
        );

      case STEPS.RECEIPTS:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Upload receipts?
            </Typography>
            <Box sx={{ mt: 2 }}>
              <ExpenseReceiptUpload
                receipts={formData.receipts}
                onReceiptsChange={(receipts) => handleChange('receipts', receipts)}
              />
            </Box>
          </Box>
        );

      case STEPS.REVIEW:
        return (
          <Box>
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ mb: 2, textAlign: 'center' }}>
              Review & Confirm
            </Typography>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">Expense</Typography>
                  <Typography variant="body1" fontWeight={500}>{formData.expenseDescription}</Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    ${parseFloat(formData.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    {formData.isRecurring && (
                      <Chip
                        label={`${formData.frequency} recurring`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {formData.isRecurring ? 'Start date' : 'Date'}: {formData.expenseDate}
                    {formData.isRecurring && formData.endDate ? ` → ${formData.endDate}` : ''}
                  </Typography>
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary">Property & Unit</Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedProperty?.name || selectedProperty?.Name || 'No property selected'}
                  </Typography>
                  {formData.unitId && (selectedProperty?.units || selectedProperty?.Units) && (
                    <Chip
                      label={(selectedProperty.units || selectedProperty.Units).find(u => getEntityId(u) === formData.unitId)?.name || (selectedProperty.units || selectedProperty.Units).find(u => getEntityId(u) === formData.unitId)?.Name || `Unit ${formData.unitId}`}
                      variant="outlined"
                      color="primary"
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </CardContent>
              </Card>
              {formData.maintenanceRequestId && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Linked Maintenance Request</Typography>
                    <Typography variant="body1" fontWeight={500}>#{formData.maintenanceRequestId}</Typography>
                  </CardContent>
                </Card>
              )}
              {formData.receipts && formData.receipts.length > 0 && (
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Receipts</Typography>
                    <Typography variant="body1" fontWeight={500}>{formData.receipts.length} receipt(s)</Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </Box>
        );

      case STEPS.PROCESSING:
        return (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={56} sx={{ mb: 3 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Creating your expense…
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Categorizing and naming it — just a moment.
            </Typography>
          </Box>
        );

      case STEPS.SUCCESS:
        return (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircleOutlined style={{ fontSize: 60, color: theme.palette.success.main, marginBottom: 16 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Expense Created!
            </Typography>
            {aiResult && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
                Category: {aiResult.category} · Name: {aiResult.name}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Your expense has been recorded successfully.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                onClick={handleAddAnother}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Add Another
              </Button>
              <Button
                variant="contained"
                onClick={() => { onClose(); navigate('/landlord/finances?tab=expenses'); }}
                sx={{ textTransform: 'none', px: 3 }}
              >
                View Expenses
              </Button>
            </Stack>
          </Box>
        );

      default:
        return null;
    }
  };

  const showNav = currentStep < STEPS.PROCESSING;

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={currentStep === STEPS.PROCESSING ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: 560 },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper'
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.palette.divider}`,
        flexShrink: 0
      }}>
        <Typography variant="h6" fontWeight={600}>Add Expense</Typography>
        <IconButton
          onClick={onClose}
          disabled={currentStep === STEPS.PROCESSING}
          size="small"
        >
          <CloseOutlined />
        </IconButton>
      </Box>

      {/* Stepper */}
      {currentStep < STEPS.PROCESSING && (
        <Box sx={{ px: 2, pt: 2, pb: 1, flexShrink: 0 }}>
          <Stepper
            activeStep={getStepperStep()}
            alternativeLabel
            connector={<CustomStepConnector />}
          >
            {activeExpenseSteps.map((label, index) => (
              <Step key={label} completed={index < getStepperStep()}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': { fontSize: '0.65rem' }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      <Divider />

      {/* Step content — scrollable */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3, position: 'relative' }}>
        <Slide
          direction={slideDirection === 'left' ? 'left' : 'right'}
          in={true}
          timeout={400}
          mountOnEnter
          unmountOnExit
          key={currentStep}
        >
          <Box>{renderStep()}</Box>
        </Slide>
      </Box>

      {/* Navigation */}
      {showNav && (
        <>
          <Divider />
          <Box sx={{
            px: 3,
            py: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}>
            <Button
              onClick={handleBack}
              disabled={currentStep === STEPS.AMOUNT_PROPERTY || processing}
              startIcon={<ArrowLeftOutlined />}
              sx={{ textTransform: 'none', px: 3 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={processing}
              sx={{ textTransform: 'none', px: 4 }}
            >
              {currentStep === STEPS.REVIEW ? 'Create Expense' : 'Next'}
            </Button>
          </Box>
        </>
      )}
    </ThemeAdaptiveDrawer>
  );
}
