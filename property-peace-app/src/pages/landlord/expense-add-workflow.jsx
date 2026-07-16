import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  Divider,
  Chip,
  Paper
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertySelect from 'components/PropertySelect';
import Autocomplete from 'components/@extended/AutoComplete';
import MaintenanceSelect from 'components/MaintenanceSelect';
import ExpenseReceiptUpload from 'components/expense/ExpenseReceiptUpload';
import { addExpenseAction, uploadExpenseReceiptsAction } from 'store/expense/expense.action';
import { addRecurringExpenseAction } from 'store/recurring-expense/recurring-expense.action';
import { addFutureExpenseAction } from 'store/future-expense/future-expense.action';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { getTodayLocalDate } from 'utils/formatters';
import { generateChatCompletion, isConfigured } from 'services/azureAIService';

const STEPS = {
  EXPENSE_TYPE: 1,
  AMOUNT_AND_DATE: 2,
  PROPERTY_UNIT: 3,
  MAINTENANCE_LINK: 4,
  RECEIPTS: 5,
  REVIEW: 6,
  PROCESSING: 7,
  SUCCESS: 8
};

const FREQUENCY_OPTIONS = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Yearly', label: 'Yearly' },
  { value: 'Weekly', label: 'Weekly' }
];

const expenseSteps = ['Expense Type', 'Amount & Date', 'Property & Unit', 'Link Maintenance', 'Receipts', 'Review'];

