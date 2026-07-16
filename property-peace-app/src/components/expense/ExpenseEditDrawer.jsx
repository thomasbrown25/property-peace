import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Alert,
  alpha,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { CloseOutlined, SaveOutlined } from '@ant-design/icons';
import MaintenanceSelect from 'components/MaintenanceSelect';
import ExpenseReceiptUpload from 'components/expense/ExpenseReceiptUpload';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import { getTodayLocalDate } from 'utils/formatters';
import {
  deleteExpenseReceiptAction,
  getExpenseReceiptsAction,
  updateExpenseAction,
  uploadExpenseReceiptsAction
} from 'store/expense/expense.action';
import { openSnackbar } from 'api/snackbar';

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

const IRS_TAX_CATEGORIES = [
  { value: null, label: 'None' },
  { value: 1, label: 'Repairs' },
  { value: 2, label: 'Maintenance' },
  { value: 3, label: 'Cleaning' },
  { value: 4, label: 'Landscaping' },
  { value: 5, label: 'Utilities' },
  { value: 6, label: 'Water' },
  { value: 7, label: 'Sewer' },
  { value: 8, label: 'Garbage' },
  { value: 9, label: 'Internet' },
  { value: 10, label: 'Phone' },
  { value: 11, label: 'Insurance' },
  { value: 12, label: 'Liability Insurance' },
  { value: 13, label: 'Property Insurance' },
  { value: 14, label: 'Property Taxes' },
  { value: 15, label: 'Local Taxes' },
  { value: 16, label: 'State Taxes' },
  { value: 17, label: 'Property Management' },
  { value: 18, label: 'Legal Fees' },
  { value: 19, label: 'Accounting Fees' },
  { value: 20, label: 'Professional Services' },
  { value: 21, label: 'Advertising' },
  { value: 22, label: 'Marketing' },
  { value: 23, label: 'Travel' },
  { value: 24, label: 'Transportation' },
  { value: 25, label: 'Vehicle Expenses' },
  { value: 26, label: 'Depreciation' },
  { value: 27, label: 'Improvements' },
  { value: 28, label: 'Other' },
  { value: 29, label: 'Supplies' },
  { value: 30, label: 'Office Expenses' },
  { value: 31, label: 'Bank Fees' },
  { value: 32, label: 'Interest' },
  { value: 33, label: 'Mortgage Interest' },
  { value: 34, label: 'Contract Labor' },
  { value: 35, label: 'Services' }
];

const emptyForm = {
  propertyId: '',
  unitId: '',
  category: 'Repairs',
  name: '',
  amount: '',
  expenseDate: getTodayLocalDate(),
  isPaid: false,
  maintenanceRequestId: null,
  isTaxDeductible: false,
  taxCategory: null,
  isLoanPayment: false,
  loanProvider: '',
  loanInterestAmount: '',
  loanPrincipalAmount: ''
};

const getId = (entity) => entity?.id ?? entity?.Id ?? null;
const getUnits = (property) => property?.units || property?.Units || [];
const normalizeReceipt = (receipt) => ({
  ...receipt,
  id: receipt.id ?? receipt.Id,
  blobUrl: receipt.blobUrl || receipt.BlobUrl || receipt.url || receipt.Url || receipt.preview,
  preview: receipt.preview || receipt.blobUrl || receipt.BlobUrl || receipt.url || receipt.Url,
  isExisting: true,
  file: null
});

