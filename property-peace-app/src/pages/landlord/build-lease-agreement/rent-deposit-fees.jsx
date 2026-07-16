import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Divider,
  CircularProgress,
  TextField,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Checkbox,
  FormControlLabel,
  Chip
} from '@mui/material';
import { NumericFormat } from 'react-number-format';
import MainCard from 'components/MainCard';
import InfoSection from 'components/InfoSection';
import BuildLeaseAgreementHeader from 'sections/landlord/lease-builder/BuildLeaseAgreementHeader';
import DueDateSelector from 'components/input/DueDateSelector';
import ConfigureLateFeesModal from 'components/dialogs/ConfigureLateFeesModal';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties } from 'store/property/property.selector';
import { updateLease, updateLeaseAgreement } from 'store/lease/lease.action';
import { createOrUpdateLateFee } from 'api/lease';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import { getStateDepositLaw, getStateName } from 'api/stateDepositLaw';
import { getStateLaw as getStateLateFeeLaw } from 'api/stateLateFeeLaw';
import { useSubscription } from 'hooks/useSubscription';
import RentEstimateCard from 'components/RentEstimateCard';

export default function RentDepositFeesPage({ embedded = false, onSaved } = {}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();
  const { subscription } = useSubscription();
  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const isPremium = planName === 'premium' || planName.includes('lifetime');

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
  const [monthlyBaseRent, setMonthlyBaseRent] = useState('');
  const [dueDate, setDueDate] = useState(null);
  const [proratedRentDue, setProratedRentDue] = useState(null); // true = yes, false = no, null = not selected

  // Late fees state
  const [lateFeesModalOpen, setLateFeesModalOpen] = useState(false);
  const [lateFees, setLateFees] = useState([]);

  // Deposits state
  const [securityDeposit, setSecurityDeposit] = useState('');
  const [petDeposit, setPetDeposit] = useState('');
  const [otherDeposits, setOtherDeposits] = useState([]);
  const [addOtherDepositModalOpen, setAddOtherDepositModalOpen] = useState(false);
  const [newDepositName, setNewDepositName] = useState('');
  const [newDepositAmount, setNewDepositAmount] = useState('');

  // One-time fees state
  const [oneTimeFees, setOneTimeFees] = useState([]);
  const [addOneTimeFeeModalOpen, setAddOneTimeFeeModalOpen] = useState(false);
  const [newOneTimeFeeName, setNewOneTimeFeeName] = useState('');
  const [newOneTimeFeeAmount, setNewOneTimeFeeAmount] = useState('');

  // State deposit law (for Deposits section info box)
  const [depositLaw, setDepositLaw] = useState(null);
  const [loadingDepositLaw, setLoadingDepositLaw] = useState(false);

  // State late fee law (for Late Fees section info box)
  const [lateFeeLaw, setLateFeeLaw] = useState(null);
  const [loadingLateFeeLaw, setLoadingLateFeeLaw] = useState(false);

  // Rent collection (how will you collect rent – select all that apply)
  const [rentCollectionByPlatform, setRentCollectionByPlatform] = useState(false);
  const [rentCollectionOther, setRentCollectionOther] = useState(false);
  const [rentCollectionOtherOptions, setRentCollectionOtherOptions] = useState({
    cash: false,
    personalCheck: false,
    cashiersCheck: false,
    moneyOrder: false,
    achDirectDeposit: false,
    other: false
  });
  const [rentCollectionOtherSpecify, setRentCollectionOtherSpecify] = useState('');

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

          if (foundLease) {
            setLease(foundLease);
            // Prefill form with existing lease data
            setMonthlyBaseRent(foundLease.rentAmount || foundLease.RentAmount || '');
            setDueDate(foundLease.rentDueDay !== undefined ? foundLease.rentDueDay : (foundLease.RentDueDay !== undefined ? foundLease.RentDueDay : null));
            setSecurityDeposit(foundLease.depositAmount != null ? String(foundLease.depositAmount) : (foundLease.DepositAmount != null ? String(foundLease.DepositAmount) : ''));

            // Prorated rent, pet deposit, rent collection: prefer saved lease values, then draft
            const proratedFromLease = foundLease.proratedRentDue ?? foundLease.ProratedRentDue;
            if (proratedFromLease !== undefined && proratedFromLease !== null) setProratedRentDue(proratedFromLease);
            const petFromLease = foundLease.petDepositAmount ?? foundLease.PetDepositAmount;
            if (petFromLease != null && petFromLease !== '') setPetDeposit(String(petFromLease));
            const rcPlatform = foundLease.rentCollectionByPlatform ?? foundLease.RentCollectionByPlatform;
            if (rcPlatform !== undefined) setRentCollectionByPlatform(rcPlatform);
            const rcOther = foundLease.rentCollectionOther ?? foundLease.RentCollectionOther;
            if (rcOther !== undefined) setRentCollectionOther(rcOther);
            const rcOptions = foundLease.rentCollectionOtherOptions ?? foundLease.RentCollectionOtherOptions;
            if (rcOptions) {
              try {
                setRentCollectionOtherOptions(typeof rcOptions === 'string' ? JSON.parse(rcOptions) : rcOptions);
              } catch (_) { /* ignore */ }
            }
            const rcSpecify = foundLease.rentCollectionOtherSpecify ?? foundLease.RentCollectionOtherSpecify;
            if (rcSpecify != null) setRentCollectionOtherSpecify(rcSpecify || '');

            // Overlay draft if available (for other deposits and any values not on lease yet)
            try {
              const draftJson = localStorage.getItem(`leaseAgreementDraft_${foundLease.id || foundLease.Id}`);
              if (draftJson) {
                const draft = JSON.parse(draftJson);
                const rd = draft?.rentDepositFees;
                if (rd) {
                  if (proratedFromLease === undefined && rd.proratedRentDue !== undefined && rd.proratedRentDue !== null) setProratedRentDue(rd.proratedRentDue);
                  if ((petFromLease == null || petFromLease === '') && rd.petDeposit != null && rd.petDeposit !== '') setPetDeposit(rd.petDeposit);
                  if (Array.isArray(rd.otherDeposits)) setOtherDeposits(rd.otherDeposits);
                  if (rcPlatform === undefined && rd.rentCollectionByPlatform !== undefined) setRentCollectionByPlatform(rd.rentCollectionByPlatform);
                  if (rcOther === undefined && rd.rentCollectionOther !== undefined) setRentCollectionOther(rd.rentCollectionOther);
                  if (!rcOptions && rd.rentCollectionOtherOptions) setRentCollectionOtherOptions(rd.rentCollectionOtherOptions);
                  if ((rcSpecify == null || rcSpecify === '') && rd.rentCollectionOtherSpecify != null) setRentCollectionOtherSpecify(rd.rentCollectionOtherSpecify || '');
                }
              }
            } catch (_) { /* ignore */ }

            // Load existing late fees and one-time fees
            if (foundLease.fees || foundLease.Fees) {
              const fees = foundLease.fees || foundLease.Fees || [];
              const lateFeeList = fees.filter(fee => fee.isLateFee === true || fee.IsLateFee === true);
              const oneTimeFeeList = fees.filter(fee => !(fee.isLateFee === true || fee.IsLateFee === true));
              setLateFees(lateFeeList);
              setOneTimeFees(oneTimeFeeList);
            }
            // Load other deposits from lease.leaseDeposits
            const leaseDeps = foundLease.leaseDeposits ?? foundLease.LeaseDeposits;
            if (Array.isArray(leaseDeps) && leaseDeps.length > 0) {
              const defaultDue = (foundLease.startDate || foundLease.StartDate) ? new Date(foundLease.startDate || foundLease.StartDate).toISOString() : new Date().toISOString();
              setOtherDeposits(leaseDeps.map((d) => ({
                name: d.name ?? d.Name ?? '',
                amount: d.amount ?? d.Amount ?? 0,
                dueDate: d.dueDate ?? d.DueDate ?? defaultDue
              })));
            }
          } else {
            // Create minimal lease object with just the ID
            setLease({ id: leaseId, Id: leaseId });
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (properties && properties.length > 0) {
      loadData();
    }
  }, [leaseId, propertyId, unitId, properties]);

  // Load state deposit law when property has a state (for Deposits section info box)
  const propertyState = property?.state || property?.State;
  useEffect(() => {
    if (!propertyState) {
      setDepositLaw(null);
      return;
    }
    let cancelled = false;
    setLoadingDepositLaw(true);
    setDepositLaw(null);
    getStateDepositLaw(propertyState)
      .then((res) => {
        if (!cancelled && res?.success && res?.data) setDepositLaw(res.data);
      })
      .catch(() => {
        if (!cancelled) setDepositLaw(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDepositLaw(false);
      });
    return () => { cancelled = true; };
  }, [propertyState]);

  // Load state late fee law when property has a state (for Late Fees section info box)
  useEffect(() => {
    if (!propertyState) {
      setLateFeeLaw(null);
      return;
    }
    let cancelled = false;
    setLoadingLateFeeLaw(true);
    setLateFeeLaw(null);
    getStateLateFeeLaw(propertyState)
      .then((res) => {
        if (!cancelled && res?.success && res?.data) setLateFeeLaw(res.data);
      })
      .catch(() => {
        if (!cancelled) setLateFeeLaw(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLateFeeLaw(false);
      });
    return () => { cancelled = true; };
  }, [propertyState]);

  const handleBack = () => {
    if (embedded) {
      onSaved?.();
      return;
    }
    navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
  };

  // Build fees array for API: late fees + one-time fees (dueDate required for LeaseFee)
  const getLeaseStartIso = () => {
    const start = lease?.startDate || lease?.StartDate;
    if (start) return new Date(start).toISOString();
    return new Date().toISOString();
  };
  const buildFeesForApi = () => {
    const leaseStart = getLeaseStartIso();
    const lateFeesForApi = (lateFees || []).map((f) => ({
      id: f.id ?? f.Id,
      leaseId: lease?.id ?? lease?.Id ?? leaseId,
      name: f.name ?? f.Name,
      amount: f.amount ?? f.Amount,
      dueDate: f.dueDate ?? f.DueDate ?? leaseStart,
      isLateFee: true,
      lateFeeType: f.lateFeeType ?? f.LateFeeType,
      feeType: f.feeType ?? f.FeeType,
      percentValue: f.percentValue ?? f.PercentValue,
      appliedAfterDays: f.appliedAfterDays ?? f.AppliedAfterDays,
      startingAfterDays: f.startingAfterDays ?? f.StartingAfterDays,
      limitType: f.limitType ?? f.LimitType,
      limitDays: f.limitDays ?? f.LimitDays,
      limitAmount: f.limitAmount ?? f.LimitAmount,
      limitAmountType: f.limitAmountType ?? f.LimitAmountType
    }));
    const oneTimeFeesForApi = (oneTimeFees || []).map((f) => ({
      id: f.id ?? f.Id,
      leaseId: lease?.id ?? lease?.Id ?? leaseId,
      name: f.name ?? f.Name,
      amount: f.amount ?? f.Amount,
      dueDate: f.dueDate ?? f.DueDate ?? leaseStart,
      isLateFee: false
    }));
    return [...lateFeesForApi, ...oneTimeFeesForApi];
  };

  const buildLeaseDepositsForApi = () => {
    const leaseStart = getLeaseStartIso();
    return (otherDeposits || []).map((d, i) => ({
      id: d.id ?? d.Id ?? 0,
      leaseId: lease?.id ?? lease?.Id ?? leaseId,
      name: d.name ?? d.Name ?? '',
      amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount) || 0,
      dueDate: d.dueDate ? (typeof d.dueDate === 'string' ? d.dueDate : new Date(d.dueDate).toISOString()) : leaseStart,
      sortOrder: i
    }));
  };

  const handleSaveDraft = async () => {
    if (!leaseId) return;
    
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

    // Determine if step is complete
    // Requires monthlyBaseRent to be filled (non-empty, > 0)
    const isStepComplete = monthlyBaseRent && parseFloat(monthlyBaseRent) > 0;
    
    const draft = {
      rentDepositFees: {
        monthlyBaseRent,
        dueDate,
        proratedRentDue,
        petDeposit,
        otherDeposits,
        rentCollectionByPlatform,
        rentCollectionOther,
        rentCollectionOtherOptions,
        rentCollectionOtherSpecify
      },
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(`leaseAgreementDraft_${leaseId}`, JSON.stringify(draft));
    
    // Always persist fees (and other rent/deposit/fees data) to the API so one-time fees and late fees are saved to LeaseFees table
    try {
      const securityDepositNum = securityDeposit === '' || securityDeposit == null ? null : parseFloat(securityDeposit);
      const petDepositNum = petDeposit === '' || petDeposit == null ? null : parseFloat(petDeposit);
      const updatePayload = {
        id: currentLeaseId,
        propertyId: property?.id || propertyId,
        unitId: unit?.id || unitId,
        name: lease?.name || lease?.Name,
        startDate: lease?.startDate || lease?.StartDate,
        endDate: lease?.endDate || lease?.EndDate,
        rentAmount: monthlyBaseRent && parseFloat(monthlyBaseRent) > 0 ? parseFloat(monthlyBaseRent) : (lease?.rentAmount ?? lease?.RentAmount),
        depositAmount: securityDepositNum ?? lease?.depositAmount ?? lease?.DepositAmount,
        leaseLength: lease?.leaseLength || lease?.LeaseLength,
        rentFrequency: lease?.rentFrequency || lease?.RentFrequency || 'Monthly',
        rentDueDay: dueDate !== null && dueDate !== undefined ? dueDate : (lease?.rentDueDay ?? lease?.RentDueDay),
        isRentDepositFeesComplete: isStepComplete,
        fees: buildFeesForApi(),
        leaseDeposits: buildLeaseDepositsForApi(),
        proratedRentDue: proratedRentDue ?? undefined,
        isProratedRent: proratedRentDue ?? undefined,
        petDepositAmount: petDepositNum ?? undefined,
        rentCollectionByPlatform: rentCollectionByPlatform ?? undefined,
        rentCollectionOther: rentCollectionOther ?? undefined,
        rentCollectionOtherOptions: Object.keys(rentCollectionOtherOptions || {}).length ? JSON.stringify(rentCollectionOtherOptions) : undefined,
        rentCollectionOtherSpecify: rentCollectionOtherSpecify || undefined,
        // Preserve other step completion flags from lease
        isLeaseSpecificsComplete: lease?.isLeaseSpecificsComplete ?? lease?.IsLeaseSpecificsComplete,
        isPeopleOnLeaseComplete: lease?.isPeopleOnLeaseComplete ?? lease?.IsPeopleOnLeaseComplete,
        isPetsSmokingOtherComplete: lease?.isPetsSmokingOtherComplete ?? lease?.IsPetsSmokingOtherComplete,
        isUtilitiesMaintenanceKeysComplete: lease?.isUtilitiesMaintenanceKeysComplete ?? lease?.IsUtilitiesMaintenanceKeysComplete,
        isProvisionsAttachmentsComplete: lease?.isProvisionsAttachmentsComplete ?? lease?.IsProvisionsAttachmentsComplete
      };
      await dispatch(updateLease(updatePayload));
      await dispatch(updateLeaseAgreement(currentLeaseId, { isRentDepositFeesComplete: true }));
      await propertiesRefetch();
    } catch (error) {
      console.error('Error saving draft to API:', error);
      // Don't show error to user - draft was saved to localStorage
    }
    
    openSnackbar({
      open: true,
      message: 'Draft saved successfully',
      variant: 'alert',
      alert: { color: 'success' }
    });
    if (embedded) {
      onSaved?.();
    } else {
      navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
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

    // Validate monthly base rent
    if (!monthlyBaseRent || parseFloat(monthlyBaseRent) <= 0) {
      openSnackbar({
        open: true,
        message: 'Please enter a valid monthly base rent',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    // Validate due date
    if (dueDate === null || dueDate === undefined) {
      openSnackbar({
        open: true,
        message: 'Please select a due date',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setSaving(true);
    try {
      // Determine if step is complete
      // Requires monthlyBaseRent to be filled (non-empty, > 0)
      const isStepComplete = !!(monthlyBaseRent && parseFloat(monthlyBaseRent) > 0);
      const securityDepositNum = securityDeposit === '' || securityDeposit == null ? null : parseFloat(securityDeposit);

      // Update lease with rent amount, due date, security deposit, fees, prorated rent, pet deposit, rent collection
      const petDepositNum = petDeposit === '' || petDeposit == null ? null : parseFloat(petDeposit);
      const updatePayload = {
        id: currentLeaseId,
        propertyId: property?.id || propertyId,
        unitId: unit?.id || unitId,
        name: lease?.name || lease?.Name,
        startDate: lease?.startDate || lease?.StartDate,
        endDate: lease?.endDate || lease?.EndDate,
        rentAmount: parseFloat(monthlyBaseRent),
        depositAmount: securityDepositNum ?? lease?.depositAmount ?? lease?.DepositAmount,
        leaseLength: lease?.leaseLength || lease?.LeaseLength,
        rentFrequency: lease?.rentFrequency || lease?.RentFrequency || 'Monthly',
        rentDueDay: dueDate, // This will be -1 for "last day" or 1-28 for specific days
        isRentDepositFeesComplete: isStepComplete,
        fees: buildFeesForApi(),
        leaseDeposits: buildLeaseDepositsForApi(),
        proratedRentDue: proratedRentDue ?? undefined,
        isProratedRent: proratedRentDue ?? undefined,
        petDepositAmount: petDepositNum ?? undefined,
        rentCollectionByPlatform: rentCollectionByPlatform ?? undefined,
        rentCollectionOther: rentCollectionOther ?? undefined,
        rentCollectionOtherOptions: Object.keys(rentCollectionOtherOptions || {}).length ? JSON.stringify(rentCollectionOtherOptions) : undefined,
        rentCollectionOtherSpecify: rentCollectionOtherSpecify || undefined,
        // Preserve other step completion flags from lease
        isLeaseSpecificsComplete: lease?.isLeaseSpecificsComplete ?? lease?.IsLeaseSpecificsComplete,
        isPeopleOnLeaseComplete: lease?.isPeopleOnLeaseComplete ?? lease?.IsPeopleOnLeaseComplete,
        isPetsSmokingOtherComplete: lease?.isPetsSmokingOtherComplete ?? lease?.IsPetsSmokingOtherComplete,
        isUtilitiesMaintenanceKeysComplete: lease?.isUtilitiesMaintenanceKeysComplete ?? lease?.IsUtilitiesMaintenanceKeysComplete,
        isProvisionsAttachmentsComplete: lease?.isProvisionsAttachmentsComplete ?? lease?.IsProvisionsAttachmentsComplete
      };

      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) await dispatch(updateLeaseAgreement(currentLeaseId, { isRentDepositFeesComplete: true }));

      if (result?.success) {
        // Save draft to localStorage
        const draft = {
          rentDepositFees: {
            monthlyBaseRent,
            dueDate,
            proratedRentDue,
            petDeposit,
            otherDeposits,
            rentCollectionByPlatform,
            rentCollectionOther,
            rentCollectionOtherOptions,
            rentCollectionOtherSpecify
          },
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(`leaseAgreementDraft_${leaseId}`, JSON.stringify(draft));
        
        try {
          await propertiesRefetch();
          openSnackbar({
            open: true,
            message: 'Rent, deposit, and fees saved successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          if (embedded) {
            onSaved?.();
          } else {
            navigate(`/landlord/leases/build-lease-agreement/people-on-lease?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
          }
        } catch (innerError) {
          console.error('Error in success handler:', innerError);
          openSnackbar({
            open: true,
            message: 'Rent, deposit, and fees saved successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          if (embedded) {
            onSaved?.();
          } else {
            navigate(`/landlord/leases/build-lease-agreement/people-on-lease?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
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
      console.error('Error saving rent, deposit, and fees:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to save rent, deposit, and fees',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
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
                    Rent, Deposit, & Fees
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Set the rent amount, security deposit, and fees.
                  </Typography>
                </Box>

                <Divider />
              </>
            )}

            {/* Monthly Rent Section */}
            <Box>
              <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>
                Monthly rent
              </Typography>
              
              <Stack direction="row" spacing={3} sx={{ maxWidth: '600px' }}>
                <Box sx={{ width: '200px' }}>
                  <Stack sx={{ gap: 1 }}>
                    <InputLabel htmlFor="monthly-base-rent-input">Monthly Base Rent</InputLabel>
                    <NumericFormat
                      customInput={TextField}
                      id="monthly-base-rent-input"
                      fullWidth
                      size="small"
                      value={monthlyBaseRent || ''}
                      onValueChange={(values) => {
                        setMonthlyBaseRent(values.floatValue || '');
                      }}
                      thousandSeparator
                      prefix="$"
                      decimalScale={2}
                      fixedDecimalScale
                      placeholder="$0.00"
                    />
                  </Stack>
                </Box>

                <Box sx={{ width: '200px' }}>
                  <DueDateSelector
                    label="Due Date"
                    value={dueDate}
                    onChange={(value) => {
                      setDueDate(value);
                    }}
                    helperText="Select the day of the month when rent is due"
                  />
                </Box>
              </Stack>

              {propertyId && unit?.id && (
                <Box sx={{ mt: 2, maxWidth: '600px' }}>
                  <RentEstimateCard
                    propertyId={propertyId}
                    unitId={unit.id}
                    isPremium={isPremium}
                    onUseAmount={(amount) => setMonthlyBaseRent(amount)}
                  />
                </Box>
              )}

              {/* Prorated rent */}
              <Box sx={{ mt: 3, maxWidth: '600px' }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                  Prorated rent at move-in
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Will there be prorated rent due at move-in? If the tenant does not move in on the 1st of the month, you can charge a prorated amount for the partial month. This covers rent until the first full month&apos;s payment is due.
                </Typography>
                <ToggleButtonGroup
                  value={proratedRentDue}
                  exclusive
                  onChange={(_, val) => val != null && setProratedRentDue(val)}
                  size="small"
                  sx={{ mt: 0.5 }}
                >
                  <ToggleButton value={true} aria-label="yes">Yes</ToggleButton>
                  <ToggleButton value={false} aria-label="no">No</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>

            <Divider />

            {/* Deposits Section */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight={600}>
                  Deposits
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<PlusOutlined />}
                  onClick={() => {
                    setNewDepositName('');
                    setNewDepositAmount('');
                    setAddOtherDepositModalOpen(true);
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Add other deposit
                </Button>
              </Box>

              {/* State deposit law info box */}
              {propertyState && (
                <Box sx={{ mb: 3 }}>
                  {loadingDepositLaw ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : depositLaw ? (
                    <InfoSection
                      title={`${getStateName(depositLaw.state)} security deposit laws included in your lease agreement:`}
                      bullets={Array.isArray(depositLaw.bulletPoints) && depositLaw.bulletPoints.length > 0 ? depositLaw.bulletPoints.map((b) => b.replace(/^[\s•\-–]+/, '').trim()) : ['No bullet points available.']}
                    />
                  ) : (
                    <InfoSection
                      title="State deposit law"
                      bullets={[`State deposit law information for ${propertyState} is not available yet.`]}
                    />
                  )}
                </Box>
              )}

              <Stack direction="row" spacing={3} sx={{ maxWidth: '600px', flexWrap: 'wrap' }}>
                <Box sx={{ width: '200px' }}>
                  <Stack sx={{ gap: 1 }}>
                    <InputLabel htmlFor="security-deposit-input">Security Deposit</InputLabel>
                    <NumericFormat
                      customInput={TextField}
                      id="security-deposit-input"
                      fullWidth
                      size="small"
                      value={securityDeposit || ''}
                      onValueChange={(values) => {
                        setSecurityDeposit(values.floatValue != null ? String(values.floatValue) : '');
                      }}
                      thousandSeparator
                      prefix="$"
                      decimalScale={2}
                      fixedDecimalScale
                      placeholder="$0.00"
                    />
                  </Stack>
                </Box>
                <Box sx={{ width: '200px' }}>
                  <Stack sx={{ gap: 1 }}>
                    <InputLabel htmlFor="pet-deposit-input">Pet Deposit</InputLabel>
                    <NumericFormat
                      customInput={TextField}
                      id="pet-deposit-input"
                      fullWidth
                      size="small"
                      value={petDeposit || ''}
                      onValueChange={(values) => {
                        setPetDeposit(values.floatValue != null ? String(values.floatValue) : '');
                      }}
                      thousandSeparator
                      prefix="$"
                      decimalScale={2}
                      fixedDecimalScale
                      placeholder="$0.00"
                    />
                  </Stack>
                </Box>
              </Stack>

              {otherDeposits.length > 0 && (
                <Stack spacing={1} sx={{ mt: 2 }}>
                  {otherDeposits.map((dep) => (
                    <Box
                      key={dep.id}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        maxWidth: '600px'
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {dep.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ${typeof dep.amount === 'number' ? dep.amount.toFixed(2) : dep.amount}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>

            <Divider />

            {/* Late Fees Section */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight={600}>
                  Late fees
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<PlusOutlined />}
                  onClick={() => setLateFeesModalOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Add Late Fees
                </Button>
              </Box>

              {/* State late fee law info box */}
              {propertyState && (
                <Box sx={{ mb: 3 }}>
                  {loadingLateFeeLaw ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : lateFeeLaw ? (
                    <InfoSection
                      title={`${getStateName(lateFeeLaw.state)} late fee laws included in your lease agreement:`}
                      bullets={[lateFeeLaw.gracePeriodDescription, lateFeeLaw.feeAmountDescription].filter(Boolean).map((b) => b.replace(/^[\s•\-–]+/, '').trim())}
                    />
                  ) : (
                    <InfoSection
                      title="State late fee law"
                      bullets={[`State late fee law information for ${propertyState} is not available yet.`]}
                    />
                  )}
                </Box>
              )}

              {lateFees.length > 0 ? (
                <Stack spacing={1}>
                  {lateFees.map((fee) => (
                    <Box
                      key={fee.id || fee.Id}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {fee.name || fee.Name || (fee.lateFeeType === 'OneTime' ? 'One-time Initial Fee' : 'Daily Late Fees')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {fee.lateFeeType === 'OneTime' ? (
                          <>
                            {fee.feeType === 'Flat' ? `$${fee.amount || fee.Amount}` : `${fee.percentValue || fee.PercentValue}% ${fee.feeType === 'PercentRent' ? 'of rent' : 'of unpaid'}`}
                            {' • Applied '}
                            {fee.appliedAfterDays || fee.AppliedAfterDays} day{(fee.appliedAfterDays || fee.AppliedAfterDays) !== 1 ? 's' : ''} after rent is due
                          </>
                        ) : (
                          <>
                            ${fee.amount || fee.Amount} per day
                            {' • Starting '}
                            {fee.startingAfterDays || fee.StartingAfterDays} day{(fee.startingAfterDays || fee.StartingAfterDays) !== 1 ? 's' : ''} after rent is due
                            {fee.limitType && fee.limitType !== 'NoLimit' && (
                              <>
                                {' • '}
                                {fee.limitType === 'StopAfterDays' 
                                  ? `Stop after ${fee.limitDays || fee.LimitDays} days`
                                  : `Max total: ${fee.limitAmountType === 'Flat' ? '$' : ''}${fee.limitAmount || fee.LimitAmount}${fee.limitAmountType === 'PercentRent' ? '% of rent' : ''}`
                                }
                              </>
                            )}
                          </>
                        )}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No late fees configured. Click "Add Late Fees" to configure automatic late fees.
                </Typography>
              )}
            </Box>

            <Divider />

            {/* One Time Fees Section */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" fontWeight={600}>
                  One-time fees
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<PlusOutlined />}
                  onClick={() => {
                    setNewOneTimeFeeName('');
                    setNewOneTimeFeeAmount('');
                    setAddOneTimeFeeModalOpen(true);
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Add one-time fee
                </Button>
              </Box>

              {oneTimeFees.length > 0 ? (
                <Stack spacing={1}>
                  {oneTimeFees.map((fee) => (
                    <Box
                      key={fee.id || fee.Id}
                      sx={{
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper'
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {fee.name || fee.Name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ${typeof (fee.amount ?? fee.Amount) === 'number' ? Number(fee.amount ?? fee.Amount).toFixed(2) : (fee.amount ?? fee.Amount ?? '0.00')}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    No one-time fees. Click "Add one-time fee" to add fees due at move-in or lease start.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Common examples: admin fee, key/door fee, move-in fee.
                  </Typography>
                </Stack>
              )}
            </Box>

            <Divider />

            {/* Rent Collection Section */}
            <Box>
              <Typography variant="h5" fontWeight={600} sx={{ mb: 1 }}>
                Rent collection
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                How will you collect rent?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                Select all that apply.
              </Typography>

              <Stack spacing={2}>
                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={rentCollectionByPlatform}
                          onChange={(e) => setRentCollectionByPlatform(e.target.checked)}
                        />
                      }
                      label={
                        <Typography variant="subtitle1" fontWeight={600}>
                          Rent payments by Property Peace
                        </Typography>
                      }
                    />
                    <Chip
                      label="Recommended"
                      size="small"
                      sx={{
                        bgcolor: 'warning.main',
                        color: 'warning.contrastText',
                        fontWeight: 600,
                        fontSize: '0.7rem'
                      }}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 4.5, mt: 0.5 }}>
                    ACH, debit or credit card. Automatic reminders, late fees, and receipts.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rentCollectionOther}
                        onChange={(e) => setRentCollectionOther(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="subtitle1" fontWeight={600}>
                        Other methods outside of Property Peace
                      </Typography>
                    }
                  />
                  {rentCollectionOther && (
                    <Stack spacing={1} sx={{ ml: 4.5, mt: 2 }}>
                      <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 0.5 }}>
                        What payment methods will you accept outside of Property Peace?
                      </Typography>
                      <Stack spacing={0.5}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={rentCollectionOtherOptions.cash}
                              onChange={(e) =>
                                setRentCollectionOtherOptions((prev) => ({ ...prev, cash: e.target.checked }))
                              }
                            />
                          }
                          label={<Typography variant="body2">Cash</Typography>}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={rentCollectionOtherOptions.personalCheck}
                              onChange={(e) =>
                                setRentCollectionOtherOptions((prev) => ({ ...prev, personalCheck: e.target.checked }))
                              }
                            />
                          }
                          label={<Typography variant="body2">Personal check</Typography>}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={rentCollectionOtherOptions.cashiersCheck}
                              onChange={(e) =>
                                setRentCollectionOtherOptions((prev) => ({ ...prev, cashiersCheck: e.target.checked }))
                              }
                            />
                          }
                          label={<Typography variant="body2">Cashier&apos;s check</Typography>}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={rentCollectionOtherOptions.moneyOrder}
                              onChange={(e) =>
                                setRentCollectionOtherOptions((prev) => ({ ...prev, moneyOrder: e.target.checked }))
                              }
                            />
                          }
                          label={<Typography variant="body2">Money order</Typography>}
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={rentCollectionOtherOptions.achDirectDeposit}
                              onChange={(e) =>
                                setRentCollectionOtherOptions((prev) => ({
                                  ...prev,
                                  achDirectDeposit: e.target.checked
                                }))
                              }
                            />
                          }
                          label={
                            <Typography variant="body2">
                              ACH / direct deposit (Venmo, Zelle, PayPal, etc.)
                            </Typography>
                          }
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="small"
                              checked={rentCollectionOtherOptions.other}
                              onChange={(e) =>
                                setRentCollectionOtherOptions((prev) => ({ ...prev, other: e.target.checked }))
                              }
                            />
                          }
                          label={<Typography variant="body2">Other payment service</Typography>}
                        />
                      </Stack>
                      {rentCollectionOtherOptions.other && (
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Please specify"
                          value={rentCollectionOtherSpecify}
                          onChange={(e) => setRentCollectionOtherSpecify(e.target.value)}
                          sx={{ maxWidth: 320, mt: 1 }}
                        />
                      )}
                    </Stack>
                  )}
                </Box>
              </Stack>

              <Box sx={{ mt: 3 }}>
                <InfoSection
                  title="Things to consider"
                  bullets={[
                    'Choose payment methods your tenants can use easily—automatic payments can help everyone stay on track.',
                    'Venmo, Zelle, PayPal, and similar services are convenient but may charge fees or have limits.',
                    'Clear records simplify accounting and can help resolve disputes; some states require them.',
                    'In some states, accepting any payment can affect eviction rights. Most payment tools do not let you block payments.'
                  ]}
                />
              </Box>
            </Box>

            <Divider />

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={handleBack}
                disabled={saving}
                sx={{ textTransform: 'none', px: 4 }}
              >
                Cancel
              </Button>
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
                {saving ? 'Saving...' : 'Save & Next'}
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Container>

      {/* Add Other Deposit Modal */}
      <Dialog
        open={addOtherDepositModalOpen}
        onClose={() => setAddOtherDepositModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { maxWidth: 380 } }}
      >
        <DialogTitle>Add other deposit</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <InputLabel htmlFor="new-deposit-name-input" sx={{ mb: 0.5 }}>Deposit name</InputLabel>
              <TextField
                id="new-deposit-name-input"
                size="small"
                fullWidth
                value={newDepositName}
                onChange={(e) => setNewDepositName(e.target.value)}
                placeholder="e.g. Key deposit, Cleaning fee"
              />
            </Box>
            <Box>
              <InputLabel htmlFor="new-deposit-amount-input" sx={{ mb: 0.5 }}>Amount</InputLabel>
              <NumericFormat
                customInput={TextField}
                id="new-deposit-amount-input"
                fullWidth
                size="small"
                value={newDepositAmount}
                onValueChange={(values) => {
                  setNewDepositAmount(values.floatValue != null ? String(values.floatValue) : '');
                }}
                thousandSeparator
                prefix="$"
                decimalScale={2}
                fixedDecimalScale
                placeholder="$0.00"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOtherDepositModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const name = (newDepositName || '').trim();
              const amount = newDepositAmount === '' ? null : parseFloat(newDepositAmount);
              if (!name) {
                openSnackbar({
                  open: true,
                  message: 'Please enter a deposit name',
                  variant: 'alert',
                  alert: { color: 'warning' }
                });
                return;
              }
              if (amount == null || isNaN(amount) || amount < 0) {
                openSnackbar({
                  open: true,
                  message: 'Please enter a valid amount',
                  variant: 'alert',
                  alert: { color: 'warning' }
                });
                return;
              }
              setOtherDeposits((prev) => [
                ...prev,
                { id: `dep-${Date.now()}`, name, amount }
              ]);
              setNewDepositName('');
              setNewDepositAmount('');
              setAddOtherDepositModalOpen(false);
            }}
            sx={{ textTransform: 'none' }}
          >
            Add deposit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add One Time Fee Modal */}
      <Dialog
        open={addOneTimeFeeModalOpen}
        onClose={() => setAddOneTimeFeeModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { maxWidth: 380 } }}
      >
        <DialogTitle>Add one-time fee</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Box>
              <InputLabel htmlFor="new-onetime-fee-name-input" sx={{ mb: 0.5 }}>Fee name</InputLabel>
              <TextField
                id="new-onetime-fee-name-input"
                size="small"
                fullWidth
                value={newOneTimeFeeName}
                onChange={(e) => setNewOneTimeFeeName(e.target.value)}
                placeholder="e.g. Application fee, Admin fee"
              />
            </Box>
            <Box>
              <InputLabel htmlFor="new-onetime-fee-amount-input" sx={{ mb: 0.5 }}>Amount</InputLabel>
              <NumericFormat
                customInput={TextField}
                id="new-onetime-fee-amount-input"
                fullWidth
                size="small"
                value={newOneTimeFeeAmount}
                onValueChange={(values) => {
                  setNewOneTimeFeeAmount(values.floatValue != null ? String(values.floatValue) : '');
                }}
                thousandSeparator
                prefix="$"
                decimalScale={2}
                fixedDecimalScale
                placeholder="$0.00"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOneTimeFeeModalOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const name = (newOneTimeFeeName || '').trim();
              const amount = newOneTimeFeeAmount === '' ? null : parseFloat(newOneTimeFeeAmount);
              if (!name) {
                openSnackbar({
                  open: true,
                  message: 'Please enter a fee name',
                  variant: 'alert',
                  alert: { color: 'warning' }
                });
                return;
              }
              if (amount == null || isNaN(amount) || amount < 0) {
                openSnackbar({
                  open: true,
                  message: 'Please enter a valid amount',
                  variant: 'alert',
                  alert: { color: 'warning' }
                });
                return;
              }
              setOneTimeFees((prev) => [
                ...prev,
                { name, amount, dueDate: getLeaseStartIso() }
              ]);
              setNewOneTimeFeeName('');
              setNewOneTimeFeeAmount('');
              setAddOneTimeFeeModalOpen(false);
            }}
            sx={{ textTransform: 'none' }}
          >
            Add fee
          </Button>
        </DialogActions>
      </Dialog>

      {/* Configure Late Fees Modal */}
      <ConfigureLateFeesModal
        open={lateFeesModalOpen}
        onClose={() => setLateFeesModalOpen(false)}
        onSave={async (newLateFees) => {
          try {
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

            // Preserve one-time fees from state when saving late fees
            const leaseStart = getLeaseStartIso();
            const oneTimeFeesForApi = (oneTimeFees || []).map((f) => ({
              id: f.id ?? f.Id,
              leaseId: currentLeaseId,
              name: f.name ?? f.Name,
              amount: f.amount ?? f.Amount,
              dueDate: f.dueDate ?? f.DueDate ?? leaseStart,
              isLateFee: false
            }));

            // Combine one-time fees with new late fees
            const allFees = [...oneTimeFeesForApi, ...newLateFees];

            // Update lease with all fees
            const updatePayload = {
              id: currentLeaseId,
              propertyId: property?.id || propertyId,
              unitId: unit?.id || unitId,
              name: lease?.name || lease?.Name,
              startDate: lease?.startDate || lease?.StartDate,
              endDate: lease?.endDate || lease?.EndDate,
              rentAmount: parseFloat(monthlyBaseRent) || lease?.rentAmount || lease?.RentAmount,
              depositAmount: lease?.depositAmount || lease?.DepositAmount,
              leaseLength: lease?.leaseLength || lease?.LeaseLength,
              rentFrequency: lease?.rentFrequency || lease?.RentFrequency || 'Monthly',
              rentDueDay: dueDate !== null && dueDate !== undefined ? dueDate : (lease?.rentDueDay || lease?.RentDueDay),
              fees: allFees,
              leaseDeposits: buildLeaseDepositsForApi()
            };

            const result = await dispatch(updateLease(updatePayload));

            if (result?.success) {
              setLateFees(newLateFees);
              await propertiesRefetch();
              openSnackbar({
                open: true,
                message: 'Late fees saved successfully',
                variant: 'alert',
                alert: { color: 'success' }
              });
              setLateFeesModalOpen(false);
            } else {
              openSnackbar({
                open: true,
                message: result?.message || 'Failed to save late fees',
                variant: 'alert',
                alert: { color: 'error' }
              });
            }
          } catch (error) {
            console.error('Error saving late fees:', error);
            openSnackbar({
              open: true,
              message: 'Failed to save late fees',
              variant: 'alert',
              alert: { color: 'error' }
            });
          }
        }}
        leaseId={leaseId}
        propertyState={property?.state || property?.State}
        existingLateFees={lateFees}
      />
    </Box>
  );
}
