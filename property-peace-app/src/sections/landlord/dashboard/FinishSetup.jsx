import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
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
  CheckOutlined,
  CloseOutlined,
  CrownOutlined,
  MessageOutlined,
  MobileOutlined,
  RocketOutlined,
  RightOutlined,
  SafetyOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import { organizationSmsNumberAPI } from 'api/organizationSmsNumber';

const SETUP_GREEN = '#16a34a';
const SETUP_NAVY = '#061e35';
const SETUP_ACCENT_GREEN = '#22c55e';

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

function SmsNumberSetupPanel({ step, onBack }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const status = step?.smsNumberStatus || {};
  const hasPremiumAccess = Boolean(status.hasPremiumAccess);
  const hasActiveNumber = Boolean(status.hasActiveNumber);
  const [state, setState] = useState(null);
  const [areaCodes, setAreaCodes] = useState([]);
  const [areaCode, setAreaCode] = useState('');
  const [numbers, setNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [localStatus, setLocalStatus] = useState(status);

  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  const visibleNumbers = selectedNumber ? numbers.filter((number) => number.phoneNumber === selectedNumber.phoneNumber) : numbers;

  const toggleSelectedNumber = (number) => {
    setSelectedNumber((current) => (current?.phoneNumber === number.phoneNumber ? null : number));
  };

  useEffect(() => {
    if (!state?.code || !hasPremiumAccess) return;

    let cancelled = false;
    setLoadingCodes(true);
    setAreaCodes([]);
    setAreaCode('');
    organizationSmsNumberAPI
      .getAreaCodes(state.code)
      .then((response) => {
        if (!cancelled) setAreaCodes(response?.data || []);
      })
      .catch(() => {
        if (!cancelled) setAreaCodes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCodes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state?.code, hasPremiumAccess]);

  const searchNumbers = async () => {
    setError('');
    setSelectedNumber(null);
    setNumbers([]);
    setSearching(true);
    try {
      const response = await organizationSmsNumberAPI.searchAvailable({ state: state.code, areaCode });
      setNumbers(response?.data || []);
      if (!response?.data?.length) setError('No SMS-capable numbers were found for that area code. Try another area code.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to search Twilio numbers right now.');
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
      setLocalStatus(response?.data || {});
      setNumbers([]);
      setSelectedNumber(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to purchase this number. It may no longer be available.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Box sx={{ p: 2.5 }}>
      <Button onClick={onBack} startIcon={<RightOutlined style={{ transform: 'rotate(180deg)' }} />} sx={{ textTransform: 'none', mb: 2 }}>
        Back to setup tasks
      </Button>

      <Stack spacing={2.25}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Set up your dedicated SMS number</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Give tenants one professional number to text while keeping every conversation organized inside Property Peace.
          </Typography>
        </Box>

        {!hasPremiumAccess && (
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.18), bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Chip icon={<CrownOutlined />} label="Premium feature" color="primary" sx={{ alignSelf: 'flex-start', fontWeight: 800 }} />
                <Typography variant="h6" fontWeight={800}>Included with Premium</Typography>
                <Typography variant="body2" color="text.secondary">
                  Upgrade to Premium to choose a Property Peace texting number for tenant communication. Tenants text normally, and replies stay grouped in your app inbox.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/landlord/settings?tab=subscription')} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                  Upgrade to Premium
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {hasPremiumAccess && (hasActiveNumber || localStatus?.hasActiveNumber) && (
          <Alert severity="success" icon={<CheckCircleFilled />}>
            Your dedicated number is active: <strong>{formatPhone(localStatus?.phoneNumber || status.phoneNumber)}</strong>
          </Alert>
        )}

        {hasPremiumAccess && !(hasActiveNumber || localStatus?.hasActiveNumber) && (
          <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>Choose your number</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pick a state, select an area code, then choose from live Twilio inventory. Your Premium plan includes one dedicated number.
                  </Typography>
                </Box>
                {error && <Alert severity="error">{error}</Alert>}
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
                  onChange={(event) => setAreaCode(event.target.value)}
                >
                  {areaCodes.map((item) => (
                    <MenuItem key={item.areaCode} value={item.areaCode}>{item.areaCode}</MenuItem>
                  ))}
                </TextField>
                <Button variant="contained" startIcon={<SearchOutlined />} disabled={!state || !areaCode || searching} onClick={searchNumbers} sx={{ textTransform: 'none' }}>
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
                    <Button variant="contained" disabled={!selectedNumber || purchasing} onClick={purchaseNumber} sx={{ textTransform: 'none' }}>
                      {purchasing ? 'Buying number...' : `Choose ${selectedNumber ? formatPhone(selectedNumber.phoneNumber) : 'number'}`}
                    </Button>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Why use a dedicated number?</Typography>
          <Stack spacing={1.25}>
            {[
              ['Keep tenant messages separate', 'Use a Property Peace number instead of mixing rental texts with your personal messages.', <MobileOutlined />],
              ['Stay organized', 'Tenant replies flow into your app inbox, grouped by tenant and property.', <MessageOutlined />],
              ['Create a cleaner record', 'Keep rent, lease, maintenance, and general conversations searchable in one place.', <SafetyOutlined />],
              ['Look more professional', 'Give tenants a dedicated rental communication number instead of your personal cell.', <CrownOutlined />]
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
        </Box>
      </Stack>
    </Box>
  );
}

export default function FinishSetup({ open, onOpen, onClose, steps, compact = false, showButton = true }) {
  const theme = useTheme();
  const [selectedStep, setSelectedStep] = useState(null);
  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const groupedSteps = steps.reduce((groups, step) => {
    const groupName = step.group || 'Setup';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(step);
    return groups;
  }, {});

  const closeDrawer = () => {
    setSelectedStep(null);
    onClose();
  };

  const handleStepClick = (step) => {
    if (step.kind === 'sms-number') {
      setSelectedStep(step);
      return;
    }
    step.onClick?.();
  };

  return (
    <>
      {showButton && (
        <Button
          variant="contained"
          startIcon={<RocketOutlined />}
          onClick={onOpen}
          sx={() => ({
            textTransform: 'none', borderRadius: 1.5, px: compact ? 2.25 : { xs: 1.5, sm: 2 }, py: compact ? 0.55 : 0.65,
            minHeight: compact ? 36 : 38, minWidth: compact ? 190 : 'auto', color: '#fff', fontWeight: 800,
            fontSize: compact ? '0.875rem' : 'inherit', whiteSpace: 'nowrap', border: 0,
            background: SETUP_NAVY,
            boxShadow: 'none', transformOrigin: 'center', animation: 'finishSetupPulse 2.8s ease-in-out infinite',
            '@keyframes finishSetupPulse': {
              '0%, 100%': { transform: 'scale(1)', boxShadow: `0 0 0 0 ${alpha(SETUP_NAVY, 0)}` },
              '45%': { transform: 'scale(1.025)', boxShadow: `0 0 0 7px ${alpha(SETUP_NAVY, 0.16)}` }
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            '&:hover': { background: '#0a2b4a', boxShadow: 'none', animation: 'none' }
          })}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, fontSize: compact ? '0.8rem' : 'inherit' }}>Finish Setup</Box>
            <Chip label={`${completedCount}/${totalCount}`} size="small" sx={{ height: compact ? 22 : 24, borderRadius: 999, bgcolor: alpha('#052e16', 0.28), color: '#fff', fontWeight: 800, '& .MuiChip-label': { px: 1 } }} />
          </Stack>
        </Button>
      )}

      <Drawer anchor="right" open={open} onClose={closeDrawer} PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, maxWidth: '100%', bgcolor: 'background.paper' } }}>
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {!selectedStep && (
            <Box sx={(t) => ({ p: 2.5, color: t.palette.common.white, bgcolor: SETUP_NAVY, '& .MuiTypography-root': { color: t.palette.common.white } })}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <RocketOutlined style={{ fontSize: 22, color: SETUP_ACCENT_GREEN }} />
                    <Typography variant="h5" fontWeight={800} sx={{ color: 'common.white' }}>Finish setup</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: alpha('#fff', 0.86), maxWidth: 340 }}>
                    Complete the essentials to get Property Peace ready for rent collection, tenant communication, and day-to-day operations.
                  </Typography>
                </Box>
                <IconButton onClick={closeDrawer} sx={{ color: 'common.white', mt: -0.5 }} aria-label="Close setup drawer"><CloseOutlined /></IconButton>
              </Stack>

              <Box sx={{ mt: 2.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                  <Typography variant="caption" sx={{ color: SETUP_ACCENT_GREEN, fontWeight: 800 }}>{completedCount} of {totalCount} complete</Typography>
                  <Typography variant="caption" sx={{ color: SETUP_ACCENT_GREEN, fontWeight: 800 }}>{progress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 999, bgcolor: alpha(SETUP_ACCENT_GREEN, 0.22), '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: SETUP_ACCENT_GREEN } }} />
              </Box>
            </Box>
          )}

          <Box sx={{ flex: 1, overflow: 'auto', px: selectedStep ? 0 : 2, py: selectedStep ? 0 : 2 }}>
            {selectedStep?.kind === 'sms-number' ? (
              <SmsNumberSetupPanel step={selectedStep} onBack={() => setSelectedStep(null)} />
            ) : (
              Object.entries(groupedSteps).map(([groupName, groupSteps], groupIndex) => (
                <Box key={groupName} sx={{ mb: 2.25 }}>
                  {groupIndex > 0 && <Divider sx={{ mb: 2 }} />}
                  <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 0.6 }}>{groupName}</Typography>
                  <List disablePadding sx={{ mt: 0.75 }}>
                    {groupSteps.map((step) => (
                      <ListItemButton
                        key={step.id}
                        onClick={() => handleStepClick(step)}
                        sx={{
                          px: 1.25, py: 1.25, mb: 0.75, borderRadius: 2,
                          border: (t) => `1px solid ${step.completed ? alpha(SETUP_GREEN, t.palette.mode === 'dark' ? 0.32 : 0.18) : alpha(t.palette.divider, 0.78)}`,
                          bgcolor: (t) => step.completed ? alpha(SETUP_GREEN, t.palette.mode === 'dark' ? 0.12 : 0.07) : 'background.paper',
                          '&:hover': { bgcolor: (t) => step.completed ? alpha(SETUP_GREEN, t.palette.mode === 'dark' ? 0.16 : 0.1) : alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.1 : 0.05) }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {step.completed ? <CheckCircleFilled style={{ color: SETUP_GREEN, fontSize: 21 }} /> : <Box sx={(t) => ({ width: 21, height: 21, borderRadius: '50%', border: `2px solid ${alpha(t.palette.text.secondary, 0.32)}` })} />}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="body2" fontWeight={800} color="text.primary">{step.title}</Typography>
                              {step.badge && <Chip label={step.badge} size="small" color={step.badge === 'Premium' ? 'primary' : step.badge === 'Active' ? 'success' : 'default'} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                              {step.required && !step.completed && <Chip label="Required" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                            </Stack>
                          }
                          secondary={<Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>{step.description}</Typography>}
                        />
                        {step.completed ? <CheckOutlined style={{ color: SETUP_GREEN, fontSize: 16 }} /> : <RightOutlined style={{ color: theme.palette.text.secondary, fontSize: 14 }} />}
                      </ListItemButton>
                    ))}
                  </List>
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

SmsNumberSetupPanel.propTypes = {
  step: PropTypes.object.isRequired,
  onBack: PropTypes.func.isRequired
};

FinishSetup.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  compact: PropTypes.bool,
  showButton: PropTypes.bool,
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      group: PropTypes.string,
      title: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      completed: PropTypes.bool.isRequired,
      required: PropTypes.bool,
      badge: PropTypes.string,
      kind: PropTypes.string,
      onClick: PropTypes.func
    })
  ).isRequired
};