export default function ExpenseEditDrawer({ open, expense, onClose, onSuccess, title = 'Edit expense' }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { properties } = useFetchProperties();

  const [formData, setFormData] = useState(emptyForm);
  const [receipts, setReceipts] = useState([]);
  const [deletedReceiptIds, setDeletedReceiptIds] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const expenseId = expense?.id ?? expense?.Id;

  useEffect(() => {
    if (!open || !expense) return;

    setFormData({
      propertyId: (expense.propertyId ?? expense.PropertyId)?.toString() || '',
      unitId: (expense.unitId ?? expense.UnitId)?.toString() || '',
      category: expense.category || 'Repairs',
      name: expense.name || expense.description || '',
      amount: expense.amount ?? '',
      expenseDate: expense.expenseDate ? expense.expenseDate.slice(0, 10) : getTodayLocalDate(),
      isPaid: Boolean(expense.isPaid),
      maintenanceRequestId: expense.maintenanceRequestId || null,
      isTaxDeductible: Boolean(expense.isTaxDeductible),
      taxCategory: expense.taxCategory || null,
      isLoanPayment: Boolean(expense.isLoanPayment),
      loanProvider: expense.loanProvider || '',
      loanInterestAmount: expense.loanInterestAmount?.toString() || '',
      loanPrincipalAmount: expense.loanPrincipalAmount?.toString() || ''
    });
    setReceipts(Array.isArray(expense.receipts) ? expense.receipts.map(normalizeReceipt) : []);
    setDeletedReceiptIds([]);
    setError(null);
  }, [open, expense]);

  useEffect(() => {
    if (!open || !expenseId) return;
    if (Array.isArray(expense.receipts) && expense.receipts.length > 0) return;

    let cancelled = false;
    const loadReceipts = async () => {
      setLoadingReceipts(true);
      try {
        const result = await dispatch(getExpenseReceiptsAction(expenseId));
        const loadedReceipts = Array.isArray(result) ? result : (result?.data || result?.Data || []);
        if (!cancelled && Array.isArray(loadedReceipts)) {
          setReceipts(loadedReceipts.map(normalizeReceipt));
        }
      } catch (receiptError) {
        console.error('Error loading expense receipts:', receiptError);
      } finally {
        if (!cancelled) setLoadingReceipts(false);
      }
    };

    loadReceipts();
    return () => {
      cancelled = true;
    };
  }, [dispatch, expense, expenseId, open]);

  const selectedProperty = useMemo(() => {
    if (!formData.propertyId) return null;
    return properties?.find((property) => String(getId(property)) === String(formData.propertyId)) || null;
  }, [formData.propertyId, properties]);

  const unitOptions = useMemo(() => {
    return getUnits(selectedProperty).map((unit) => ({
      id: getId(unit),
      label: unit.name || unit.Name || `Unit ${getId(unit)}`
    }));
  }, [selectedProperty]);

  const isFormValid = Boolean(formData.propertyId && formData.category && formData.name?.trim() && formData.amount && Number(formData.amount) > 0 && formData.expenseDate);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'propertyId' ? { unitId: '' } : {})
    }));
  };

  const handleSubmit = async () => {
    if (!expenseId) return;
    if (!isFormValid) {
      setError('Please fill in property, category, name, amount, and date.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const payload = {
        id: expenseId,
        landlordId: user?.id || user?.Id || expense.landlordId || expense.LandlordId,
        propertyId: Number(formData.propertyId),
        unitId: formData.unitId ? Number(formData.unitId) : null,
        name: formData.name.trim(),
        category: formData.category,
        amount: typeof formData.amount === 'number' ? formData.amount : parseFloat(formData.amount) || 0,
        expenseDate: formData.expenseDate,
        vendor: expense.vendor || null,
        vendorId: expense.vendorId || null,
        paymentMethod: expense.paymentMethod || null,
        receiptUrl: expense.receiptUrl || null,
        isRecurring: expense.isRecurring || false,
        isTaxDeductible: formData.isTaxDeductible,
        taxCategory: formData.isTaxDeductible ? formData.taxCategory || null : null,
        isLoanPayment: formData.isLoanPayment,
        loanProvider: formData.isLoanPayment && formData.loanProvider ? formData.loanProvider : null,
        loanInterestAmount: formData.isLoanPayment && formData.loanInterestAmount ? parseFloat(formData.loanInterestAmount) : null,
        loanPrincipalAmount: formData.isLoanPayment && formData.loanPrincipalAmount ? parseFloat(formData.loanPrincipalAmount) : null,
        maintenanceRequestId: formData.maintenanceRequestId || null,
        frequency: expense.frequency || null,
        dayOfPeriod: expense.dayOfPeriod || null,
        startDate: expense.startDate || null,
        endDate: expense.endDate || null,
        isPaused: expense.isPaused || false,
        isPaid: formData.isPaid,
        paidDate: formData.isPaid ? (expense.paidDate || formData.expenseDate) : null
      };

      await dispatch(updateExpenseAction(expenseId, payload));

      for (const receiptId of deletedReceiptIds) {
        try {
          await dispatch(deleteExpenseReceiptAction(receiptId));
        } catch (deleteError) {
          console.error(`Error deleting receipt ${receiptId}:`, deleteError);
        }
      }

      const filesToUpload = receipts
        .filter((receipt) => !receipt.isExisting && receipt.file)
        .map((receipt) => receipt.file)
        .filter((file) => file instanceof File);

      if (filesToUpload.length > 0) {
        try {
          await dispatch(uploadExpenseReceiptsAction(expenseId, filesToUpload));
        } catch (uploadError) {
          console.error('Error uploading receipts:', uploadError);
          openSnackbar({
            open: true,
            message: 'Expense updated, but some receipts failed to upload',
            variant: 'alert',
            alert: { color: 'warning' }
          });
        }
      }

      openSnackbar({
        open: true,
        message: 'Expense updated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      await onSuccess?.();
      onClose?.();
    } catch (submitError) {
      console.error('Error updating expense:', submitError);
      const message = submitError?.response?.data?.message || 'Failed to update expense';
      setError(message);
      openSnackbar({
        open: true,
        message,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={processing ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 560 },
          maxWidth: '100%',
          bgcolor: 'background.paper',
          backgroundImage: theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0)} 28%)`
            : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0)} 34%)`,
          borderLeft: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.32 : 0.16)}`,
          boxShadow: theme.palette.mode === 'dark'
            ? `-24px 0 60px ${alpha(theme.palette.common.black, 0.45)}`
            : `-18px 0 46px ${alpha(theme.palette.common.black, 0.14)}`
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: { xs: 2.25, sm: 3 }, py: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.22 : 0.12)}` }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
                Expense cleanup
              </Typography>
              <Typography variant="h4" fontWeight={800} sx={{ mt: 0.25 }}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Fix categorization, tax details, payment status, and attach missing receipts.
              </Typography>
            </Box>
            <IconButton onClick={onClose} disabled={processing} aria-label="Close edit expense drawer">
              <CloseOutlined />
            </IconButton>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2.25, sm: 3 }, py: 3 }}>
          <Stack spacing={2.25}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2.25,
                border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.12)}`,
                bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.58 : 0.88),
                boxShadow: theme.palette.mode === 'dark' ? `0 16px 36px ${alpha(theme.palette.common.black, 0.22)}` : `0 10px 26px ${alpha(theme.palette.common.black, 0.06)}`
              }}
            >
              <Stack spacing={2}>
                <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                  <FormControl fullWidth required>
                    <InputLabel>Property</InputLabel>
                    <Select value={formData.propertyId} label="Property" onChange={(event) => handleChange('propertyId', event.target.value)}>
                      {(properties || []).map((property) => (
                        <MenuItem key={getId(property)} value={String(getId(property))}>
                          {property.name || property.Name || `Property ${getId(property)}`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth disabled={!unitOptions.length}>
                    <InputLabel>Unit</InputLabel>
                    <Select value={formData.unitId} label="Unit" onChange={(event) => handleChange('unitId', event.target.value)}>
                      <MenuItem value="">None</MenuItem>
                      {unitOptions.map((unit) => (
                        <MenuItem key={unit.id} value={String(unit.id)}>
                          {unit.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select value={formData.category} label="Category" onChange={(event) => handleChange('category', event.target.value)}>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>{category}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField fullWidth required label="Expense name" value={formData.name} onChange={(event) => handleChange('name', event.target.value)} />

                <Stack direction={isMobile ? 'column' : 'row'} spacing={2}>
                  <NumericFormat
                    customInput={TextField}
                    fullWidth
                    required
                    label="Amount"
                    value={formData.amount}
                    onValueChange={(values) => handleChange('amount', values.floatValue || '')}
                    thousandSeparator
                    prefix="$"
                    decimalScale={2}
                    fixedDecimalScale
                  />
                  <TextField
                    fullWidth
                    required
                    type="date"
                    label="Expense date"
                    value={formData.expenseDate}
                    onChange={(event) => handleChange('expenseDate', event.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>

                <MaintenanceSelect
                  width="100%"
                  value={formData.maintenanceRequestId}
                  onChange={(value) => handleChange('maintenanceRequestId', value)}
                  label="Link to Maintenance Request (Optional)"
                />
              </Stack>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2.25, border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.2 : 0.12)}`, bgcolor: alpha(theme.palette.background.paper, 0.62) }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.25 }}>Tax & payment review</Typography>
              <Stack spacing={1.5}>
                <FormControlLabel
                  control={<Checkbox checked={formData.isPaid} onChange={(event) => handleChange('isPaid', event.target.checked)} />}
                  label="Expense has been paid"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isTaxDeductible}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setFormData((prev) => ({ ...prev, isTaxDeductible: checked, taxCategory: checked ? prev.taxCategory : null }));
                      }}
                    />
                  }
                  label="Tax deductible"
                />
                {formData.isTaxDeductible && (
                  <FormControl fullWidth>
                    <InputLabel>IRS Tax Category (Schedule E)</InputLabel>
                    <Select
                      value={formData.taxCategory ?? ''}
                      label="IRS Tax Category (Schedule E)"
                      onChange={(event) => handleChange('taxCategory', event.target.value === '' ? null : event.target.value)}
                    >
                      {IRS_TAX_CATEGORIES.map((category) => (
                        <MenuItem key={category.value ?? 'none'} value={category.value ?? ''}>{category.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <FormControlLabel
                  control={<Checkbox checked={formData.isLoanPayment} onChange={(event) => handleChange('isLoanPayment', event.target.checked)} />}
                  label="This is a loan payment"
                />
                {formData.isLoanPayment && (
                  <Stack spacing={1.5} sx={{ pl: 2, borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.26)}` }}>
                    <TextField fullWidth label="Loan provider" value={formData.loanProvider} onChange={(event) => handleChange('loanProvider', event.target.value)} />
                    <NumericFormat customInput={TextField} fullWidth label="Interest amount" value={formData.loanInterestAmount} onValueChange={(values) => handleChange('loanInterestAmount', values.floatValue || '')} thousandSeparator prefix="$" decimalScale={2} fixedDecimalScale />
                    <NumericFormat customInput={TextField} fullWidth label="Principal amount" value={formData.loanPrincipalAmount} onValueChange={(values) => handleChange('loanPrincipalAmount', values.floatValue || '')} thousandSeparator prefix="$" decimalScale={2} fixedDecimalScale />
                  </Stack>
                )}
              </Stack>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2.25, border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.2 : 0.12)}`, bgcolor: alpha(theme.palette.background.paper, 0.62) }}>
              {loadingReceipts ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Loading receipts…</Typography>
                </Stack>
              ) : (
                <ExpenseReceiptUpload
                  receipts={receipts}
                  onReceiptsChange={(newReceipts, options) => {
                    setReceipts(newReceipts);
                    if (options?.deletedReceiptId) {
                      setDeletedReceiptIds((prev) => [...prev, options.deletedReceiptId]);
                    }
                  }}
                  disabled={processing}
                />
              )}
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </Box>

        <Divider />
        <Stack direction="row" justifyContent="flex-end" spacing={1.25} sx={{ px: { xs: 2.25, sm: 3 }, py: 2, bgcolor: alpha(theme.palette.background.paper, 0.88), backdropFilter: 'blur(12px)' }}>
          <Button variant="outlined" onClick={onClose} disabled={processing} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={processing || !isFormValid}
            startIcon={processing ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
            sx={{ textTransform: 'none', fontWeight: 800, minWidth: 128 }}
          >
            {processing ? 'Saving…' : 'Save expense'}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
