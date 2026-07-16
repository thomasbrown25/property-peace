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
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  CircularProgress,
  useTheme,
  alpha,
  IconButton
} from '@mui/material';
import MainCard from 'components/MainCard';
import BuildLeaseAgreementHeader from 'sections/landlord/lease-builder/BuildLeaseAgreementHeader';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties } from 'store/property/property.selector';
import { updateLease, updateLeaseAgreement } from 'store/lease/lease.action';
import {
  SafetyOutlined,
  CarOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';

const DEFAULT_PARKING_RULE = `Tenant shall use the assigned parking space exclusively for parking passenger automobiles. The space may not be used for vehicle washing, oil changes, repairs, or storage. Trucks or pickups over one ton, boats, recreational vehicles, trailers, and unlicensed or abandoned vehicles are prohibited without prior written permission from the Landlord. Tenant shall not park in any other space. Landlord may reassign the parking space or permit with seven days notice. Guests must park on adjacent streets or in designated guest areas. Vehicles parked in violation may be towed at the owner's risk and expense.`;

const PARKING_TYPES = [
  { id: 'garage', label: 'Garage' },
  { id: 'driveway', label: 'Driveway' },
  { id: 'street', label: 'Street' },
  { id: 'carport', label: 'Carport' },
  { id: 'designatedSpace', label: 'Designated Space' },
  { id: 'other', label: 'Other' }
];

export default function PetsSmokingOtherPage({ embedded = false, onSaved } = {}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const properties = useSelector(selectProperties);
  const { propertiesRefetch } = useFetchProperties();

  const leaseId = searchParams.get('leaseId') ? parseInt(searchParams.get('leaseId')) : null;
  const propertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const unitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;

  const [lease, setLease] = useState(null);
  const [property, setProperty] = useState(null);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [petsAllowed, setPetsAllowed] = useState(false);
  const [pets, setPets] = useState([]); // [{ type, breed, weight, age }, ...] — weight/age as strings for inputs
  const [smokingAllowed, setSmokingAllowed] = useState('no'); // yes, no, outsideOnly
  const [includeParkingRules, setIncludeParkingRules] = useState(false);
  const [parkingTypes, setParkingTypes] = useState([]); // ['garage', 'driveway', ...]
  const [parkingCustomRules, setParkingCustomRules] = useState(DEFAULT_PARKING_RULE);

  useEffect(() => {
    const loadData = async () => {
      if (!leaseId || !propertyId) {
        setLoading(false);
        return;
      }
      const foundProperty = properties?.find((p) => p.id === propertyId);
      if (!foundProperty) {
        setLoading(false);
        return;
      }
      setProperty(foundProperty);
      const targetUnit = unitId
        ? foundProperty.units?.find((u) => u.id === unitId)
        : foundProperty.units?.[0];
      if (targetUnit) {
        setUnit(targetUnit);
        const unitLease = targetUnit.lease || targetUnit.Lease;
        if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
          setLease(unitLease);
          setPetsAllowed(unitLease.petsAllowed ?? unitLease.PetsAllowed ?? false);
          const rawPets = unitLease.pets ?? unitLease.Pets;
          if (Array.isArray(rawPets) && rawPets.length > 0) {
            setPets(rawPets.map((p) => ({
              id: p.id ?? p.Id,
              type: p.type ?? p.Type ?? '',
              breed: p.breed ?? p.Breed ?? '',
              weight: p.weight != null && p.weight !== '' ? String(p.weight) : (p.Weight != null && p.Weight !== '' ? String(p.Weight) : ''),
              age: p.age != null && p.age !== '' ? String(p.age) : (p.Age != null && p.Age !== '' ? String(p.Age) : '')
            })));
          } else {
            const allowed = unitLease.petsAllowed ?? unitLease.PetsAllowed ?? false;
            setPets(allowed ? [{ type: '', breed: '', weight: '', age: '' }] : []);
          }
          const smoking = unitLease.smokingAllowed ?? unitLease.SmokingAllowed;
          setSmokingAllowed(smoking === 'yes' || smoking === 'outsideOnly' ? smoking : 'no');
          const parking = unitLease.parking ?? unitLease.Parking;
          if (parking) {
            setIncludeParkingRules(parking.includeParkingRules ?? parking.IncludeParkingRules ?? false);
            const types = parking.parkingTypes ?? parking.ParkingTypes;
            if (types) {
              try {
                const arr = typeof types === 'string' ? JSON.parse(types) : types;
                setParkingTypes(Array.isArray(arr) ? arr : []);
              } catch {
                setParkingTypes([]);
              }
            }
            const rules = parking.customRules ?? parking.CustomRules;
            if (rules) setParkingCustomRules(rules);
          }
        }
      }
      setLoading(false);
    };
    if (properties && properties.length > 0) loadData();
  }, [leaseId, propertyId, unitId, properties]);

  useEffect(() => {
    if (leaseId && propertyId) propertiesRefetch();
  }, [leaseId, propertyId, propertiesRefetch]);

  const handleBack = () => {
    if (embedded) {
      onSaved?.();
      return;
    }
    navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
  };

  const handleSaveDraft = async () => {
    if (!leaseId || !lease) return;
    const currentLeaseId = lease?.id || lease?.Id || leaseId;
    try {
      const updatePayload = buildUpdatePayload(currentLeaseId);
      await dispatch(updateLease(updatePayload));
      await dispatch(updateLeaseAgreement(currentLeaseId, { isPetsSmokingOtherComplete: true }));
      await propertiesRefetch();
      openSnackbar({ open: true, message: 'Draft saved successfully', variant: 'alert', alert: { color: 'success' } });
      if (embedded) {
        onSaved?.();
      } else {
        navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
      }
    } catch (e) {
      console.error('Error saving draft:', e);
      openSnackbar({ open: true, message: e?.message || 'Failed to save draft', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const handleSaveAndNext = async () => {
    if (!leaseId || !lease) return;
    const currentLeaseId = lease?.id || lease?.Id || leaseId;
    setSaving(true);
    try {
      const updatePayload = buildUpdatePayload(currentLeaseId);
      const result = await dispatch(updateLease(updatePayload));
      if (result?.success) await dispatch(updateLeaseAgreement(currentLeaseId, { isPetsSmokingOtherComplete: true }));
      if (result?.success) {
        await propertiesRefetch();
        openSnackbar({ open: true, message: 'Saved successfully', variant: 'alert', alert: { color: 'success' } });
        if (embedded) {
          onSaved?.();
        } else {
          navigate(`/landlord/leases/build-lease-agreement?leaseId=${leaseId}&propertyId=${propertyId}${unitId ? `&unitId=${unitId}` : ''}`);
        }
      } else {
        openSnackbar({ open: true, message: result?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (e) {
      console.error('Error saving:', e);
      openSnackbar({ open: true, message: e?.response?.data?.message || e?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSaving(false);
    }
  };

  const buildUpdatePayload = (currentLeaseId) => ({
    id: currentLeaseId,
    propertyId: property?.id || propertyId,
    unitId: unit?.id || unitId,
    name: lease?.name || lease?.Name,
    startDate: lease?.startDate || lease?.StartDate,
    endDate: lease?.endDate || lease?.EndDate,
    rentAmount: lease?.rentAmount ?? lease?.RentAmount,
    depositAmount: lease?.depositAmount ?? lease?.DepositAmount,
    leaseLength: lease?.leaseLength ?? lease?.LeaseLength,
    rentFrequency: (lease?.rentFrequency ?? lease?.RentFrequency) || 'Monthly',
    rentDueDay: lease?.rentDueDay ?? lease?.RentDueDay,
    isPetsSmokingOtherComplete: true,
    petsAllowed,
    pets: petsAllowed
      ? pets.map((p) => ({
          id: p.id,
          type: p.type?.trim() || '',
          breed: p.breed?.trim() || null,
          weight: p.weight !== '' && !Number.isNaN(Number(p.weight)) ? Number(p.weight) : null,
          age: p.age !== '' && !Number.isNaN(Number(p.age)) ? Number(p.age) : null
        }))
      : [],
    smokingAllowed,
    parking: {
      includeParkingRules,
      parkingTypes: includeParkingRules ? JSON.stringify(parkingTypes) : null,
      customRules: includeParkingRules ? parkingCustomRules : null
    },
    isLeaseSpecificsComplete: lease?.isLeaseSpecificsComplete ?? lease?.IsLeaseSpecificsComplete,
    isRentDepositFeesComplete: lease?.isRentDepositFeesComplete ?? lease?.IsRentDepositFeesComplete,
    isPeopleOnLeaseComplete: lease?.isPeopleOnLeaseComplete ?? lease?.IsPeopleOnLeaseComplete,
    isUtilitiesMaintenanceKeysComplete: lease?.isUtilitiesMaintenanceKeysComplete ?? lease?.IsUtilitiesMaintenanceKeysComplete,
    isProvisionsAttachmentsComplete: lease?.isProvisionsAttachmentsComplete ?? lease?.IsProvisionsAttachmentsComplete
  });

  const toggleParkingType = (id) => {
    setParkingTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePetsAllowedChange = (value) => {
    const yes = value === 'yes';
    setPetsAllowed(yes);
    if (yes && pets.length === 0) {
      setPets([{ type: '', breed: '', weight: '', age: '' }]);
    }
  };

  const updatePet = (index, field, value) => {
    setPets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addPet = () => {
    setPets((prev) => [...prev, { type: '', breed: '', weight: '', age: '' }]);
  };

  const removePet = (index) => {
    setPets((prev) => prev.filter((_, i) => i !== index));
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
        {!embedded && <BuildLeaseAgreementHeader onBack={handleBack} onSaveDraft={handleSaveDraft} showTitle={false} />}
        <MainCard>
          <Stack spacing={4}>
            {!embedded && (
              <>
                <Box>
                  <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                    Pets, Smoking, & Other
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Specify pets, smoking policy, and parking rules.
                  </Typography>
                </Box>
                <Divider />
              </>
            )}

            {/* Pets */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <SafetyOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                <Typography variant="h5" fontWeight={600}>Pets</Typography>
              </Stack>
              <FormControl component="fieldset">
                <FormLabel sx={{ mb: 1 }}>Will there be pet(s) on this lease?</FormLabel>
                <RadioGroup row value={petsAllowed ? 'yes' : 'no'} onChange={(e) => handlePetsAllowedChange(e.target.value)}>
                  <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                </RadioGroup>
              </FormControl>
              {petsAllowed && (
                <Box sx={{ mt: 3, ml: 2 }}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>Pet details</Typography>
                  {pets.map((pet, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 2,
                        mb: 2,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        position: 'relative'
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">Pet {index + 1}</Typography>
                        <IconButton
                          size="small"
                          onClick={() => removePet(index)}
                          disabled={pets.length <= 1}
                          aria-label="Remove pet"
                          sx={{ color: 'text.secondary' }}
                        >
                          <DeleteOutlined style={{ fontSize: 18 }} />
                        </IconButton>
                      </Stack>
                      <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" useFlexGap>
                        <Stack spacing={0.5} sx={{ minWidth: { sm: 140 } }}>
                          <Typography variant="body2" fontWeight={500} color="text.primary">Type</Typography>
                          <TextField
                            placeholder="e.g. Dog, Cat"
                            value={pet.type}
                            onChange={(e) => updatePet(index, 'type', e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </Stack>
                        <Stack spacing={0.5} sx={{ minWidth: { sm: 160 } }}>
                          <Typography variant="body2" fontWeight={500} color="text.primary">Breed</Typography>
                          <TextField
                            placeholder="e.g. Golden Retriever"
                            value={pet.breed}
                            onChange={(e) => updatePet(index, 'breed', e.target.value)}
                            size="small"
                            fullWidth
                          />
                        </Stack>
                        <Stack spacing={0.5} sx={{ minWidth: { sm: 110 } }}>
                          <Typography variant="body2" fontWeight={500} color="text.primary">Weight (lbs)</Typography>
                          <TextField
                            placeholder="e.g. 25"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            value={pet.weight}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9]/g, '');
                              updatePet(index, 'weight', v);
                            }}
                            size="small"
                            fullWidth
                          />
                        </Stack>
                        <Stack spacing={0.5} sx={{ minWidth: { sm: 90 } }}>
                          <Typography variant="body2" fontWeight={500} color="text.primary">Age</Typography>
                          <TextField
                            placeholder="e.g. 3"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            value={pet.age}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9]/g, '');
                              updatePet(index, 'age', v);
                            }}
                            size="small"
                            fullWidth
                          />
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                  <Button
                    startIcon={<PlusOutlined />}
                    onClick={addPet}
                    variant="outlined"
                    size="small"
                    sx={{ textTransform: 'none' }}
                  >
                    Add another pet
                  </Button>
                </Box>
              )}
            </Box>
            <Divider />

            {/* Smoking */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <EnvironmentOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                <Typography variant="h5" fontWeight={600}>Smoking</Typography>
              </Stack>
              <FormControl component="fieldset">
                <FormLabel sx={{ mb: 1 }}>Do you allow smoking at this property?</FormLabel>
                <RadioGroup row value={smokingAllowed} onChange={(e) => setSmokingAllowed(e.target.value)}>
                  <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                  <FormControlLabel value="outsideOnly" control={<Radio />} label="Outside Only" />
                </RadioGroup>
              </FormControl>
            </Box>
            <Divider />

            {/* Parking */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <CarOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                <Typography variant="h5" fontWeight={600}>Parking</Typography>
              </Stack>
              <FormControl component="fieldset">
                <FormLabel sx={{ mb: 1 }}>Do you want to include parking rules?</FormLabel>
                <RadioGroup row value={includeParkingRules ? 'yes' : 'no'} onChange={(e) => setIncludeParkingRules(e.target.value === 'yes')}>
                  <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                </RadioGroup>
              </FormControl>
              {includeParkingRules && (
                <Box sx={{ mt: 3, ml: 2 }}>
                  <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                    <FormLabel sx={{ mb: 1 }}>What type of parking is available?</FormLabel>
                    <FormGroup row>
                      {PARKING_TYPES.map((t) => (
                        <FormControlLabel
                          key={t.id}
                          control={<Checkbox checked={parkingTypes.includes(t.id)} onChange={() => toggleParkingType(t.id)} />}
                          label={t.label}
                        />
                      ))}
                    </FormGroup>
                  </FormControl>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, fontSize: '1.125rem' }}>Customize parking rules</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.9375rem' }}>
                      You can edit or replace the default parking policy below. Consider including parking fees, rules, vehicle descriptions or a towing policy.
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={8}
                      value={parkingCustomRules}
                      onChange={(e) => setParkingCustomRules(e.target.value)}
                      placeholder="Enter parking rules..."
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: alpha(theme.palette.primary.main, 0.02),
                          
                        },
                        '& .MuiOutlinedInput-input': {
                          fontSize: '0.9375rem'
                        }
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
              <Button variant="outlined" onClick={handleSaveDraft} disabled={saving} sx={{ textTransform: 'none' }}>
                Save
              </Button>
              <Button variant="contained" onClick={handleSaveAndNext} disabled={saving} sx={{ textTransform: 'none' }}>
                {saving ? <CircularProgress size={24} /> : 'Save & Next'}
              </Button>
            </Stack>
          </Stack>
        </MainCard>
      </Container>
    </Box>
  );
}
