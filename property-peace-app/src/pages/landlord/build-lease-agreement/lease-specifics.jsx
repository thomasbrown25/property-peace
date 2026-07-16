import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Grid,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Switch,
  Divider,
  alpha,
  useTheme,
  CircularProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import MainCard from 'components/MainCard';
import BuildLeaseAgreementHeader from 'sections/landlord/lease-builder/BuildLeaseAgreementHeader';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties } from 'store/property/property.selector';
import { updateLease, updateLeaseAgreement } from 'store/lease/lease.action';

export default function LeaseSpecificsPage({ embedded = false, onSaved } = {}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();

  // Get data from URL params
  const leaseId = searchParams.get('leaseId') ? parseInt(searchParams.get('leaseId')) : null;
  const propertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const unitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;

  // State
  const [lease, setLease] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [leaseTermType, setLeaseTermType] = useState('fixed-term'); // 'fixed-term' or 'month-to-month'
  const [rentFrequency, setRentFrequency] = useState('Monthly'); // Monthly, Quarterly, Yearly
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  // Auto-renew (fixed-term only)
  const [autoRenewLease, setAutoRenewLease] = useState(false);
  const [autoRenewRentIncrement, setAutoRenewRentIncrement] = useState(false);
  const [autoRenewRentIncrementType, setAutoRenewRentIncrementType] = useState('percentage'); // 'percentage' | 'amount'
  const [autoRenewRentIncrementValue, setAutoRenewRentIncrementValue] = useState('');

  // Ref to always have current start/end for term calculation (avoids stale closure when date picker fires)
  const startEndRef = useRef({ start: null, end: null });
  useEffect(() => {
    startEndRef.current = { start: startDate, end: endDate };
  }, [startDate, endDate]);

  // Load lease and property data
  useEffect(() => {
    const loadData = async () => {
      if (!leaseId || !propertyId) {
        setLoading(false);
        return;
      }

      try {
        // Find property from properties
        const foundProperty = properties?.find((p) => p.id === propertyId);
        if (foundProperty) {
          setProperty(foundProperty);
          
          // Find unit if unitId provided
          if (unitId) {
            const foundUnit = foundProperty.units?.find((u) => u.id === unitId);
            if (foundUnit) {
              setUnit(foundUnit);
            }
          } else {
            // For single-unit properties, get first unit
            const firstUnit = foundProperty.units?.[0];
            if (firstUnit) {
              setUnit(firstUnit);
            }
          }

          // Try to find lease from properties
          let foundLease = null;
          if (unitId) {
            const foundUnit = foundProperty.units?.find((u) => u.id === unitId);
            if (foundUnit) {
              const unitLease = foundUnit.lease || foundUnit.Lease;
              if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
                foundLease = unitLease;
              }
            }
          } else {
            // For single-unit properties, get lease from first unit
            const firstUnit = foundProperty.units?.[0];
            if (firstUnit) {
              const unitLease = firstUnit.lease || firstUnit.Lease;
              if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
                foundLease = unitLease;
              }
            }
          }

          // Set lease if found, otherwise create minimal lease object with ID
          if (foundLease) {
            setLease(foundLease);
            
            // Prefill form data with defaults if not set
            if (foundLease.startDate) {
              setStartDate(new Date(foundLease.startDate));
            } else {
              // Default to current day
              setStartDate(new Date());
            }
            
            if (foundLease.endDate) {
              setEndDate(new Date(foundLease.endDate));
            } else if (foundLease.startDate) {
              // If start date exists but end date doesn't, set to 1 year from start
              const start = new Date(foundLease.startDate);
              const end = new Date(start);
              end.setFullYear(end.getFullYear() + 1);
              setEndDate(end);
            } else {
              // If no dates at all, set end date to 1 year from today
              const today = new Date();
              const end = new Date(today);
              end.setFullYear(end.getFullYear() + 1);
              setEndDate(end);
            }
            const freq = foundLease.rentFrequency ?? foundLease.RentFrequency;
            if (freq) setRentFrequency(freq);
            // Default to fixed-term
            setLeaseTermType('fixed-term');
            // Auto-renew prefill
            setAutoRenewLease(!!(foundLease.autoRenewLease ?? foundLease.AutoRenewLease));
            setAutoRenewRentIncrement(!!(foundLease.autoRenewRentIncrement ?? foundLease.AutoRenewRentIncrement));
            const incType = foundLease.autoRenewRentIncrementType ?? foundLease.AutoRenewRentIncrementType;
            setAutoRenewRentIncrementType(incType === 'amount' ? 'amount' : 'percentage');
            const incVal = foundLease.autoRenewRentIncrementValue ?? foundLease.AutoRenewRentIncrementValue;
            setAutoRenewRentIncrementValue(incVal != null && incVal !== '' ? String(incVal) : '');
          } else {
            // If lease not found in properties, still create minimal lease object with ID
            // We'll use leaseId from URL params for the update
            setLease({ id: leaseId, Id: leaseId });
            
            // Set default dates
            const today = new Date();
            setStartDate(today);
            const end = new Date(today);
            end.setFullYear(end.getFullYear() + 1);
            setEndDate(end);
            setLeaseTermType('fixed-term');
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        openSnackbar({
          open: true,
          message: 'Failed to load lease data',
          variant: 'alert',
          alert: { color: 'error' }
        });
        // Still set a minimal lease object with the ID so we can proceed
        if (leaseId) {
          setLease({ id: leaseId, Id: leaseId });
          // Set default dates
          const today = new Date();
          setStartDate(today);
          const end = new Date(today);
          end.setFullYear(end.getFullYear() + 1);
          setEndDate(end);
          setLeaseTermType('fixed-term');
        }
      } finally {
        setLoading(false);
      }
    };

    if (properties && properties.length > 0) {
      loadData();
    }
  }, [leaseId, propertyId, unitId, properties, dispatch]);

  // Set default end date when start is set but end is not (e.g. initial load or switch to fixed-term)
  useEffect(() => {
    if (leaseTermType === 'fixed-term' && startDate && !endDate) {
      const end = new Date(startDate);
      end.setFullYear(end.getFullYear() + 1);
      setEndDate(end);
    }
  }, [startDate, leaseTermType]);

  const handleBack = () => {
    if (embedded) {
      onSaved?.();
      return;
    }
    navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
  };

  const handleSaveDraft = async () => {
    // Use leaseId from URL params as fallback if lease object doesn't have id
    const currentLeaseId = lease?.id || lease?.Id || leaseId;

    if (!currentLeaseId) {
      openSnackbar({
        open: true,
        message: 'No lease ID found',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    const query = `?leaseId=${leaseId}&propertyId=${propertyId || ''}${unitId ? `&unitId=${unitId}` : ''}`;
    const targetPath = `/landlord/leases/build-lease-agreement${query}`;

    try {
      // Determine if step is complete
      // Fixed-term: requires startDate AND endDate
      // Month-to-month: requires startDate
      const isStepComplete = leaseTermType === 'fixed-term'
        ? !!(startDate && endDate)
        : (startDate !== null);

      let calculatedLeaseLength = null;
      if (leaseTermType === 'fixed-term' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        calculatedLeaseLength = monthsDiff > 0 ? monthsDiff : null;
      }

      const renewalLeaseLength = calculatedLeaseLength ?? lease?.autoRenewLeaseLength ?? lease?.AutoRenewLeaseLength ?? lease?.leaseLength ?? lease?.LeaseLength ?? 12;

      // Save to localStorage
      const draft = {
        leaseId,
        propertyId,
        unitId,
        leaseSpecifics: {
          leaseTermType,
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
          autoRenewLease: leaseTermType === 'fixed-term' ? autoRenewLease : false,
          autoRenewLeaseLength: leaseTermType === 'fixed-term' && autoRenewLease ? renewalLeaseLength : null,
          autoRenewRentIncrement: leaseTermType === 'fixed-term' && autoRenewLease ? autoRenewRentIncrement : false,
          autoRenewRentIncrementType: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement ? autoRenewRentIncrementType : null,
          autoRenewRentIncrementValue: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement && autoRenewRentIncrementValue !== '' ? parseFloat(autoRenewRentIncrementValue) : null
        },
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`leaseAgreementDraft_${leaseId}`, JSON.stringify(draft));

      // If step is complete, update the lease completion status
      if (isStepComplete) {
        const updatePayload = {
          id: currentLeaseId,
          propertyId: property?.id || propertyId,
          unitId: unit?.id || unitId,
          name: lease?.name || lease?.Name,
          startDate: startDate ? startDate.toISOString() : null,
          endDate: leaseTermType === 'fixed-term' ? (endDate ? endDate.toISOString() : null) : null,
          rentAmount: lease?.rentAmount || lease?.RentAmount,
          depositAmount: lease?.depositAmount || lease?.DepositAmount,
          leaseLength: calculatedLeaseLength !== null ? calculatedLeaseLength : (lease?.leaseLength || lease?.LeaseLength),
          rentFrequency: rentFrequency,
          rentDueDay: lease?.rentDueDay || lease?.RentDueDay,
          isActive: lease?.isActive !== undefined ? lease.isActive : true,
          organizationId: lease?.organizationId || lease?.OrganizationId || property?.organizationId,
          isLeaseSpecificsComplete: true,
          autoRenewLease: leaseTermType === 'fixed-term' ? autoRenewLease : false,
          autoRenewLeaseLength: leaseTermType === 'fixed-term' && autoRenewLease ? renewalLeaseLength : null,
          autoRenewRentIncrement: leaseTermType === 'fixed-term' && autoRenewLease ? autoRenewRentIncrement : false,
          autoRenewRentIncrementType: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement ? autoRenewRentIncrementType : undefined,
          autoRenewRentIncrementValue: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement && autoRenewRentIncrementValue !== '' ? parseFloat(autoRenewRentIncrementValue) : undefined
        };

        await dispatch(updateLease(updatePayload));
        await dispatch(updateLeaseAgreement(currentLeaseId, { isLeaseSpecificsComplete: true }));
        await propertiesRefetch();
      }

      openSnackbar({
        open: true,
        message: 'Draft saved successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      openSnackbar({
        open: true,
        message: error?.message || 'Failed to save draft',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      navigate(targetPath);
    }
  };

  const handleSaveAndNext = async () => {
    // Use leaseId from URL params as fallback if lease object doesn't have id
    const currentLeaseId = lease?.id || lease?.Id || leaseId;
    
    if (!currentLeaseId) {
      openSnackbar({
        open: true,
        message: 'No lease ID found',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // Validate dates for fixed-term leases
    if (leaseTermType === 'fixed-term') {
      if (!startDate || !endDate) {
        openSnackbar({
          open: true,
          message: 'Please select both start and end dates for fixed-term leases',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
      if (endDate <= startDate) {
        openSnackbar({
          open: true,
          message: 'End date must be after start date',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
    }

    // Validate dates for month-to-month leases
    if (leaseTermType === 'month-to-month') {
      if (!startDate) {
        openSnackbar({
          open: true,
          message: 'Please select a start date',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
    }

    setSaving(true);
    try {
      // Calculate lease length in months for fixed-term leases
      let calculatedLeaseLength = null;
      if (leaseTermType === 'fixed-term' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        calculatedLeaseLength = monthsDiff > 0 ? monthsDiff : null;
      }
      const renewalLeaseLength = calculatedLeaseLength ?? lease?.autoRenewLeaseLength ?? lease?.AutoRenewLeaseLength ?? lease?.leaseLength ?? lease?.LeaseLength ?? 12;

      // Determine if step is complete
      // Fixed-term: requires startDate AND endDate
      // Month-to-month: requires startDate
      const isStepComplete = leaseTermType === 'fixed-term' 
        ? !!(startDate && endDate)
        : (startDate !== null);

      // Update lease with new dates and calculated lease length
      const updatePayload = {
        id: currentLeaseId,
        propertyId: property?.id || propertyId,
        unitId: unit?.id || unitId,
        name: lease?.name || lease?.Name,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: leaseTermType === 'fixed-term' ? (endDate ? endDate.toISOString() : null) : null,
        rentAmount: lease?.rentAmount || lease?.RentAmount,
        depositAmount: lease?.depositAmount || lease?.DepositAmount,
        leaseLength: calculatedLeaseLength !== null ? calculatedLeaseLength : (lease?.leaseLength || lease?.LeaseLength),
        rentFrequency: rentFrequency,
        rentDueDay: lease?.rentDueDay || lease?.RentDueDay,
        isActive: lease?.isActive !== undefined ? lease.isActive : true,
        organizationId: lease?.organizationId || lease?.OrganizationId || property?.organizationId,
        isLeaseSpecificsComplete: isStepComplete,
        // Preserve other step completion flags from lease (so we don't clear them)
        isRentDepositFeesComplete: lease?.isRentDepositFeesComplete ?? lease?.IsRentDepositFeesComplete,
        isPeopleOnLeaseComplete: lease?.isPeopleOnLeaseComplete ?? lease?.IsPeopleOnLeaseComplete,
        isPetsSmokingOtherComplete: lease?.isPetsSmokingOtherComplete ?? lease?.IsPetsSmokingOtherComplete,
        isUtilitiesMaintenanceKeysComplete: lease?.isUtilitiesMaintenanceKeysComplete ?? lease?.IsUtilitiesMaintenanceKeysComplete,
        isProvisionsAttachmentsComplete: lease?.isProvisionsAttachmentsComplete ?? lease?.IsProvisionsAttachmentsComplete,
        // Auto-renew (fixed-term only)
        autoRenewLease: leaseTermType === 'fixed-term' ? autoRenewLease : false,
        autoRenewLeaseLength: leaseTermType === 'fixed-term' && autoRenewLease ? renewalLeaseLength : null,
        autoRenewRentIncrement: leaseTermType === 'fixed-term' && autoRenewLease ? autoRenewRentIncrement : false,
        autoRenewRentIncrementType: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement ? autoRenewRentIncrementType : undefined,
        autoRenewRentIncrementValue: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement && autoRenewRentIncrementValue !== '' ? parseFloat(autoRenewRentIncrementValue) : undefined
      };

      console.log('Dispatching updateLease with payload:', updatePayload);
      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) await dispatch(updateLeaseAgreement(currentLeaseId, { isLeaseSpecificsComplete: isStepComplete }));
      console.log('Received result from updateLease:', result);
      
      console.log('Update lease result:', result);
      console.log('Result success:', result?.success);
      console.log('Result type:', typeof result);
      
      // Check if result exists and has success === true
      if (result && result.success === true) {
        try {
          // Save draft
          const draft = {
            leaseId,
            propertyId,
            unitId,
            leaseSpecifics: {
              leaseTermType,
              startDate: startDate?.toISOString(),
              endDate: endDate?.toISOString(),
              autoRenewLease: leaseTermType === 'fixed-term' ? autoRenewLease : false,
              autoRenewLeaseLength: leaseTermType === 'fixed-term' && autoRenewLease ? renewalLeaseLength : null,
              autoRenewRentIncrement: leaseTermType === 'fixed-term' && autoRenewLease ? autoRenewRentIncrement : false,
              autoRenewRentIncrementType: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement ? autoRenewRentIncrementType : null,
              autoRenewRentIncrementValue: leaseTermType === 'fixed-term' && autoRenewLease && autoRenewRentIncrement && autoRenewRentIncrementValue !== '' ? parseFloat(autoRenewRentIncrementValue) : null
            },
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(`leaseAgreementDraft_${leaseId}`, JSON.stringify(draft));
          
          await propertiesRefetch();
          
          openSnackbar({
            open: true,
            message: 'Lease specifics saved successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          
          // Navigate to next section
          if (embedded) {
            onSaved?.();
          } else {
            navigate(`/landlord/leases/build-lease-agreement/rent-deposit-fees?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
          }
        } catch (innerError) {
          console.error('Error in success handler:', innerError);
          // Even if refetch fails, the lease was saved successfully
          openSnackbar({
            open: true,
            message: 'Lease specifics saved successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          if (embedded) {
            onSaved?.();
          } else {
            navigate(`/landlord/leases/build-lease-agreement/rent-deposit-fees?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
          }
        }
      } else {
        const errorMessage = result?.message || 'Failed to update lease';
        console.error('Update lease failed:', errorMessage, result);
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error saving lease specifics:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to save lease specifics',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLeaseTermTypeChange = (event) => {
    const newType = event.target.value;
    setLeaseTermType(newType);
    
    // If switching to month-to-month, clear end date
    if (newType === 'month-to-month') {
      setEndDate(null);
    } else if (newType === 'fixed-term' && startDate && !endDate) {
      // If switching to fixed-term and we have a start date but no end date, set end date to 1 year from start
      const end = new Date(startDate);
      end.setFullYear(end.getFullYear() + 1);
      setEndDate(end);
    }
  };

  // Calculate lease term length in months and days
  const calculateLeaseTermLength = () => {
    if (!startDate || !endDate || leaseTermType !== 'fixed-term') {
      return null;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate total difference in milliseconds
    const diffTime = end - start;
    
    // If end is before start, return null
    if (diffTime <= 0) {
      return null;
    }
    
    // Calculate months
    let monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    
    // Calculate remaining days
    // Create a date that is monthsDiff months from start
    const tempDate = new Date(start);
    tempDate.setMonth(tempDate.getMonth() + monthsDiff);
    
    // Calculate days difference between tempDate and end
    const daysDiff = Math.floor((end - tempDate) / (1000 * 60 * 60 * 24));
    
    // If days is negative, we need to adjust (e.g., if start is Jan 31 and end is Feb 28)
    if (daysDiff < 0 && monthsDiff > 0) {
      monthsDiff -= 1;
      // Recalculate tempDate with adjusted months
      const adjustedTempDate = new Date(start);
      adjustedTempDate.setMonth(adjustedTempDate.getMonth() + monthsDiff);
      const adjustedDaysDiff = Math.floor((end - adjustedTempDate) / (1000 * 60 * 60 * 24));
      return {
        months: monthsDiff,
        days: adjustedDaysDiff
      };
    }
    
    return {
      months: monthsDiff,
      days: daysDiff
    };
  };

  const leaseTermLength = calculateLeaseTermLength();

  // When start date changes, auto-adjust end date to keep the same lease term length (user can still edit end date)
  const handleStartDateChange = (newValue) => {
    setStartDate(newValue);
    if (leaseTermType === 'fixed-term' && newValue) {
      const { start, end } = startEndRef.current;
      if (start && end) {
        // Preserve lease term length: shift end date by the same duration (use ref to avoid stale state)
        const termMs = end.getTime() - start.getTime();
        const newEnd = new Date(newValue.getTime() + termMs);
        setEndDate(newEnd);
      } else if (!end) {
        // No end date yet: default to 12 months from start
        const newEnd = new Date(newValue);
        newEnd.setFullYear(newEnd.getFullYear() + 1);
        setEndDate(newEnd);
      }
    }
  };

  // Get property address
  const propertyAddress = property?.streetAddress 
    ? `${property.streetAddress}${property.city ? `, ${property.city}` : ''}${property.state ? `, ${property.state}` : ''}${property.zipCode ? ` ${property.zipCode}` : ''}`
    : 'Property Address';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!lease || !property) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Lease Not Found
        </Typography>
        <Button onClick={handleBack} variant="contained">
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={embedded ? { bgcolor: 'transparent' } : { minHeight: '100vh', bgcolor: 'background.default', display: 'flex', justifyContent: 'center' }}>
      <Container maxWidth={embedded ? false : "md"} disableGutters={embedded} sx={{ py: embedded ? 0 : 3 }}>
        {/* Header */}
        {!embedded && <BuildLeaseAgreementHeader 
          onBack={handleBack}
          onSaveDraft={handleSaveDraft}
          showTitle={false}
        />}

        {/* Main Content */}
        <MainCard>
          <Stack spacing={4}>
            {/* Page Title */}
            {!embedded && (
              <>
                <Box>
                  <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                    Lease Specifics
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Verify the address and lease terms.
                  </Typography>
                </Box>

                <Divider />
              </>
            )}

            {/* Property Address Section */}
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Property Address
              </Typography>
              <Stack spacing={1}>
              <Typography variant="body1" color="text.primary" sx={{ pl: 1.5 }}>
                    {propertyAddress}
                  </Typography>
                {property?.propertyType === 'multiUnit' && unit && (
                  <Stack direction="row" spacing={0.5} sx={{ pl: 1.5 }}>
                    <Typography variant="body1" color="text.secondary">Unit:</Typography>
                    <Typography variant="body1" color="text.primary">{unit.name || unit.Name || ''}</Typography>
                  </Stack>
                )}
              </Stack>
            </Box>

            <Divider />

            {/* Lease Term Section */}
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Lease Term
              </Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  value={leaseTermType}
                  onChange={handleLeaseTermTypeChange}
                  sx={{ mb: 3 }}
                >
                  <FormControlLabel 
                    value="fixed-term" 
                    control={<Radio />} 
                    label="Fixed Term" 
                  />
                  <FormControlLabel 
                    value="month-to-month" 
                    control={<Radio />} 
                    label="Month-to-Month" 
                  />
                </RadioGroup>
              </FormControl>

              {/* Date Pickers */}
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <DatePicker
                    label="Lease Start Date *"
                    value={startDate}
                    onChange={handleStartDateChange}
                    slotProps={{
                      textField: {
                        fullWidth: false,
                        required: true,
                        size: 'small',
                        sx: { width: '200px' }
                      }
                    }}
                  />
                  {leaseTermType === 'fixed-term' && (
                    <DatePicker
                      label="Lease End Date *"
                      value={endDate}
                      onChange={(newValue) => setEndDate(newValue)}
                      minDate={startDate || undefined}
                      slotProps={{
                        textField: {
                          fullWidth: false,
                          required: true,
                          size: 'small',
                          sx: { width: '200px' }
                        }
                      }}
                    />
                  )}
                </Stack>
              </LocalizationProvider>

              {/* Rent Frequency - above Lease Term Length */}
              <FormControl component="fieldset" sx={{ mt: 3 }}>
                <FormLabel>Rent Frequency</FormLabel>
                <RadioGroup
                  row
                  value={rentFrequency}
                  onChange={(e) => setRentFrequency(e.target.value)}
                >
                  <FormControlLabel value="Monthly" control={<Radio size="small" />} label="Monthly" />
                  <FormControlLabel value="Quarterly" control={<Radio size="small" />} label="Quarterly" />
                  <FormControlLabel value="Yearly" control={<Radio size="small" />} label="Yearly" />
                </RadioGroup>
              </FormControl>

              {/* Lease Term Length Display */}
              {leaseTermType === 'fixed-term' && leaseTermLength !== null && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                    Lease Term Length
                  </Typography>
                  <Typography variant="body1" color="text.primary" sx={{ pl: 1.5 }}>
                    {leaseTermLength.months} {leaseTermLength.months === 1 ? 'month' : 'months'}
                    {leaseTermLength.days > 0 && `, ${leaseTermLength.days} ${leaseTermLength.days === 1 ? 'day' : 'days'}`}
                  </Typography>
                </Box>
              )}

              {/* Lease end behavior (fixed-term only) */}
              {leaseTermType === 'fixed-term' && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                    Lease end behavior
                  </Typography>
                  <RadioGroup
                    value={autoRenewLease ? 'auto-renew' : 'end-on-date'}
                    onChange={(e) => setAutoRenewLease(e.target.value === 'auto-renew')}
                    sx={{ mb: 2 }}
                  >
                    <FormControlLabel
                      value="auto-renew"
                      control={<Radio size="small" />}
                      label="Auto-renew at end of term"
                    />
                    <FormControlLabel
                      value="end-on-date"
                      control={<Radio size="small" />}
                      label="Lease ends on end date (no renewal)"
                    />
                  </RadioGroup>
                  {autoRenewLease && (
                    <Box sx={{ pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                      <Typography variant="body2" sx={{ mb: 1.5, mt: 1 }}>
                        Would you like to auto increment rent?
                      </Typography>
                      <RadioGroup
                        row
                        value={autoRenewRentIncrement ? 'yes' : 'no'}
                        onChange={(e) => setAutoRenewRentIncrement(e.target.value === 'yes')}
                        sx={{ mb: 1 }}
                      >
                        <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                        <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                      </RadioGroup>
                      {autoRenewRentIncrement && (
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                          <RadioGroup
                            row
                            value={autoRenewRentIncrementType}
                            onChange={(e) => setAutoRenewRentIncrementType(e.target.value)}
                          >
                            <FormControlLabel value="percentage" control={<Radio size="small" />} label="Percentage" />
                            <FormControlLabel value="amount" control={<Radio size="small" />} label="Fixed amount" />
                          </RadioGroup>
                          <TextField
                            size="small"
                            type="number"
                            placeholder={autoRenewRentIncrementType === 'percentage' ? 'e.g. 3' : 'e.g. 50'}
                            value={autoRenewRentIncrementValue}
                            onChange={(e) => setAutoRenewRentIncrementValue(e.target.value)}
                            inputProps={{
                              min: autoRenewRentIncrementType === 'percentage' ? 0 : 0,
                              max: autoRenewRentIncrementType === 'percentage' ? 100 : undefined,
                              step: autoRenewRentIncrementType === 'percentage' ? 0.5 : 1
                            }}
                            sx={{ width: 120 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {autoRenewRentIncrementType === 'percentage' ? '% per renewal' : '$ per month'}
                          </Typography>
                        </Stack>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            <Divider />

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={handleSaveDraft}
                disabled={saving}
                sx={{ textTransform: 'none', px: 4 }}
              >
                Save
              </Button>
              <Button
                variant="contained"
                onClick={handleSaveAndNext}
                disabled={saving}
                sx={{ textTransform: 'none', px: 4 }}
              >
                {saving ? <CircularProgress size={20} /> : 'Save & Next'}
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Container>
    </Box>
  );
}
