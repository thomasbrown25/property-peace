import { useState } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';

// project imports
import FormInput from 'components/input/FormInput';
import { formatCurrency } from 'utils/formatters';

// Generic fee types
const GENERIC_FEES = [
  'Pet Fee',
  'Application Fee',
  'Processing Fee',
  'Admin Fee',
  'Move-in Fee',
  'Cleaning Fee',
  'Parking Fee',
  'Storage Fee',
  'Late Fee',
  'Utility Fee'
];

// ==============================|| FEES STEP ||============================== //

export default function FeesStep({ fees, onChange }) {
  const [customFeeName, setCustomFeeName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [feeForm, setFeeForm] = useState({
    name: '',
    amount: null,
    dueDate: null
  });

  // Get current date in local time
  const getCurrentDate = () => {
    const now = new Date();
    // Set to local date (no time component)
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  // Initialize form when editing
  const handleEditFee = (fee) => {
    setFeeForm({
      name: fee.name,
      amount: fee.amount || null,
      dueDate: fee.dueDate || getCurrentDate()
    });
    setEditingFeeId(fee.id);
    setShowCustomInput(false);
  };

  // Handle adding fee from generic list
  const handleAddGenericFee = (feeName) => {
    setFeeForm({
      name: feeName,
      amount: null,
      dueDate: getCurrentDate()
    });
    setEditingFeeId(null);
    setShowCustomInput(true);
  };

  // Handle starting custom fee
  const handleStartCustomFee = () => {
    setFeeForm({
      name: '',
      amount: null,
      dueDate: getCurrentDate()
    });
    setEditingFeeId(null);
    setCustomFeeName('');
    setShowCustomInput(true);
  };

  // Handle saving fee (new or edit)
  const handleSaveFee = () => {
    if (!feeForm.name.trim()) {
      return;
    }

    if (editingFeeId) {
      // Update existing fee
      onChange(fees.map(f => 
        f.id === editingFeeId ? {
          ...f,
          name: feeForm.name.trim(),
          amount: feeForm.amount,
          dueDate: feeForm.dueDate || getCurrentDate()
        } : f
      ));
    } else {
      // Add new fee
      const newFee = {
        id: Date.now() + Math.random(), // Temporary ID
        name: feeForm.name.trim(),
        amount: feeForm.amount,
        dueDate: feeForm.dueDate || getCurrentDate()
      };
      onChange([...fees, newFee]);
    }

    // Reset form
    setFeeForm({
      name: '',
      amount: null,
      dueDate: null
    });
    setEditingFeeId(null);
    setShowCustomInput(false);
    setCustomFeeName('');
  };

  // Handle canceling fee form
  const handleCancelFee = () => {
    setFeeForm({
      name: '',
      amount: null,
      dueDate: null
    });
    setEditingFeeId(null);
    setShowCustomInput(false);
    setCustomFeeName('');
  };

  const handleRemoveFee = (feeId) => {
    onChange(fees.filter(f => f.id !== feeId));
  };

  const getUsedFeeNames = () => {
    return fees.map(f => f.name.toLowerCase());
  };

  const availableGenericFees = GENERIC_FEES.filter(
    fee => !getUsedFeeNames().includes(fee.toLowerCase())
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Fees
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add any fees that the tenant will need to pay. You can select from common fees or create custom fees.
      </Typography>

      {/* Generic Fee Selection */}
      {availableGenericFees.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Select Common Fees
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {availableGenericFees.map((feeName) => (
              <Chip
                key={feeName}
                label={feeName}
                onClick={() => handleAddGenericFee(feeName)}
                clickable
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'primary.lighter',
                    color: 'primary.main'
                  }
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Add/Edit Fee Form */}
      {showCustomInput && (
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              {editingFeeId ? 'Edit Fee' : 'Add Fee'}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 3 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Fee Name *
                  </Typography>
                  <TextField
                    label=""
                    value={feeForm.name}
                    onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
                    fullWidth
                    required
                    autoFocus
                    size="small"
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Amount
                  </Typography>
                  <FormInput
                    name="fee-amount-form"
                    label=""
                    value={feeForm.amount ?? ''}
                    valueType="currency"
                    setFieldValue={(name, value) => {
                      setFeeForm({ ...feeForm, amount: value });
                    }}
                    fullWidth
                    size="small"
                  />
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    Due Date
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      value={feeForm.dueDate || getCurrentDate()}
                      onChange={(date) => {
                        setFeeForm({ ...feeForm, dueDate: date || getCurrentDate() });
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small'
                        }
                      }}
                    />
                  </LocalizationProvider>
                </Box>
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 0, md: 7 }} />
              <Grid size={{ xs: 12, md: 5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    onClick={handleCancelFee}
                    sx={{ mr: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveFee}
                    disabled={!feeForm.name.trim()}
                    startIcon={<CheckOutlined />}
                  >
                    Save
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Add Custom Fee Button */}
      {!showCustomInput && (
        <Box sx={{ mb: 4 }}>
          <Button
            variant="outlined"
            startIcon={<PlusOutlined />}
            onClick={handleStartCustomFee}
          >
            Add Custom Fee
          </Button>
        </Box>
      )}

      {/* Fee List */}
      {fees.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
            Added Fees
          </Typography>
          <Stack spacing={1}>
            {fees.map((fee) => (
              <Card key={fee.id} variant="outlined">
                <CardContent sx={{ py: 1.5 }}>
                  <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                        {fee.name}
                      </Typography>
                      <Stack direction="row" spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                          Amount: {fee.amount ? formatCurrency(fee.amount) : 'Not set'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Due: {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : 'Not set'}
                        </Typography>
                      </Stack>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton
                        onClick={() => handleEditFee(fee)}
                        color="primary"
                        size="small"
                      >
                        <EditOutlined />
                      </IconButton>
                      <IconButton
                        onClick={() => handleRemoveFee(fee.id)}
                        color="error"
                        size="small"
                      >
                        <DeleteOutlined />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {fees.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary">
            No fees added yet. Select a common fee above or add a custom fee.
          </Typography>
        </Box>
      )}
    </Box>
  );
}

FeesStep.propTypes = {
  fees: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
      amount: PropTypes.number,
      dueDate: PropTypes.instanceOf(Date)
    })
  ).isRequired,
  onChange: PropTypes.func.isRequired
};