export default function ExpenseAddWorkflow() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { properties } = useFetchProperties();
  const [currentStep, setCurrentStep] = useState(STEPS.EXPENSE_TYPE);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    expenseDescription: '',
    amount: '',
    isRecurring: false,
    frequency: 'Monthly',
    dayOfPeriod: null,
    expenseDate: getTodayLocalDate(),
    propertyId: null,
    unitId: null,
    maintenanceRequestId: null,
    receipts: [],
    alreadyPaid: false,
    setToAutoPay: false
  });

  const [selectedProperty, setSelectedProperty] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [error, setError] = useState(null);

  // Custom StepConnector for expense workflow
  const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.active}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.primary.main
      }
    },
    [`&.${stepConnectorClasses.completed}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.primary.main
      }
    },
    [`&.${stepConnectorClasses.disabled}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.grey[300]
      }
    },
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.grey[300],
      borderTopWidth: 2,
      borderRadius: 1
    }
  }));

  // Map current step to stepper step (exclude PROCESSING and SUCCESS)
  const getStepperStep = () => {
    if (currentStep === STEPS.EXPENSE_TYPE) return 0;
    if (currentStep === STEPS.AMOUNT_AND_DATE) return 1;
    if (currentStep === STEPS.PROPERTY_UNIT) return 2;
    if (currentStep === STEPS.MAINTENANCE_LINK) return 3;
    if (currentStep === STEPS.RECEIPTS) return 4;
    if (currentStep === STEPS.REVIEW) return 5;
    return 0;
  };

  // Check if property is multi-unit
  const isMultiUnitProperty = useMemo(() => {
    if (!selectedProperty?.units) return false;
    return selectedProperty.units.length > 1;
  }, [selectedProperty]);

  // Unit options for selected property
  const unitOptions = useMemo(() => {
    if (!selectedProperty?.units) return [];
    return selectedProperty.units.map(unit => ({
      id: unit.id,
      label: unit.name || `Unit ${unit.id}`,
      unit
    }));
  }, [selectedProperty]);

  // Check if any property is multi-unit
  const hasMultiUnitProperties = useMemo(() => {
    return properties?.some(p => p.units && p.units.length > 1) || false;
  }, [properties]);

  // Check if date is in the future
  const isFutureDate = useMemo(() => {
    if (!formData.expenseDate) return false;
    
    // Parse the date string (YYYY-MM-DD) as a local date to avoid timezone issues
    const dateParts = formData.expenseDate.split('-');
    const selectedDate = new Date(
      parseInt(dateParts[0]), // year
      parseInt(dateParts[1]) - 1, // month (0-indexed)
      parseInt(dateParts[2]) // day
    );
    selectedDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return selectedDate.getTime() > today.getTime();
  }, [formData.expenseDate]);

  // Check if date is yesterday or before (not including today)
  // Only show "Have previous payments already been paid?" switch if expense date is before today
  const isPastDate = useMemo(() => {
    if (!formData.expenseDate) return false;
    
    // Parse the date string (YYYY-MM-DD) as a local date to avoid timezone issues
    // new Date("2026-01-31") interprets as UTC, which can shift to previous day in EST
    const dateParts = formData.expenseDate.split('-');
    const selectedDate = new Date(
      parseInt(dateParts[0]), // year
      parseInt(dateParts[1]) - 1, // month (0-indexed)
      parseInt(dateParts[2]) // day
    );
    selectedDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only return true if the date is strictly before today (yesterday or earlier)
    // If today is 1/31, only show switch if expense date is 1/30 or earlier
    const result = selectedDate.getTime() < today.getTime();
    console.log('[ExpenseAddWorkflow] isPastDate', { 
      expenseDateString: formData.expenseDate,
      selectedDate, 
      today,
      result 
    });
    
    return result;
  }, [formData.expenseDate]);

  // Helper function to get day suffix (1st, 2nd, 3rd, 4th, etc.)
  const getDaySuffix = (day) => {
    if (day >= 11 && day <= 13) {
      return 'th';
    }
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
    if (currentStep === STEPS.EXPENSE_TYPE) {
      if (!formData.expenseDescription.trim()) {
        setError('Please describe the expense');
        return;
      }
      setError(null);
      transitionToStep(STEPS.AMOUNT_AND_DATE, 'left');
    } else if (currentStep === STEPS.AMOUNT_AND_DATE) {
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setError('Please enter a valid amount');
        return;
      }
      setError(null);
      transitionToStep(STEPS.PROPERTY_UNIT, 'left');
    } else if (currentStep === STEPS.PROPERTY_UNIT) {
      if (!selectedProperty?.id) {
        setError('Please select a property');
        return;
      }
      setError(null);
      transitionToStep(STEPS.MAINTENANCE_LINK, 'left');
    } else if (currentStep === STEPS.MAINTENANCE_LINK) {
      // Maintenance linking is optional, so we can always proceed
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
    if (currentStep > STEPS.EXPENSE_TYPE) {
      transitionToStep(currentStep - 1, 'right');
    }
  };

  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setIsAnimating(true);
    // Small delay to ensure slide direction is set before changing step
    setTimeout(() => {
      setCurrentStep(newStep);
      // Reset animation state after transition completes
      setTimeout(() => {
        setIsAnimating(false);
      }, 600);
    }, 50);
  };

  const handlePropertyChange = (property) => {
    setSelectedProperty(property);
    handleChange('propertyId', property?.id || null);
    handleChange('unitId', null); // Reset unit when property changes
  };

  // AI function to categorize and name expense
  const categorizeExpenseWithAI = async (description) => {
    if (!isConfigured()) {
      // Fallback to simple categorization
      return {
        category: 'Other',
        name: description.length > 50 ? description.substring(0, 50) : description
      };
    }

    try {
      const categoryList = 'Application Fee, Screening, Auto & Travel, Car Rental, Water tank, Repairs, Maintenance, Utilities, HOA, Insurance, Taxes, Landscaping, Cleaning, Advertising, Legal, Accounting, Property Management, Capital Improvements, Supplies, Other';
      
      const prompt = `Based on this expense description: "${description}", determine:
1. The most appropriate expense category from this list: ${categoryList}
2. A clear, concise name for this expense (max 50 characters)

Respond in JSON format:
{
  "category": "category name",
  "name": "expense name"
}`;

      const messages = [
        { role: 'system', content: 'You are a helpful assistant that categorizes property management expenses. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ];

      const response = await generateChatCompletion(messages, { temperature: 0.3, maxTokens: 200 });
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          category: parsed.category || 'Other',
          name: parsed.name || (description.length > 50 ? description.substring(0, 50) : description)
        };
      }
    } catch (error) {
      console.error('AI categorization error:', error);
    }

    // Fallback
    return {
      category: 'Other',
      name: description.length > 50 ? description.substring(0, 50) : description
    };
  };

  const handleCreateExpense = async () => {
    setError(null);
    setProcessing(true);

    try {
      // Use AI to categorize and name the expense
      const aiResult = await categorizeExpenseWithAI(formData.expenseDescription);
      setAiResult(aiResult);

      // Calculate dayOfPeriod for recurring expenses
      const dayOfPeriod = formData.isRecurring ? new Date(formData.expenseDate).getDate() : null;

      // Helper function to calculate past occurrences for recurring expenses
      const calculatePastOccurrences = (startDate, frequency, dayOfPeriod, endDate = null) => {
        const occurrences = [];
        const start = new Date(startDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let currentDate = new Date(start);
        currentDate.setDate(dayOfPeriod);
        
        // If start date is before the day of period in that month, start from that month
        if (start.getDate() > dayOfPeriod) {
          currentDate = new Date(start);
          currentDate.setMonth(currentDate.getMonth() + 1);
          currentDate.setDate(dayOfPeriod);
        }
        
        const incrementMonths = {
          'Monthly': 1,
          'Quarterly': 3,
          'Yearly': 12
        }[frequency] || 1;
        
        while (currentDate < today) {
          if (!endDate || currentDate <= new Date(endDate)) {
            occurrences.push(new Date(currentDate));
          }
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + incrementMonths);
          currentDate.setDate(dayOfPeriod);
        }
        
        return occurrences;
      };

      let expenseId = null;

      // Handle recurring expenses
      if (formData.isRecurring) {
        // For recurring expenses, only create Expense records if "already paid" is checked
        if (formData.alreadyPaid) {
          // Create expense instances for past occurrences if already paid and recurring
          if (isPastDate) {
          const pastOccurrences = calculatePastOccurrences(
            formData.expenseDate,
            formData.frequency,
            dayOfPeriod
          );
          
          console.log('[ExpenseAddWorkflow] Creating past expense instances for already paid recurring expense. Occurrences:', pastOccurrences.length);
          
          // Create expense instances for each past occurrence
          for (const occurrenceDate of pastOccurrences) {
            const pastPayload = {
              landlordId: user.id || user.Id,
              propertyId: Number(selectedProperty.id),
              unitId: formData.unitId ? Number(formData.unitId) : null,
              name: aiResult.name,
              category: aiResult.category,
              amount: parseFloat(formData.amount),
              expenseDate: occurrenceDate.toISOString().split('T')[0],
              vendor: null,
              vendorId: null,
              paymentMethod: null,
              receiptUrl: null,
              isRecurring: true,
              isTaxDeductible: true, // Default to tax deductible for rental property expenses
              taxCategory: null,
              maintenanceRequestId: formData.maintenanceRequestId || null,
              frequency: formData.frequency,
              dayOfPeriod: dayOfPeriod,
              startDate: formData.expenseDate,
              endDate: null,
              isPaused: false,
              dueDate: occurrenceDate.toISOString().split('T')[0],
              billDate: occurrenceDate.toISOString().split('T')[0],
              isPaid: true,
              paidDate: new Date().toISOString() // Include time, not just date
            };
            
            try {
              await dispatch(addExpenseAction(pastPayload));
            } catch (error) {
              console.error(`[ExpenseAddWorkflow] Error creating past expense for ${occurrenceDate.toISOString().split('T')[0]}:`, error);
            }
          }
        }

          // Create the current expense instance for recurring expense
          const payload = {
            landlordId: user.id || user.Id,
            propertyId: Number(selectedProperty.id),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            expenseDate: formData.expenseDate,
            vendor: null,
            vendorId: null,
            paymentMethod: null,
            receiptUrl: null,
            isRecurring: true,
            isTaxDeductible: true, // Default to tax deductible for rental property expenses
            taxCategory: null,
            maintenanceRequestId: formData.maintenanceRequestId || null,
            frequency: formData.frequency,
            dayOfPeriod: dayOfPeriod,
            startDate: formData.expenseDate,
            endDate: null,
            isPaused: false,
            dueDate: formData.expenseDate,
            billDate: formData.expenseDate,
            isPaid: true,
            paidDate: new Date().toISOString()
          };

          console.log('[ExpenseAddWorkflow] Creating expense instance for recurring expense with alreadyPaid checked');
          const result = await dispatch(addExpenseAction(payload));
          expenseId = result?.id || result?.data?.id;
        } else {
          // Recurring expense without alreadyPaid checked - only create template
          console.log('[ExpenseAddWorkflow] Skipping Expense creation - recurring expense without alreadyPaid, will only create template');
        }
      } else {
        // Handle non-recurring expenses
        // For non-recurring expenses, check if date is in future
        if (isFutureDate) {
          // Create FutureExpense for future-dated expenses (not marked as paid)
          console.log('[ExpenseAddWorkflow] Creating FutureExpense for future-dated expense');
          const futureExpensePayload = {
            landlordId: user.id || user.Id,
            propertyId: Number(selectedProperty.id),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            dueDate: formData.expenseDate,
            vendor: null,
            vendorId: null,
            paymentMethod: null,
            notes: null,
            isTaxDeductible: true, // Default to tax deductible for rental property expenses
            maintenanceRequestId: formData.maintenanceRequestId || null
          };

          const futureResult = await dispatch(addFutureExpenseAction(futureExpensePayload));
          console.log('[ExpenseAddWorkflow] FutureExpense created successfully:', futureResult);
        } else {
          // Create Expense record for past/current dates
          // By default, mark as paid (since it's not future and not recurring)
          const payload = {
            landlordId: user.id || user.Id,
            propertyId: Number(selectedProperty.id),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            expenseDate: formData.expenseDate,
            vendor: null,
            vendorId: null,
            paymentMethod: null,
            receiptUrl: null,
            isRecurring: false,
            isTaxDeductible: true, // Default to tax deductible for rental property expenses
            taxCategory: null,
            maintenanceRequestId: formData.maintenanceRequestId || null,
            frequency: null,
            dayOfPeriod: null,
            startDate: null,
            endDate: null,
            isPaused: false,
            dueDate: formData.expenseDate,
            billDate: formData.expenseDate,
            isPaid: true, // Mark as paid by default for non-recurring, non-future expenses
            paidDate: new Date().toISOString()
          };

          console.log('[ExpenseAddWorkflow] Creating non-recurring expense (marked as paid by default)');
          const result = await dispatch(addExpenseAction(payload));
          expenseId = result?.id || result?.data?.id;
        }
      }

      // If this is a recurring expense, create a RecurringExpense template
      // Note: We create the template regardless of expenseId (which may be null if alreadyPaid is false)
      if (formData.isRecurring) {
        try {
          console.log('[ExpenseAddWorkflow] Creating RecurringExpense template...');
          const recurringExpensePayload = {
            landlordId: user.id || user.Id,
            propertyId: Number(selectedProperty.id),
            unitId: formData.unitId ? Number(formData.unitId) : null,
            name: aiResult.name,
            category: aiResult.category,
            amount: parseFloat(formData.amount),
            frequency: formData.frequency,
            dayOfPeriod: dayOfPeriod,
            startDate: formData.expenseDate,
            endDate: null,
            notes: formData.setToAutoPay ? 'Auto-pay enabled' : null,
            vendor: null,
            paymentMethod: formData.setToAutoPay ? 'Auto-Pay' : null,
            isTaxDeductible: true, // Default to tax deductible for rental property expenses
            maintenanceRequestId: formData.maintenanceRequestId || null
          };

          console.log('[ExpenseAddWorkflow] RecurringExpense payload:', JSON.stringify(recurringExpensePayload, null, 2));
          const recurringResult = await dispatch(addRecurringExpenseAction(recurringExpensePayload));
          console.log('[ExpenseAddWorkflow] RecurringExpense created successfully:', recurringResult);
        } catch (recurringError) {
          console.error('[ExpenseAddWorkflow] Error creating recurring expense template:', recurringError);
          console.error('[ExpenseAddWorkflow] Error details:', {
            message: recurringError?.message,
            response: recurringError?.response?.data,
            stack: recurringError?.stack
          });
          // Don't fail the whole operation, but log the error
          openSnackbar({
            open: true,
            message: 'Expense created but failed to create recurring template',
            variant: 'alert',
            alert: { color: 'warning' }
          });
        }
      } else {
        console.log('[ExpenseAddWorkflow] Skipping RecurringExpense creation - isRecurring:', formData.isRecurring, 'expenseId:', expenseId);
      }

      // Upload receipts if provided
      if (formData.receipts.length > 0 && expenseId) {
        try {
          // Extract File objects from receipts array
          const files = formData.receipts
            .filter(r => r.file instanceof File)
            .map(r => r.file);
          
          if (files.length > 0) {
            await dispatch(uploadExpenseReceiptsAction(expenseId, files));
          }
        } catch (uploadError) {
          console.error('Error uploading receipts:', uploadError);
          // Don't fail the whole operation
        }
      }

      setTimeout(() => {
        setProcessing(false);
        transitionToStep(STEPS.SUCCESS, 'left');
      }, 1000);
    } catch (error) {
      console.error('Error creating expense:', error);
      setError(error?.response?.data?.message || 'Failed to create expense');
      setProcessing(false);
      transitionToStep(STEPS.REVIEW, 'right');
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to create expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleSuccessAction = (action) => {
    if (action === 'addAnother') {
      // Reset form
      setFormData({
        expenseDescription: '',
        amount: '',
        isRecurring: false,
        frequency: 'Monthly',
        dayOfPeriod: null,
        expenseDate: getTodayLocalDate(),
        propertyId: null,
        unitId: null,
        maintenanceRequestId: null,
        receipts: []
      });
      setSelectedProperty(null);
      setAiResult(null);
      setError(null);
      transitionToStep(STEPS.EXPENSE_TYPE, 'right');
    } else if (action === 'viewExpenses') {
      navigate('/landlord/accounting?tab=1');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.EXPENSE_TYPE:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              What kind of expense are you adding?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={formData.expenseDescription}
              onChange={(e) => handleChange('expenseDescription', e.target.value)}
              placeholder='e.g., "expense for repair" or "HOA fee"'
              sx={{ 
                mt: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '1rem'
                }
              }}
            />
            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.AMOUNT_AND_DATE:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Enter the amount
            </Typography>

            {/* Is this a recurring expense? - at the top */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isRecurring}
                    onChange={(e) => handleChange('isRecurring', e.target.checked)}
                    color="primary"
                    size="medium"
                  />
                }
                label="Is this a recurring expense?"
                sx={{ fontSize: '1rem' }}
              />
            </Box>

            {/* Set to Auto-Pay - right under recurring question when recurring is selected */}
            {formData.isRecurring && (
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.setToAutoPay}
                      onChange={(e) => handleChange('setToAutoPay', e.target.checked)}
                      color="primary"
                      size="medium"
                    />
                  }
                  label="Set to auto-pay?"
                  sx={{ fontSize: '1rem' }}
                />
              </Box>
            )}

            {/* Frequency dropdown - right under set to auto-pay when recurring is selected */}
            {formData.isRecurring && (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={formData.frequency}
                  onChange={(e) => handleChange('frequency', e.target.value)}
                  label="Frequency"
                  sx={{
                    borderRadius: 2
                  }}
                >
                  {FREQUENCY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Amount field */}
            <NumericFormat
              customInput={TextField}
              fullWidth
              label="Amount *"
              value={formData.amount}
              onValueChange={(values) => {
                handleChange('amount', values.floatValue || '');
              }}
              thousandSeparator
              prefix="$"
              decimalScale={2}
              fixedDecimalScale
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '1rem'
                }
              }}
            />

            {/* Expense Date / Due Date */}
            <TextField
              fullWidth
              type="date"
              label={formData.isRecurring ? "Due Date *" : "Expense Date *"}
              value={formData.expenseDate}
              onChange={(e) => handleChange('expenseDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ 
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />

            {formData.isRecurring && formData.expenseDate && (() => {
              // Parse date string directly to avoid timezone issues
              const dateParts = formData.expenseDate.split('-');
              const day = parseInt(dateParts[2], 10);
              return (
                <Alert severity="info" sx={{ mb: 3 }}>
                  This expense is due every {formData.frequency.toLowerCase()} on the {day}{getDaySuffix(day)}.
                </Alert>
              );
            })()}

            {!formData.isRecurring && isFutureDate && (
              <Alert severity="info" sx={{ mb: 3 }}>
                This expense/fee is due on {new Date(formData.expenseDate).toLocaleDateString()}
              </Alert>
            )}

            {/* Already Paid checkbox - shows only when date is strictly in the past (not current or future date) */}
            {isPastDate && (
              <Box sx={{ mt: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.alreadyPaid}
                      onChange={(e) => handleChange('alreadyPaid', e.target.checked)}
                      color="primary"
                      size="medium"
                    />
                  }
                  label="Have previous payments already been paid?"
                  sx={{ fontSize: '1rem' }}
                />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.PROPERTY_UNIT:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
              Which property or unit is this expense for?
            </Typography>
            {hasMultiUnitProperties && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                (if expense is for the entire property, leave unit blank)
              </Typography>
            )}

            <Box sx={{ mt: 4 }}>
              <PropertySelect
                width="100%"
                onPropertyChange={handlePropertyChange}
                localSelectedProperty={selectedProperty}
              />
            </Box>

            {isMultiUnitProperty && (
              <Box sx={{ mt: 4 }}>
                <Autocomplete
                  options={unitOptions}
                  value={unitOptions.find(u => u.id === formData.unitId) || null}
                  onChange={(event, newValue) => {
                    handleChange('unitId', newValue?.id || null);
                  }}
                  getOptionLabel={(option) => option?.label || ''}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  label="Unit (Optional)"
                />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 4 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.MAINTENANCE_LINK:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Do you want to link this expense to a maintenance request?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              This is optional. You can search by maintenance number, title, or property name.
            </Typography>
            <Box sx={{ mt: 4 }}>
              <MaintenanceSelect
                width="100%"
                value={formData.maintenanceRequestId}
                onChange={(value) => handleChange('maintenanceRequestId', value)}
                label="Maintenance Request (Optional)"
              />
            </Box>
            {error && (
              <Alert severity="error" sx={{ mt: 4 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.RECEIPTS:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Do you want to upload any receipts?
            </Typography>
            <Box sx={{ mt: 4 }}>
              <ExpenseReceiptUpload
                receipts={formData.receipts}
                onReceiptsChange={(receipts) => handleChange('receipts', receipts)}
              />
            </Box>
          </Box>
        );

      case STEPS.REVIEW:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Review & Confirm
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Review your expense details before creating.
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 700, mx: 'auto', textAlign: 'left' }}>
              {/* Expense Description */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Expense Description
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {formData.expenseDescription || 'N/A'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                    AI will categorize and name this expense when creating.
                  </Typography>
                </CardContent>
              </Card>

              {/* Amount & Date */}
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Amount
                      </Typography>
                      <Typography variant="h6" fontWeight={600}>
                        ${parseFloat(formData.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {formData.isRecurring ? 'Due Date' : 'Expense Date'}
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {formData.expenseDate ? new Date(formData.expenseDate).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) : 'N/A'}
                      </Typography>
                    </Box>
                    {formData.isRecurring && (
                      <>
                        <Divider />
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Recurring Details
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip label="Recurring" color="primary" size="small" />
                            <Typography variant="body2" color="text.secondary">
                              {formData.frequency} on the {new Date(formData.expenseDate).getDate()}{getDaySuffix(new Date(formData.expenseDate).getDate())}
                            </Typography>
                          </Stack>
                        </Box>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {/* Property & Unit */}
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Property & Unit
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {selectedProperty?.name || 'No property selected'}
                  </Typography>
                  {formData.unitId && selectedProperty?.units && (
                    <Box sx={{ mt: 1 }}>
                      <Chip
                        label={selectedProperty.units.find(u => u.id === formData.unitId)?.name || `Unit ${formData.unitId}`}
                        variant="outlined"
                        color="primary"
                        size="small"
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Maintenance Request Link */}
              {formData.maintenanceRequestId && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Linked Maintenance Request
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      Maintenance Request #{formData.maintenanceRequestId}
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Receipts */}
              {formData.receipts && formData.receipts.length > 0 && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Receipts
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {formData.receipts.length} receipt(s) uploaded
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Box>
        );

      case STEPS.PROCESSING:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Your AI agent is creating your expense
            </Typography>
            <Typography variant="body2" color="text.secondary">
              During this process, the AI agent is using what you inputted to set the category, create the name of it, and then create the request.
            </Typography>
          </Box>
        );

      case STEPS.SUCCESS:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: theme.palette.success.main, marginBottom: 16 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Expense Created Successfully!
            </Typography>
            {aiResult && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                Category: {aiResult.category} | Name: {aiResult.name}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Your expense has been recorded successfully.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                onClick={() => handleSuccessAction('addAnother')}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Create Another Expense
              </Button>
              <Button
                variant="contained"
                onClick={() => handleSuccessAction('viewExpenses')}
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

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Add Expense' }
        ]}
      />

      <MainCard sx={{ mt: 3, minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        {/* Step Indicators */}
        {currentStep < STEPS.PROCESSING && currentStep !== STEPS.SUCCESS && (
          <Box sx={{ position: 'relative', mb: 4, mt: 2, width: '100%', px: 3, pt: 2, display: { xs: 'none', sm: 'none', md: 'block' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <Box sx={{ maxWidth: 800, width: '100%' }}>
                <Stepper 
                  activeStep={getStepperStep()} 
                  alternativeLabel
                  connector={<CustomStepConnector />}
                >
                  {expenseSteps.map((label, index) => (
                    <Step key={label} completed={index < getStepperStep()}>
                      <StepLabel>{label}</StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            </Box>
          </Box>
        )}
        <Box sx={{ 
          position: 'relative', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          minHeight: '500px'
        }}>
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            py: 6,
            px: 3,
            position: 'relative',
            overflow: 'hidden',
            minHeight: '400px'
          }}>
            <Box sx={{ width: '100%', maxWidth: '600px', position: 'relative' }}>
              <Slide
                direction={slideDirection}
                in={true}
                timeout={600}
                mountOnEnter
                unmountOnExit
                key={currentStep}
              >
                <Box>
                  {renderStep()}
                </Box>
              </Slide>
            </Box>
          </Box>

          {/* Navigation Buttons */}
          {currentStep < STEPS.PROCESSING && currentStep !== STEPS.SUCCESS && (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mt: 'auto',
              pt: 4, 
              pb: 2,
              px: 3,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` 
            }}>
              <Button
                onClick={handleBack}
                disabled={currentStep === STEPS.EXPENSE_TYPE || processing}
                startIcon={<ArrowLeftOutlined />}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={processing}
                sx={{ textTransform: 'none', px: 4, py: 1 }}
              >
                {currentStep === STEPS.REVIEW ? 'Create Expense' : 'Next'}
              </Button>
            </Box>
          )}
        </Box>
      </MainCard>
    </Box>
  );
}
