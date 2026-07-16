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
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Switch,
  CircularProgress,
  ListSubheader,
  alpha,
  useTheme,
  InputAdornment
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import { CloudUploadOutlined } from '@ant-design/icons';
import PropertySelect from 'components/PropertySelect';
import { selectProperty } from 'store/property/property.selector';
import { selectTenants } from 'store/tenant/tenant.selector';
import { addExpenseAction, uploadExpenseReceiptsAction } from 'store/expense/expense.action';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import { getTodayLocalDate } from 'utils/formatters';
import { useNavigate } from 'react-router-dom';

// Expense categories grouped by sections (matching screenshot structure)
const EXPENSE_CATEGORIES = [
  {
    section: 'Application Fee',
    categories: ['Application Fee']
  },
  {
    section: 'Screening',
    categories: ['Screening']
  },
  {
    section: 'Auto & Travel',
    categories: ['Auto & Travel', 'Car Rental']
  },
  {
    section: 'Repairs & Maintenance',
    categories: ['Water tank', 'Repairs', 'Maintenance']
  },
  {
    section: 'Other',
    categories: ['Utilities', 'HOA', 'Insurance', 'Taxes', 'Landscaping', 'Cleaning', 'Advertising', 'Legal', 'Accounting', 'Property Management', 'Capital Improvements', 'Supplies', 'Other']
  }
];

