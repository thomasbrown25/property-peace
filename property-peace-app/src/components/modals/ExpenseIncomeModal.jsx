import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Box,
  alpha,
  useTheme,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import MaintenanceSelect from 'components/MaintenanceSelect';
import ExpenseReceiptUpload from 'components/expense/ExpenseReceiptUpload';
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';
import { setProperty } from 'store/property/property.action';
import { setUnit, getUnits } from 'store/unit/unit.action';
import { addExpenseAction, updateExpenseAction, uploadExpenseReceiptsAction, deleteExpenseReceiptAction } from 'store/expense/expense.action';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { getTodayLocalDate } from 'utils/formatters';
import axiosServices from 'utils/axios';
import { formatLocalDateTime } from 'utils/formatters';

// Expense categories
const EXPENSE_CATEGORIES = [
  'Repairs',
  'Maintenance',
  'Utilities',
  'HOA',
  'Insurance',
  'Taxes',
  'Landscaping',
  'Cleaning',
  'Advertising',
  'Legal',
  'Accounting',
  'Property Management',
  'Capital Improvements',
  'Supplies',
  'Other'
];

// Income categories for revenue
const INCOME_CATEGORIES = [
  'Rent Payment',
  'Late Fees',
  'Application Fees',
  'Pet Fees',
  'Other Income'
];

const PAYMENT_METHODS = [
  'Cash',
  'Check',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Online Payment',
  'Other'
];

