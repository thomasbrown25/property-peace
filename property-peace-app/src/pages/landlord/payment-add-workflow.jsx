import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Slide,
  alpha,
  useTheme,
  Alert,
  Paper,
  Divider,
  Chip,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { CheckCircleOutlined, ArrowLeftOutlined, DollarOutlined, HomeOutlined, ExclamationCircleOutlined, UserOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PaymentRecipientSearch from 'components/payment/PaymentRecipientSearch';
import Autocomplete from 'components/@extended/AutoComplete';
import { formatCurrency } from 'utils/formatters';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import useAuth from 'hooks/useAuth';

const STEPS = {
  WHO_MADE_PAYMENT: 1,
  PAYMENT_SUMMARY: 2,
  PROCESSING: 3,
  SUCCESS: 4,
  FAILURE: 5
};

const paymentSteps = ['Who Made Payment', 'Payment Summary', 'Review'];

// Helper function to format date as local string (YYYY-MM-DDTHH:mm:ss)
const formatLocalDateTime = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

// Parse currency string back to number
const parseCurrencyToNumber = (value) => {
  if (!value) return 0;
  // Remove currency symbols, commas, and spaces
  const cleaned = value.toString().replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
};

export default function PaymentAddWorkflow() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const { properties } = useFetchProperties();
  const [currentStep, setCurrentStep] = useState(STEPS.WHO_MADE_PAYMENT);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);

  // Selection state
  const [selectedType, setSelectedType] = useState(null); // 'tenant' or 'property'
  const [selectedItem, setSelectedItem] = useState(null); // tenant or property object
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedLease, setSelectedLease] = useState(null);

  // Payment form state
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [amount, setAmount] = useState(0);
  const [amountDisplay, setAmountDisplay] = useState('');

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Custom StepConnector for payment workflow
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

  // Map current step to stepper step (exclude PROCESSING, SUCCESS, FAILURE)
  const getStepperStep = () => {
    if (currentStep === STEPS.WHO_MADE_PAYMENT) return 0;
    if (currentStep === STEPS.PAYMENT_SUMMARY) return 1;
    return 0;
  };

  // Fetch rent collection data for selected property
  const { rentRecords, loading: rentRecordsLoading, refetch: refetchRentRecords } = useFetchRentCollection(
    selectedProperty?.id || null,
    false
  );

  // Find rent record for selected lease
  const rentRecord = useMemo(() => {
    if (!selectedLease?.id || !rentRecords) return null;
    return rentRecords.find((r) => r.leaseId === selectedLease.id);
  }, [selectedLease, rentRecords]);

  // Check if property is single family (no units)
  const isSingleFamilyProperty = useMemo(() => {
    if (!selectedProperty) return false;
    const propertyType = selectedProperty.propertyType?.toLowerCase();
    return propertyType === 'singlefamily' || propertyType === 'single-family';
  }, [selectedProperty]);

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

  // Find lease from properties
  const findLease = useMemo(() => {
    if (!properties || !selectedProperty) return null;
    
    if (selectedType === 'tenant' && selectedItem) {
      // Find lease for tenant
      for (const property of properties) {
        for (const unit of property.units || []) {
          const lease = unit.lease || unit.Lease;
          if (lease && lease.tenants) {
            const tenantMatch = lease.tenants.find(
              t => t.id === selectedItem.id || t.userId === selectedItem.userId
            );
            if (tenantMatch) {
              return { ...lease, propertyName: property.name, unitName: unit.name, propertyId: property.id, unitId: unit.id };
            }
          }
        }
      }
    } else if (selectedType === 'property' && selectedProperty && selectedUnit) {
      // Find lease for property/unit
      const unit = selectedProperty.units?.find(u => u.id === selectedUnit.id);
      if (unit) {
        const lease = unit.lease || unit.Lease;
        if (lease) {
          return { ...lease, propertyName: selectedProperty.name, unitName: unit.name, propertyId: selectedProperty.id, unitId: unit.id };
        }
      }
    } else if (selectedType === 'property' && selectedProperty && isSingleFamilyProperty) {
      // Single family - find lease directly
      const unit = selectedProperty.units?.[0];
      if (unit) {
        const lease = unit.lease || unit.Lease;
        if (lease) {
          return { ...lease, propertyName: selectedProperty.name, propertyId: selectedProperty.id, unitId: unit.id };
        }
      }
    }
    
    return null;
  }, [properties, selectedProperty, selectedUnit, selectedType, selectedItem, isSingleFamilyProperty]);

  // Update selected lease when findLease changes
  useEffect(() => {
    setSelectedLease(findLease);
  }, [findLease]);

  // Update payment amount when rent record changes
  useEffect(() => {
    if (rentRecord) {
      const monthlyDue = rentRecord.rentAmount || rentRecord.RentAmount || 0;
      const overdue = rentRecord.overdueAmount || rentRecord.OverdueAmount || 0;
      const totalDue = monthlyDue + overdue;
      setAmount(totalDue);
      setAmountDisplay(formatCurrency(totalDue));
    }
  }, [rentRecord]);

  // Format property display
  const propertyDisplay = useMemo(() => {
    if (!selectedProperty) return null;
    if (isSingleFamilyProperty) {
      return selectedProperty.name;
    }
    if (selectedUnit && selectedUnit.name) {
      return `${selectedProperty.name} – ${selectedUnit.name}`;
    }
    return selectedProperty.name;
  }, [selectedProperty, selectedUnit, isSingleFamilyProperty]);

  // Get all tenants for the selected property/unit
  const propertyTenants = useMemo(() => {
    if (!selectedProperty || !properties) return [];
    
    const tenants = [];
    
    // If a specific unit is selected, get tenants from that unit's lease
    if (selectedUnit) {
      const unit = selectedProperty.units?.find(u => u.id === selectedUnit.id);
      if (unit) {
        const lease = unit.lease || unit.Lease;
        if (lease && lease.tenants) {
          tenants.push(...lease.tenants);
        }
      }
    } else {
      // Get all tenants from all units in the property
      selectedProperty.units?.forEach(unit => {
        const lease = unit.lease || unit.Lease;
        if (lease && lease.tenants) {
          lease.tenants.forEach(tenant => {
            // Avoid duplicates
            if (!tenants.find(t => t.id === tenant.id)) {
              tenants.push({
                ...tenant,
                unitName: unit.name
              });
            }
          });
        }
      });
    }
    
    return tenants;
  }, [selectedProperty, selectedUnit, properties]);

  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setTimeout(() => {
        setIsAnimating(false);
      }, 600);
    }, 50);
  };

  const handleRecipientSelect = (type, item) => {
    setSelectedType(type);
    setSelectedItem(item);
    setError(null);

    if (type === 'tenant') {
      // Find property and unit from tenant
      // First try using propertyId and unitId from search result
      if (item.propertyId && item.unitId && properties) {
        const property = properties.find(p => p.id === item.propertyId);
        if (property) {
          const unit = property.units?.find(u => u.id === item.unitId);
          if (unit) {
            setSelectedProperty(property);
            setSelectedUnit(unit);
            return;
          }
        }
      }
      
      // Fallback: search through all properties and units
      for (const property of properties || []) {
        for (const unit of property.units || []) {
          const lease = unit.lease || unit.Lease;
          if (lease && lease.tenants) {
            const tenantMatch = lease.tenants.find(
              t => t.id === item.id || t.userId === item.userId
            );
            if (tenantMatch) {
              setSelectedProperty(property);
              setSelectedUnit(unit);
              return;
            }
          }
        }
      }
    } else if (type === 'property') {
      // Find the full property object from properties store by ID
      if (properties && item.id) {
        const fullProperty = properties.find(p => p.id === item.id);
        if (fullProperty) {
          setSelectedProperty(fullProperty);
          setSelectedUnit(null);
        } else {
          // If not found, try to use the item directly (might be from local data)
          setSelectedProperty(item);
          setSelectedUnit(null);
        }
      } else {
        setSelectedProperty(item);
        setSelectedUnit(null);
      }
    }
  };

  const handleNext = () => {
    if (currentStep === STEPS.WHO_MADE_PAYMENT) {
      if (!selectedLease?.id) {
        setError('Please select a tenant or property with an active lease');
        return;
      }
      if (isMultiUnitProperty && !selectedUnit) {
        setError('Please select a unit for this property');
        return;
      }
      setError(null);
      transitionToStep(STEPS.PAYMENT_SUMMARY, 'left');
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.WHO_MADE_PAYMENT) {
      transitionToStep(currentStep - 1, 'right');
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedLease?.id) {
      setError('Please select a property and unit with an active lease');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    setProcessing(true);
    setError(null);
    transitionToStep(STEPS.PROCESSING, 'left');

    try {
      const response = await axiosServices.post('/api/rent-collection/payment', {
        leaseId: selectedLease.id,
        amount: parseFloat(amount),
        paymentDate: formatLocalDateTime(paymentDate)
      });

      if (response.data && response.data.success) {
        setTimeout(() => {
          setProcessing(false);
          transitionToStep(STEPS.SUCCESS, 'left');
        }, 1000);
      } else {
        setErrorMessage(response.data?.message || 'Failed to record payment. Please try again.');
        setProcessing(false);
        transitionToStep(STEPS.FAILURE, 'left');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'An error occurred. Please try again.');
      setProcessing(false);
      transitionToStep(STEPS.FAILURE, 'left');
    }
  };

  const handleSuccessAction = (action) => {
    if (action === 'addAnother') {
      // Reset form
      setSelectedType(null);
      setSelectedItem(null);
      setSelectedProperty(null);
      setSelectedUnit(null);
      setSelectedLease(null);
      setPaymentDate(new Date());
      setAmount(0);
      setAmountDisplay('');
      setError(null);
      setErrorMessage('');
      transitionToStep(STEPS.WHO_MADE_PAYMENT, 'right');
    } else if (action === 'viewHistory') {
      if (selectedLease?.id) {
        navigate(`/landlord/payments?leaseId=${selectedLease.id}`);
      } else {
        navigate('/landlord/payments');
      }
    }
  };

  const handleFailureAction = (action) => {
    if (action === 'tryAgain') {
      transitionToStep(STEPS.PAYMENT_SUMMARY, 'right');
    } else if (action === 'cancel') {
      navigate('/landlord/payments');
    }
  };

  // Calculate payment summary values
  const monthlyDue = rentRecord?.rentAmount || rentRecord?.RentAmount || 0;
  const overdue = rentRecord?.overdueAmount || rentRecord?.OverdueAmount || 0;
  const totalDue = monthlyDue + overdue;
  const unpaidFees = []; // TODO: Fetch unpaid fees when fee system is implemented

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.WHO_MADE_PAYMENT:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Who made the payment?
            </Typography>
            <Box sx={{ mt: 3 }}>
              <PaymentRecipientSearch
                onSelect={handleRecipientSelect}
                selectedItem={selectedItem}
              />
            </Box>

            {/* Property with Tenants Display - when property or tenant selected */}
            {(selectedType === 'property' || selectedType === 'tenant') && selectedProperty && propertyDisplay && (
              <Box
                sx={{
                  mt: 4,
                  p: 3,
                  borderRadius: 1.5,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                <Stack spacing={2}>
                  {/* Property */}
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <HomeOutlined style={{ fontSize: 20, color: '#1877F2' }} />
                    </Box>
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        {propertyDisplay}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Tenants */}
                  {propertyTenants.length > 0 && (
                    <Box sx={{ pl: 4 }}>
                      <Stack spacing={1}>
                        {propertyTenants.map((tenant) => (
                          <Stack key={tenant.id} direction="row" spacing={1.5} alignItems="center">
                            <Box
                              sx={{
                                p: 0.75,
                                borderRadius: 1,
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <UserOutlined style={{ fontSize: 16, color: '#52c41a' }} />
                            </Box>
                            <Typography variant="body2" fontWeight={500}>
                              {tenant.firstname} {tenant.lastname}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {/* Unit dropdown - when property selected and multi-unit */}
            {selectedType === 'property' && selectedProperty && isMultiUnitProperty && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'left' }}>
                  Select Unit
                </Typography>
                <Autocomplete
                  options={unitOptions}
                  value={unitOptions.find(u => u.id === selectedUnit?.id) || null}
                  onChange={(event, newValue) => {
                    setSelectedUnit(newValue?.unit || null);
                  }}
                  getOptionLabel={(option) => option?.label || ''}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  label="Unit *"
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

      case STEPS.PAYMENT_SUMMARY:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Payment Summary
            </Typography>

            {/* Property with Tenants Display */}
            {(selectedType === 'property' || selectedType === 'tenant') && selectedProperty && propertyDisplay && (
              <Box
                sx={{
                  mb: 4,
                  p: 3,
                  borderRadius: 1.5,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                <Stack spacing={2}>
                  {/* Property */}
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <HomeOutlined style={{ fontSize: 20, color: '#1877F2' }} />
                    </Box>
                    <Box>
                      <Typography variant="body1" fontWeight={600}>
                        {propertyDisplay}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Tenants */}
                  {propertyTenants.length > 0 && (
                    <Box sx={{ pl: 4 }}>
                      <Stack spacing={1}>
                        {propertyTenants.map((tenant) => (
                          <Stack key={tenant.id} direction="row" spacing={1.5} alignItems="center">
                            <Box
                              sx={{
                                p: 0.75,
                                borderRadius: 1,
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <UserOutlined style={{ fontSize: 16, color: '#52c41a' }} />
                            </Box>
                            <Typography variant="body2" fontWeight={500}>
                              {tenant.firstname} {tenant.lastname}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}

            {/* Payment Summary Card */}
            <Paper
              variant="outlined"
              sx={{
                p: 3.5,
                borderRadius: 1.5,
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
                border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
                mb: 4
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 2.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                Payment Summary
              </Typography>
              {rentRecordsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Monthly Due
                    </Typography>
                    <Typography variant="body1" fontWeight={500} color="text.primary">
                      {formatCurrency(monthlyDue)}
                    </Typography>
                  </Stack>
                  <Divider sx={{ my: 0.5 }} />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Overdue Amount
                      </Typography>
                      {overdue > 0 && (
                        <Chip label="Overdue" size="small" color="error" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }} />
                      )}
                    </Stack>
                    <Typography variant="body1" fontWeight={600} color={overdue > 0 ? 'error.main' : 'text.primary'}>
                      {formatCurrency(overdue)}
                    </Typography>
                  </Stack>
                  {unpaidFees && unpaidFees.length > 0 && (
                    <>
                      <Divider sx={{ my: 0.5 }} />
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
                          Unpaid Fees
                        </Typography>
                        {unpaidFees.map((fee, index) => (
                          <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" color="text.secondary">
                              {fee.name || 'Fee'}
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {formatCurrency(fee.amount || 0)}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </>
                  )}
                  <Divider sx={{ my: 0.5 }} />
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      pt: 1,
                      mt: 1,
                      borderTop: (theme) => `2px solid ${alpha(theme.palette.primary.main, 0.2)}`
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                      Total Due
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      color={overdue > 0 ? 'error.main' : 'success.main'}
                      sx={{
                        fontSize: '1.5rem'
                      }}
                    >
                      {formatCurrency(totalDue)}
                    </Typography>
                  </Stack>
                </Stack>
              )}
            </Paper>

            {/* Payment Date */}
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Payment Date"
                value={paymentDate}
                onChange={(newDate) => setPaymentDate(newDate)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'medium',
                    InputProps: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarMonthOutlinedIcon sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      )
                    },
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5
                      }
                    }
                  }
                }}
                sx={{ mb: 4 }}
              />
            </LocalizationProvider>

            {/* Payment Amount */}
            <TextField
              label="Payment Amount"
              value={amountDisplay}
              onChange={(e) => {
                const value = e.target.value;
                setAmountDisplay(value);
                const parsed = parseCurrencyToNumber(value);
                setAmount(parsed);
              }}
              onBlur={(e) => {
                // Format on blur if there's a valid amount
                const parsed = parseCurrencyToNumber(e.target.value);
                if (parsed > 0) {
                  setAmount(parsed);
                  setAmountDisplay(formatCurrency(parsed));
                } else {
                  setAmountDisplay('');
                }
              }}
              fullWidth
              size="medium"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DollarOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                  </InputAdornment>
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5
                }
              }}
              placeholder="Enter amount"
            />

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.PROCESSING:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Recording payment...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we process your payment.
            </Typography>
          </Box>
        );

      case STEPS.SUCCESS:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: theme.palette.success.main, marginBottom: 16 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Payment Recorded Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Your payment has been recorded successfully.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                onClick={() => handleSuccessAction('addAnother')}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Make Another Payment
              </Button>
              <Button
                variant="contained"
                onClick={() => handleSuccessAction('viewHistory')}
                sx={{ textTransform: 'none', px: 3 }}
              >
                View Payment History
              </Button>
            </Stack>
          </Box>
        );

      case STEPS.FAILURE:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ExclamationCircleOutlined style={{ fontSize: 64, color: theme.palette.error.main, marginBottom: 16 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Payment Failed
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              {errorMessage || 'An error occurred while recording the payment. Please try again.'}
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="outlined"
                onClick={() => handleFailureAction('cancel')}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => handleFailureAction('tryAgain')}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Try Again
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
          { label: 'Record Payment' }
        ]}
      />

      <MainCard sx={{ mt: 3, minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        {/* Step Indicators */}
        {currentStep < STEPS.PROCESSING && currentStep !== STEPS.SUCCESS && currentStep !== STEPS.FAILURE && (
          <Box sx={{ position: 'relative', mb: 4, mt: 2, width: '100%', px: 3, pt: 2, display: { xs: 'none', sm: 'none', md: 'block' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              <Box sx={{ maxWidth: 800, width: '100%' }}>
                <Stepper 
                  activeStep={getStepperStep()} 
                  alternativeLabel
                  connector={<CustomStepConnector />}
                >
                  {paymentSteps.map((label, index) => (
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
          {currentStep < STEPS.PROCESSING && currentStep !== STEPS.SUCCESS && currentStep !== STEPS.FAILURE && (
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
                disabled={currentStep === STEPS.WHO_MADE_PAYMENT || processing}
                startIcon={<ArrowLeftOutlined />}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={currentStep === STEPS.PAYMENT_SUMMARY ? handleSubmitPayment : handleNext}
                disabled={processing || (currentStep === STEPS.PAYMENT_SUMMARY && (!amount || parseFloat(amount) <= 0))}
                sx={{ textTransform: 'none', px: 4, py: 1 }}
              >
                {currentStep === STEPS.PAYMENT_SUMMARY ? 'Mark Payment' : 'Next'}
              </Button>
            </Box>
          )}
        </Box>
      </MainCard>
    </Box>
  );
}
