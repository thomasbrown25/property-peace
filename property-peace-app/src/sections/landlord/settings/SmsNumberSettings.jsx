import { useEffect, useState } from 'react';

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import {
  CheckCircleFilled,
  CrownOutlined,
  InfoCircleOutlined,
  MobileOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { organizationSmsNumberAPI } from 'api/organizationSmsNumber';
import useEntitlement from 'hooks/useEntitlement';
import { DEDICATED_SMS_NUMBER_SETUP_FEATURE } from 'utils/entitlements';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

const US_STATES = [
  { code: 'AL', label: 'Alabama' }, { code: 'AK', label: 'Alaska' }, { code: 'AZ', label: 'Arizona' }, { code: 'AR', label: 'Arkansas' },
  { code: 'CA', label: 'California' }, { code: 'CO', label: 'Colorado' }, { code: 'CT', label: 'Connecticut' }, { code: 'DE', label: 'Delaware' },
  { code: 'DC', label: 'District of Columbia' }, { code: 'FL', label: 'Florida' }, { code: 'GA', label: 'Georgia' }, { code: 'HI', label: 'Hawaii' },
  { code: 'ID', label: 'Idaho' }, { code: 'IL', label: 'Illinois' }, { code: 'IN', label: 'Indiana' }, { code: 'IA', label: 'Iowa' },
  { code: 'KS', label: 'Kansas' }, { code: 'KY', label: 'Kentucky' }, { code: 'LA', label: 'Louisiana' }, { code: 'ME', label: 'Maine' },
  { code: 'MD', label: 'Maryland' }, { code: 'MA', label: 'Massachusetts' }, { code: 'MI', label: 'Michigan' }, { code: 'MN', label: 'Minnesota' },
  { code: 'MS', label: 'Mississippi' }, { code: 'MO', label: 'Missouri' }, { code: 'MT', label: 'Montana' }, { code: 'NE', label: 'Nebraska' },
  { code: 'NV', label: 'Nevada' }, { code: 'NH', label: 'New Hampshire' }, { code: 'NJ', label: 'New Jersey' }, { code: 'NM', label: 'New Mexico' },
  { code: 'NY', label: 'New York' }, { code: 'NC', label: 'North Carolina' }, { code: 'ND', label: 'North Dakota' }, { code: 'OH', label: 'Ohio' },
  { code: 'OK', label: 'Oklahoma' }, { code: 'OR', label: 'Oregon' }, { code: 'PA', label: 'Pennsylvania' }, { code: 'RI', label: 'Rhode Island' },
  { code: 'SC', label: 'South Carolina' }, { code: 'SD', label: 'South Dakota' }, { code: 'TN', label: 'Tennessee' }, { code: 'TX', label: 'Texas' },
  { code: 'UT', label: 'Utah' }, { code: 'VT', label: 'Vermont' }, { code: 'VA', label: 'Virginia' }, { code: 'WA', label: 'Washington' },
  { code: 'WV', label: 'West Virginia' }, { code: 'WI', label: 'Wisconsin' }, { code: 'WY', label: 'Wyoming' }
];

const formatPhone = (phone) => {
  const digits = (phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : phone;
};

const getApiErrorMessage = (err, fallback) =>
  err?.response?.data?.message ||
  err?.response?.data?.Message ||
  err?.message ||
  err?.Message ||
  fallback;

export default function SmsNumberSettings() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { presentation: setupEntitlement } = useEntitlement(DEDICATED_SMS_NUMBER_SETUP_FEATURE);
  const { presentation: smsReadiness } = useFeatureReadiness(FEATURE_KEYS.dedicatedSmsNumber);

  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [state, setState] = useState(null);
  const [areaCodes, setAreaCodes] = useState([]);
  const [areaCode, setAreaCode] = useState('');
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');

  // Plan eligibility comes only from the centralized setup entitlement. Provider readiness is
  // presented independently and only controls operational provisioning actions.
  const hasPremiumAccess = setupEntitlement.canInvoke && status?.hasPremiumAccess === true;
  const hasActiveNumber = Boolean(status?.hasActiveNumber);
  const visibleNumbers = selectedNumber ? numbers.filter((number) => number.phoneNumber === selectedNumber.phoneNumber) : numbers;

  const loadStatus = async () => {
    setLoadingStatus(true);
    setError('');
    try {
      const response = await organizationSmsNumberAPI.getStatus();
      setStatus(response?.data || null);
    } catch (err) {
      setStatus(null);
      setError(getApiErrorMessage(err, 'Unable to load SMS number settings right now.'));
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (setupEntitlement.canInvoke) loadStatus();
    else setLoadingStatus(false);
  }, [setupEntitlement.canInvoke]);

  useEffect(() => {
    if (!state?.code || !hasPremiumAccess || !smsReadiness.canInvoke || hasActiveNumber) return undefined;

    let cancelled = false;
    setLoadingCodes(true);
    setAreaCodes([]);
    setAreaCode('');
    setNumbers([]);
    setSelectedNumber(null);
    organizationSmsNumberAPI
      .getAreaCodes(state.code)
      .then((response) => {
        if (!cancelled) setAreaCodes(response?.data || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setAreaCodes([]);
          setError(getApiErrorMessage(err, 'Unable to load area codes for that state.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCodes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state?.code, hasPremiumAccess, smsReadiness.canInvoke, hasActiveNumber]);

  const searchNumbers = async () => {
    setError('');
    setSelectedNumber(null);
    setNumbers([]);
    setSearching(true);
    try {
      const response = await organizationSmsNumberAPI.searchAvailable({ state: state.code, areaCode });
      const foundNumbers = response?.data || [];
      setNumbers(foundNumbers);
      if (!foundNumbers.length) setError('No SMS-capable numbers were found for that area code. Try another area code.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to search available SMS numbers right now.'));
    } finally {
      setSearching(false);
    }
  };

  const purchaseNumber = async () => {
    if (!selectedNumber) return;
    setError('');
    setPurchasing(true);
    try {
      const response = await organizationSmsNumberAPI.purchase({ phoneNumber: selectedNumber.phoneNumber, state: state.code, areaCode });
      setStatus(response?.data || null);
      setNumbers([]);
      setSelectedNumber(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to purchase this SMS number. It may no longer be available.'));
    } finally {
      setPurchasing(false);
    }
  };

  const toggleSelectedNumber = (number) => {
    setSelectedNumber((current) => (current?.phoneNumber === number.phoneNumber ? null : number));
  };

  return (
    <Stack spacing={2.5}>
      <FeatureReadinessNotice presentation={smsReadiness} featureName="Dedicated SMS number" />
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
              <Box>
                <Typography variant="h5" fontWeight={800}>SMS Number Settings</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Manage the dedicated number used for supported organization SMS sending.
                </Typography>
              </Box>
              <Button startIcon={<ReloadOutlined />} onClick={loadStatus} disabled={loadingStatus} sx={{ textTransform: 'none' }}>
                {loadingStatus ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            {hasActiveNumber ? (
              <Alert severity="success" icon={<CheckCircleFilled />}>
                Your dedicated SMS number is active: <strong>{formatPhone(status?.phoneNumber)}</strong>
              </Alert>
            ) : (
              <Alert severity={hasPremiumAccess ? 'info' : 'warning'} icon={hasPremiumAccess ? <InfoCircleOutlined /> : <CrownOutlined />}>
                {hasPremiumAccess
                  ? 'One dedicated organization SMS number is included. Choose and activate it before sending tenant text messages.'
                  : 'One dedicated organization SMS number is included with eligible Premium and Lifetime plans. Upgrade if needed, then activate and configure the number before sending SMS.'}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      {!hasPremiumAccess && (
        <Card elevation={0} sx={{ borderRadius: 2.5, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2), bgcolor: alpha(theme.palette.primary.main, 0.055) }}>
          <CardContent>
            <Stack spacing={1.5} alignItems="flex-start">
              <Chip icon={<CrownOutlined />} label="Premium eligibility required" color="primary" sx={{ fontWeight: 800 }} />
              <Typography variant="h6" fontWeight={800}>One dedicated SMS number is included</Typography>
              <Typography variant="body2" color="text.secondary">
                Eligible Premium and Lifetime organizations include one dedicated SMS number at no additional add-on charge. Activation and configuration are required before sending SMS.
              </Typography>
              <Button variant="contained" onClick={() => navigate('/landlord/settings?tab=subscription')} sx={{ textTransform: 'none' }}>
                Upgrade to Premium
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {hasPremiumAccess && hasActiveNumber && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6" fontWeight={800}>Current number</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight={900}>{formatPhone(status?.phoneNumber)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {status?.state || 'US'} {status?.areaCode ? `• Area code ${status.areaCode}` : ''} {status?.status ? `• ${status.status}` : ''}
                  </Typography>
                </Box>
                <Chip label="Active" color="success" variant="outlined" sx={{ fontWeight: 800 }} />
              </Stack>
              <Divider />
              <Alert severity="info">
                V1 supports one active SMS number per organization. Number release and replacement remain support/admin operations.
              </Alert>
            </Stack>
          </CardContent>
        </Card>
      )}

      {hasPremiumAccess && smsReadiness.canInvoke && !hasActiveNumber && (
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" fontWeight={800}>Choose your dedicated number</Typography>
                <Typography variant="body2" color="text.secondary">
                  Pick a state and area code, then select one SMS-capable number from live Twilio inventory.
                </Typography>
              </Box>

              <Autocomplete
                value={state}
                options={US_STATES}
                getOptionLabel={(option) => `${option.label} (${option.code})`}
                onChange={(_, value) => setState(value)}
                renderInput={(params) => <TextField {...params} label="State" placeholder="Select state" />}
              />

              <TextField
                select
                label="Area code"
                value={areaCode}
                disabled={!state || loadingCodes}
                helperText={state ? 'Choose an area code to search Twilio inventory.' : 'Select a state first.'}
                onChange={(event) => {
                  setAreaCode(event.target.value);
                  setNumbers([]);
                  setSelectedNumber(null);
                }}
              >
                {areaCodes.map((item) => (
                  <MenuItem key={item.areaCode} value={item.areaCode}>{item.areaCode}</MenuItem>
                ))}
              </TextField>

              <Button variant="contained" startIcon={<SearchOutlined />} disabled={!state || !areaCode || searching} onClick={searchNumbers} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                {searching ? 'Searching...' : 'Search numbers'}
              </Button>

              {numbers.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight={800}>{selectedNumber ? 'Selected number' : 'Available numbers'}</Typography>
                  {visibleNumbers.map((number) => {
                    const selected = selectedNumber?.phoneNumber === number.phoneNumber;
                    return (
                      <ListItemButton
                        key={number.phoneNumber}
                        selected={selected}
                        onClick={() => toggleSelectedNumber(number)}
                        sx={{ border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 2 }}
                      >
                        <ListItemIcon sx={{ minWidth: 34 }}><MobileOutlined /></ListItemIcon>
                        <ListItemText primary={formatPhone(number.phoneNumber)} secondary={[number.locality, number.region].filter(Boolean).join(', ')} />
                        <Chip label="SMS" size="small" color="success" variant="outlined" />
                      </ListItemButton>
                    );
                  })}
                  <Button variant="contained" disabled={!selectedNumber || purchasing} onClick={purchaseNumber} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                    {purchasing ? 'Buying number...' : `Choose ${selectedNumber ? formatPhone(selectedNumber.phoneNumber) : 'number'}`}
                  </Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" fontWeight={800}>What this controls</Typography>
            {[
              ['Organization SMS number', 'This is the configured number used for supported organization SMS sending.', <MobileOutlined />],
              ['Organization ownership', 'The number belongs to the organization, not one individual landlord user.', <SafetyOutlined />]
            ].map(([title, body, icon]) => (
              <Stack key={title} direction="row" spacing={1.25} alignItems="flex-start" sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.035) }}>
                <Box sx={{ color: 'primary.main', mt: 0.2 }}>{icon}</Box>
                <Box>
                  <Typography variant="body2" fontWeight={800}>{title}</Typography>
                  <Typography variant="caption" color="text.secondary">{body}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