export default function ExpenseIncomeModal({ 
  open, 
  onClose, 
  type = 'expense', 
  onSuccess,
  maintenanceRequestId = null,
  initialPropertyId = null,
  initialUnitId = null,
  title = null,
  editingExpense = null
}) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { properties } = useFetchProperties();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  
  const [formData, setFormData] = useState({
    propertyId: '',
    unitId: '',
    category: type === 'expense' ? 'Repairs' : 'Rent Payment',
    name: '',
    amount: '',
    date: getTodayLocalDate(),
    description: '',
    isPaid: false,
    maintenanceRequestId: null,
    isLoanPayment: false,
    loanPrincipalAmount: '',
    loanInterestAmount: '',
    loanProvider: ''
  });
  const [taxCategory, setTaxCategory] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [deletedReceiptIds, setDeletedReceiptIds] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Set property and unit in Redux when initial values are provided
  useEffect(() => {
    if (open && properties && properties.length > 0) {
      // If initialPropertyId is provided, set the property in Redux
      if (initialPropertyId) {
        const property = properties.find(p => 
          p.id === Number(initialPropertyId) || 
          p.id === initialPropertyId ||
          String(p.id) === String(initialPropertyId)
        );
        if (property && (!selectedProperty || selectedProperty.id !== property.id)) {
          dispatch(setProperty(property));
          // Load units for the property
          dispatch(getUnits(property.id));
        }
      }
    }
  }, [open, initialPropertyId, properties, selectedProperty, dispatch]);

  // Set unit in Redux when initialUnitId is provided and property is selected
  useEffect(() => {
    if (open && initialUnitId && selectedProperty?.units) {
      const unit = selectedProperty.units.find(u => 
        u.id === Number(initialUnitId) || 
        u.id === initialUnitId ||
        String(u.id) === String(initialUnitId)
      );
      if (unit && (!selectedUnit || selectedUnit.id !== unit.id)) {
        dispatch(setUnit(unit));
      }
    }
  }, [open, initialUnitId, selectedProperty, selectedUnit, dispatch]);

  // Reset form when modal opens/closes or when editing expense changes
  useEffect(() => {
    if (open) {
      if (editingExpense) {
        // Populate form with editing expense data
        setFormData({
          propertyId: editingExpense.propertyId?.toString() || initialPropertyId?.toString() || selectedProperty?.id?.toString() || '',
          unitId: editingExpense.unitId?.toString() || initialUnitId?.toString() || selectedUnit?.id?.toString() || '',
          category: editingExpense.category || (type === 'expense' ? 'Maintenance' : 'Rent Payment'),
          name: editingExpense.name || '',
          amount: editingExpense.amount || '',
          date: editingExpense.expenseDate ? editingExpense.expenseDate.slice(0, 10) : getTodayLocalDate(),
          description: editingExpense.name || '',
          isPaid: editingExpense.isPaid || false,
          maintenanceRequestId: editingExpense.maintenanceRequestId || null,
          isLoanPayment: editingExpense?.isLoanPayment || false,
          loanPrincipalAmount: editingExpense?.loanPrincipalAmount?.toString() || '',
          loanInterestAmount: editingExpense?.loanInterestAmount?.toString() || '',
          loanProvider: editingExpense?.loanProvider || ''
        });
        setTaxCategory(editingExpense?.taxCategory || null);
        // Load existing receipts if any
        if (editingExpense.receipts && Array.isArray(editingExpense.receipts)) {
          setReceipts(editingExpense.receipts.map(receipt => ({
            id: receipt.id,
            url: receipt.blobUrl || receipt.url,
            isExisting: true,
            file: null
          })));
        } else {
          setReceipts([]);
        }
      } else {
        // Prefer initialPropertyId/initialUnitId if provided, otherwise use selected property/unit
        const propertyId = initialPropertyId?.toString() || selectedProperty?.id?.toString() || '';
        const unitId = initialUnitId?.toString() || selectedUnit?.id?.toString() || '';
        
        // If opened from maintenance page, default isPaid to true
        const defaultIsPaid = maintenanceRequestId ? true : false;
        
        setFormData({
          propertyId,
          unitId,
          category: type === 'expense' ? 'Maintenance' : 'Rent Payment', // Default to Maintenance for maintenance-related expenses
          name: '',
          amount: '',
          date: getTodayLocalDate(),
          description: '',
          isPaid: defaultIsPaid,
          maintenanceRequestId: maintenanceRequestId ? Number(maintenanceRequestId) : null
        });
        setReceipts([]);
      }
      setDeletedReceiptIds([]);
      setError(null);
    }
  }, [open, type, selectedProperty, selectedUnit, initialPropertyId, initialUnitId, editingExpense, maintenanceRequestId]);

  // Get unit options from selected property
  const unitOptions = useMemo(() => {
    if (!selectedProperty?.units) return [];
    return selectedProperty.units.map((u) => ({
      label: u.name || `Unit ${u.id}`,
      id: u.id
    }));
  }, [selectedProperty]);

  // Validate if all required fields are filled
  const isFormValid = useMemo(() => {
    const hasProperty = !!(formData.propertyId || selectedProperty?.id);
    const hasCategory = !!formData.category;
    const hasName = !!formData.name?.trim();
    const hasAmount = !!formData.amount && parseFloat(formData.amount) > 0;
    const hasDate = !!formData.date;
    
    return hasProperty && hasCategory && hasName && hasAmount && hasDate;
  }, [formData.propertyId, selectedProperty, formData.category, formData.name, formData.amount, formData.date]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.propertyId || !formData.amount || !formData.category || !formData.date || !formData.name) {
      setError('Please fill in all required fields');
      openSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      if (type === 'expense') {
        // Handle expense
        const payload = {
          landlordId: user.id,
          propertyId: Number(formData.propertyId),
          unitId: formData.unitId ? Number(formData.unitId) : null,
          name: formData.name,
          category: formData.category,
          amount: typeof formData.amount === 'number' ? formData.amount : parseFloat(formData.amount) || 0,
          expenseDate: formData.date,
          vendor: null,
          vendorId: editingExpense?.vendorId || null,
          paymentMethod: null,
          receiptUrl: null,
          isRecurring: editingExpense?.isRecurring || false,
          isTaxDeductible: editingExpense?.isTaxDeductible || false,
          taxCategory: editingExpense?.taxCategory || taxCategory || null,
          isLoanPayment: formData.isLoanPayment || editingExpense?.isLoanPayment || false,
          loanPrincipalAmount: formData.isLoanPayment && formData.loanPrincipalAmount ? parseFloat(formData.loanPrincipalAmount) : (editingExpense?.loanPrincipalAmount || null),
          loanInterestAmount: formData.isLoanPayment && formData.loanInterestAmount ? parseFloat(formData.loanInterestAmount) : (editingExpense?.loanInterestAmount || null),
          loanProvider: formData.isLoanPayment && formData.loanProvider ? formData.loanProvider : (editingExpense?.loanProvider || null),
          maintenanceRequestId: formData.maintenanceRequestId || (maintenanceRequestId ? Number(maintenanceRequestId) : (editingExpense?.maintenanceRequestId || null)),
          frequency: editingExpense?.frequency || null,
          dayOfPeriod: editingExpense?.dayOfPeriod || null,
          startDate: editingExpense?.startDate || null,
          endDate: editingExpense?.endDate || null,
          isPaused: editingExpense?.isPaused || false,
          isPaid: formData.isPaid || false,
          paidDate: formData.isPaid ? formData.date : null
        };

        let expenseId;
        if (editingExpense) {
          // Update existing expense
          const updatePayload = { ...payload, id: editingExpense.id };
          const result = await dispatch(updateExpenseAction(editingExpense.id, updatePayload));
          expenseId = editingExpense.id;

          // Delete removed receipts
          for (const receiptId of deletedReceiptIds) {
            try {
              await dispatch(deleteExpenseReceiptAction(receiptId));
            } catch (error) {
              console.error(`Error deleting receipt ${receiptId}:`, error);
            }
          }
        } else {
          // Create new expense
          const result = await dispatch(addExpenseAction(payload));
          expenseId = result?.id || result?.data?.id;
        }

        // Upload receipts if any
        if (expenseId && receipts.length > 0) {
          const filesToUpload = receipts
            .filter(receipt => !receipt.isExisting && receipt.file)
            .map(receipt => receipt.file instanceof File ? receipt.file : receipt.file)
            .filter(file => file instanceof File);

          if (filesToUpload.length > 0) {
            try {
              await dispatch(uploadExpenseReceiptsAction(expenseId, filesToUpload));
            } catch (error) {
              console.error('Error uploading receipts:', error);
              openSnackbar({
                open: true,
                message: 'Expense saved but some receipts failed to upload',
                variant: 'alert',
                alert: { color: 'warning' }
              });
            }
          }
        }

        openSnackbar({
          open: true,
          message: editingExpense ? 'Expense updated successfully' : 'Expense added successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        // Handle income - record as payment for lease if unit has lease, otherwise as income expense
        let expenseId = null;
        
        // Try to find lease for the selected unit
        const selectedUnitObj = selectedProperty?.units?.find(u => u.id === Number(formData.unitId));
        const lease = selectedUnitObj?.lease || selectedUnitObj?.Lease;
        
        if (lease?.id) {
          // Record as payment if we have a lease
          try {
            const response = await axiosServices.post('/api/rent-collection/payment', {
              leaseId: lease.id,
              amount: parseFloat(formData.amount),
              paymentDate: formatLocalDateTime(new Date(formData.date))
            });

            if (response.data && response.data.success) {
              openSnackbar({
                open: true,
                message: 'Income recorded successfully!',
                variant: 'alert',
                alert: { color: 'success' }
              });
            }
          } catch (err) {
            console.error('Payment error:', err);
            // Fall through to create as expense if payment fails
          }
        }
        
        // Always create as income expense for tracking and file attachments
        const payload = {
          landlordId: user.id,
          propertyId: Number(formData.propertyId),
          unitId: formData.unitId ? Number(formData.unitId) : null,
          name: formData.name,
          category: formData.category,
          amount: typeof formData.amount === 'number' ? formData.amount : parseFloat(formData.amount) || 0,
          expenseDate: formData.date,
          vendor: null,
          vendorId: null,
          paymentMethod: null,
          receiptUrl: null,
          isRecurring: false,
          isTaxDeductible: false,
          taxCategory: null,
          maintenanceRequestId: null,
          frequency: null,
          dayOfPeriod: null,
          startDate: null,
          endDate: null,
          isPaused: false
        };

        const result = await dispatch(addExpenseAction(payload));
        expenseId = result?.id || result?.data?.id;

        // Upload receipts if any
        if (expenseId && receipts.length > 0) {
          const filesToUpload = receipts
            .filter(receipt => !receipt.isExisting && receipt.file)
            .map(receipt => receipt.file instanceof File ? receipt.file : receipt.file)
            .filter(file => file instanceof File);

          if (filesToUpload.length > 0) {
            try {
              await dispatch(uploadExpenseReceiptsAction(expenseId, filesToUpload));
            } catch (error) {
              console.error('Error uploading receipts:', error);
              openSnackbar({
                open: true,
                message: 'Income saved but some receipts failed to upload',
                variant: 'alert',
                alert: { color: 'warning' }
              });
            }
          }
        }

        if (!lease?.id) {
          openSnackbar({
            open: true,
            message: 'Income recorded successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
        }
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error(`Error saving ${type}:`, error);
      setError(error?.response?.data?.message || `Failed to save ${type}`);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || `Failed to save ${type}`,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setProcessing(false);
    }
  };

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {title || (editingExpense ? (type === 'expense' ? 'Edit Expense' : 'Edit Income') : (type === 'expense' ? 'Add Expense' : 'Add Income'))}
        </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Property and Unit Selection - grouped together */}
          <Box>
            <PropertySelect width="100%" />
            {selectedProperty && (selectedProperty.propertyType?.toLowerCase() === 'multiunit' || 
                                 selectedProperty.propertyType?.toLowerCase() === 'multifamily') && 
                                 selectedProperty.units && selectedProperty.units.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Unit (Optional)</InputLabel>
                  <Select
                    value={formData.unitId}
                    onChange={(e) => handleChange('unitId', e.target.value)}
                    label="Unit (Optional)"
                  >
                    <MenuItem value="">None</MenuItem>
                    {unitOptions.map((unit) => (
                      <MenuItem key={unit.id} value={unit.id.toString()}>
                        {unit.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </Box>

          <FormControl fullWidth>
            <InputLabel>Category *</InputLabel>
            <Select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              label="Category *"
            >
              {categories.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Name *"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={type === 'expense' ? 'e.g., Plumbing repair' : 'e.g., Rent payment for March'}
          />

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
          />

          <TextField
            fullWidth
            type="date"
            label={`${type === 'expense' ? 'Expense' : 'Income'} Date *`}
            value={formData.date}
            onChange={(e) => handleChange('date', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          {type === 'expense' && (
            <MaintenanceSelect
              width="100%"
              value={formData.maintenanceRequestId}
              onChange={(value) => handleChange('maintenanceRequestId', value)}
              label="Link to Maintenance Request (Optional)"
            />
          )}

          {type === 'expense' && maintenanceRequestId && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isPaid}
                  onChange={(e) => handleChange('isPaid', e.target.checked)}
                />
              }
              label="Expense has already been paid"
            />
          )}

          {type === 'expense' && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.isLoanPayment}
                    onChange={(e) => handleChange('isLoanPayment', e.target.checked)}
                  />
                }
                label="This is a loan payment"
              />

              {formData.isLoanPayment && (
                <Stack spacing={2} sx={{ pl: 4, borderLeft: 2, borderColor: 'divider' }}>
                  <TextField
                    fullWidth
                    label="Loan Provider (Optional)"
                    value={formData.loanProvider}
                    onChange={(e) => handleChange('loanProvider', e.target.value)}
                    placeholder="e.g., Bank of America, Chase"
                  />
                  <NumericFormat
                    customInput={TextField}
                    fullWidth
                    label="Interest Amount *"
                    value={formData.loanInterestAmount}
                    onValueChange={(values) => {
                      handleChange('loanInterestAmount', values.floatValue || '');
                    }}
                    thousandSeparator
                    prefix="$"
                    decimalScale={2}
                    fixedDecimalScale
                  />
                  <NumericFormat
                    customInput={TextField}
                    fullWidth
                    label="Principal Amount *"
                    value={formData.loanPrincipalAmount}
                    onValueChange={(values) => {
                      handleChange('loanPrincipalAmount', values.floatValue || '');
                    }}
                    thousandSeparator
                    prefix="$"
                    decimalScale={2}
                    fixedDecimalScale
                  />
                </Stack>
              )}

              {taxCategory && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.info.main, 0.1),
                    border: 1,
                    borderColor: 'info.main'
                  }}
                >
                  <Box sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 0.5 }}>
                    Tax Category (Auto-categorized):
                  </Box>
                  <Box sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                    {taxCategory}
                  </Box>
                </Box>
              )}
            </>
          )}

          <ExpenseReceiptUpload
            receipts={receipts}
            onReceiptsChange={(newReceipts, options) => {
              setReceipts(newReceipts);
              if (options?.deletedReceiptId) {
                setDeletedReceiptIds(prev => [...prev, options.deletedReceiptId]);
              }
            }}
            disabled={false}
          />

          {error && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: theme.palette.error.main
              }}
            >
              {error}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={processing || !isFormValid}>
          {processing ? 'Saving...' : editingExpense ? 'Save' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}