export default function AddExpenseModal({ 
  open, 
  onClose,
  onSuccess
}) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { properties } = useFetchProperties();
  const selectedProperty = useSelector(selectProperty);
  const tenants = useSelector(selectTenants) || [];
  
  const [formData, setFormData] = useState({
    expenseType: 'property',
    category: '',
    dueDate: getTodayLocalDate(),
    amount: '',
    payerPayee: 'me',
    leaseId: '',
    details: '',
    markAsPaid: false
  });
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        expenseType: 'property',
        category: '',
        dueDate: getTodayLocalDate(),
        amount: '',
        payerPayee: 'me',
        leaseId: '',
        details: '',
        markAsPaid: false
      });
      setFile(null);
      setError(null);
      setSuccessModalOpen(false);
    }
  }, [open]);

  // Reset lease when property changes
  useEffect(() => {
    if (selectedProperty) {
      setFormData(prev => ({ ...prev, leaseId: '' }));
    }
  }, [selectedProperty]);

  // Get all leases from selected property
  const leaseOptions = useMemo(() => {
    if (!selectedProperty?.units) return [];
    const leases = [];
    selectedProperty.units.forEach(unit => {
      const lease = unit.lease || unit.Lease;
      if (lease && lease.id) {
        const leaseLabel = `${selectedProperty.name}. Lease #${lease.id} (${lease.isActive ? 'Active' : 'Inactive'})`;
        leases.push({
          id: lease.id,
          label: leaseLabel,
          unitId: unit.id
        });
      }
    });
    return leases;
  }, [selectedProperty]);

  // Payer/Payee options: "Me" first, then tenants
  const payerPayeeOptions = useMemo(() => {
    const options = [{ value: 'me', label: 'Me' }];
    tenants.forEach(tenant => {
      const name = `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || `Tenant ${tenant.id}`;
      options.push({
        value: tenant.id.toString(),
        label: name
      });
    });
    return options;
  }, [tenants]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedProperty?.id) {
      setError('Please select a property');
      return;
    }
    if (!formData.category) {
      setError('Please select a category');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!formData.leaseId && leaseOptions.length > 0) {
      setError('Please select a lease');
      return;
    }
    if (leaseOptions.length === 0) {
      setError('Selected property has no leases. Please select a property with leases.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Find the selected lease to get unitId
      const selectedLease = leaseOptions.find(l => l.id.toString() === formData.leaseId.toString());
      const unitId = selectedLease?.unitId || null;

      const payload = {
        landlordId: user.id || user.Id,
        propertyId: Number(selectedProperty.id),
        unitId: unitId ? Number(unitId) : null,
        name: formData.details || formData.category,
        category: formData.category,
        amount: parseFloat(formData.amount),
        expenseDate: formData.dueDate,
        vendor: formData.payerPayee === 'me' ? null : (tenants.find(t => t.id.toString() === formData.payerPayee)?.firstname + ' ' + tenants.find(t => t.id.toString() === formData.payerPayee)?.lastname || null),
        vendorId: formData.payerPayee === 'me' ? null : (formData.payerPayee ? Number(formData.payerPayee) : null),
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
        isPaused: false,
        dueDate: formData.dueDate,
        billDate: formData.dueDate,
        isPaid: formData.markAsPaid,
        paidDate: formData.markAsPaid ? formData.dueDate : null
      };

      const result = await dispatch(addExpenseAction(payload));
      const expenseId = result?.id || result?.data?.id;

      // Upload file if provided
      if (file && expenseId) {
        try {
          await dispatch(uploadExpenseReceiptsAction(expenseId, [file]));
        } catch (uploadError) {
          console.error('Error uploading receipt:', uploadError);
          // Don't fail the whole operation if upload fails
          openSnackbar({
            open: true,
            message: 'Expense saved but receipt upload failed',
            variant: 'alert',
            alert: { color: 'warning' }
          });
        }
      }

      setProcessing(false);
      setSuccessModalOpen(true);
    } catch (error) {
      console.error('Error saving expense:', error);
      setError(error?.response?.data?.message || 'Failed to save expense');
      setProcessing(false);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to save expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleSuccessAction = (action) => {
    setSuccessModalOpen(false);
    if (action === 'addAnother') {
      // Reset form for another expense
      setFormData({
        expenseType: 'property',
        category: '',
        dueDate: getTodayLocalDate(),
        amount: '',
        payerPayee: 'me',
        leaseId: '',
        details: '',
        markAsPaid: false
      });
      setFile(null);
      setError(null);
      // Keep modal open
    } else if (action === 'viewExpenses') {
      onClose();
      navigate('/landlord/accounting?tab=1');
      if (onSuccess) onSuccess();
    } else {
      onClose();
      if (onSuccess) onSuccess();
    }
  };

  return (
    <>
      <Dialog 
        open={open && !successModalOpen} 
        onClose={onClose} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle>
          <Typography variant="h4" fontWeight={600}>
            Expense invoice
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Expense Type Selection */}
            <FormControl component="fieldset">
              <RadioGroup
                row
                value={formData.expenseType}
                onChange={(e) => handleChange('expenseType', e.target.value)}
                sx={{ gap: 2 }}
              >
                <FormControlLabel 
                  value="property" 
                  control={<Radio sx={{ color: theme.palette.primary.main }} />} 
                  label="Property Expense" 
                />
                <FormControlLabel 
                  value="tenant" 
                  control={<Radio sx={{ color: theme.palette.primary.main }} />} 
                  label="Tenant Fee" 
                />
              </RadioGroup>
            </FormControl>

            {/* Property Selection */}
            <PropertySelect width="100%" />

            {/* Category Dropdown with Sections */}
            <FormControl fullWidth>
              <InputLabel>Category & subcategory *</InputLabel>
              <Select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                label="Category & subcategory *"
                sx={{ 
                  '& .MuiOutlinedInput-notchedOutline': {
                    
                  }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      maxHeight: 300
                    }
                  }
                }}
              >
                {EXPENSE_CATEGORIES.map((group) => [
                  <ListSubheader 
                    key={group.section} 
                    sx={{ 
                      fontWeight: 600, 
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                      pt: 1
                    }}
                  >
                    {group.section}
                  </ListSubheader>,
                  ...group.categories.map((category) => (
                    <MenuItem key={category} value={category} sx={{ pl: 3 }}>
                      {category}
                    </MenuItem>
                  ))
                ])}
              </Select>
            </FormControl>

            {/* Due Date */}
            <TextField
              fullWidth
              type="date"
              label="Due on *"
              value={formData.dueDate}
              onChange={(e) => handleChange('dueDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  
                }
              }}
            />

            {/* Amount with Mark as Paid Toggle */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
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
                    '& .MuiOutlinedInput-root': {
                      
                    }
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.markAsPaid}
                      onChange={(e) => handleChange('markAsPaid', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Mark as paid"
                  sx={{ m: 0 }}
                />
              </Box>
            </Box>

            {/* Payer/Payee Dropdown */}
            <FormControl fullWidth>
              <InputLabel>Payer / Payee *</InputLabel>
              <Select
                value={formData.payerPayee}
                onChange={(e) => handleChange('payerPayee', e.target.value)}
                label="Payer / Payee *"
                sx={{ 
                  '& .MuiOutlinedInput-notchedOutline': {
                    
                  }
                }}
              >
                {payerPayeeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Lease Dropdown */}
            <FormControl fullWidth>
              <InputLabel>Lease *</InputLabel>
              <Select
                value={formData.leaseId}
                onChange={(e) => handleChange('leaseId', e.target.value)}
                label="Lease *"
                sx={{ 
                  '& .MuiOutlinedInput-notchedOutline': {
                    
                  }
                }}
              >
                {leaseOptions.length === 0 ? (
                  <MenuItem disabled>No leases available for this property</MenuItem>
                ) : (
                  leaseOptions.map((lease) => (
                    <MenuItem key={lease.id} value={lease.id.toString()}>
                      {lease.label}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Details Textarea */}
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Details"
              value={formData.details}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 200) {
                  handleChange('details', value);
                }
              }}
              placeholder="Some details about invoice"
              helperText={`Character limit: ${formData.details.length}/200`}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />

            {/* Upload File Button */}
            <Box>
              <input
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                id="expense-file-upload"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="expense-file-upload">
                <Button
                  component="span"
                  variant="outlined"
                  startIcon={<CloudUploadOutlined />}
                  sx={{
                    textTransform: 'none',
                    borderColor: theme.palette.primary.main,
                    color: theme.palette.primary.main,
                    '&:hover': {
                      borderColor: theme.palette.primary.dark,
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  }}
                >
                  Upload file/receipt
                </Button>
              </label>
              {file && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {file.name}
                </Typography>
              )}
            </Box>

            {error && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  color: theme.palette.error.main
                }}
              >
                {error}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button 
            onClick={onClose} 
            disabled={processing}
            sx={{ 
              textTransform: 'none',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={processing}
            sx={{ 
              textTransform: 'none',
              px: 3
            }}
          >
            {processing ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} color="inherit" />
                <span>Creating...</span>
              </Box>
            ) : (
              'Create'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Modal */}
      <Dialog 
        open={successModalOpen} 
        onClose={() => handleSuccessAction('close')}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2
          }
        }}
      >
        <DialogTitle>
          <Typography variant="h5" fontWeight={600}>
            Expense Created Successfully!
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Your expense has been recorded successfully.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1, gap: 1 }}>
          <Button 
            onClick={() => handleSuccessAction('addAnother')}
            variant="outlined"
            sx={{ 
              textTransform: 'none',
              px: 3
            }}
          >
            Add Another Expense
          </Button>
          <Button 
            onClick={() => handleSuccessAction('viewExpenses')}
            variant="contained"
            sx={{ 
              textTransform: 'none',
              px: 3
            }}
          >
            View Expenses
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
