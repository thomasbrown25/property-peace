import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  Select,
  Stack,
  TextField,
  Typography,
  alpha
} from '@mui/material';
import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  HomeOutlined,
  LockOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';

import {
  buildConnectOnboardingContext,
  createConnectOnboardingDraft,
  validateConnectOnboardingContext,
  validateConnectOnboardingStep
} from 'utils/connectOnboarding';

const EIN_PATTERN = /^\d{2}-?\d{7}$/;

const makeInitialDraft = ({ user, initialDraft }) => ({
  ...createConnectOnboardingDraft({ user, savedPreparation: initialDraft }),
  operatingType: initialDraft?.operatingType || ''
});

const authorityOptions = [
  { value: 'owner', label: 'Property owner' },
  { value: 'property-manager', label: 'Property manager' },
  { value: 'authorized-representative', label: 'Authorized representative' }
];

const getPropertyId = (property) => String(property?.id ?? property?.Id ?? '');
const getPropertyName = (property) => property?.name || property?.Name || property?.streetAddress || property?.StreetAddress || 'Unnamed property';
const getPropertyAddress = (property) => property?.streetAddress || property?.StreetAddress || '';

export default function ConnectOnboardingWizard({
  open,
  onClose,
  onContinue,
  properties = [],
  propertiesLoading = false,
  propertiesError = false,
  onRetryProperties,
  user = null,
  initialDraft = null,
  preparationLoading = false,
  loading = false
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [draft, setDraft] = useState(() => makeInitialDraft({ user, initialDraft }));
  const [ein, setEin] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setActiveStep(0);
    setDraft(makeInitialDraft({ user, initialDraft }));
    setEin('');
    setErrors({});
  }, [open, user, initialDraft]);

  const selectedProperties = useMemo(() => {
    const selected = new Set(draft.propertyIds);
    return properties.filter((property) => selected.has(getPropertyId(property)));
  }, [draft.propertyIds, properties]);

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleProperty = (propertyId) => {
    const selected = new Set(draft.propertyIds);
    if (selected.has(propertyId)) selected.delete(propertyId);
    else selected.add(propertyId);
    setDraft((current) => ({ ...current, propertyIds: [...selected], authorityAttested: false }));
    setErrors((current) => ({ ...current, propertyIds: undefined, authorityAttested: undefined }));
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!draft.operatingType) {
        setErrors({ operatingType: 'Select an account type.' });
        return;
      }
      setActiveStep(1);
      return;
    }

    if (activeStep === 2 && (propertiesLoading || propertiesError)) return;
    const nextErrors = activeStep === 1 ? validateConnectOnboardingStep(0, draft) : validateConnectOnboardingStep(1, draft);
    if (activeStep === 1 && draft.operatingType === 'business' && !EIN_PATTERN.test(ein)) {
      nextErrors.ein = 'Enter a valid 9-digit EIN.';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setActiveStep((current) => Math.min(current + 1, 3));
  };

  const handleContinue = () => {
    const context = buildConnectOnboardingContext(draft);
    const nextErrors = validateConnectOnboardingContext(context, properties.map(getPropertyId));
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setActiveStep(nextErrors.operatingType ? 0 : nextErrors.displayName ? 1 : 2);
      return;
    }
    onContinue({ ...context, ein: draft.operatingType === 'business' ? ein.replace(/\D/g, '') : null });
  };

  const title = activeStep === 0
    ? 'New bank account'
    : activeStep === 1
      ? draft.operatingType === 'business' ? 'Business details' : 'Individual details'
      : activeStep === 2
        ? 'Property authority'
        : 'Stripe verification';

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
    >
      <DialogTitle sx={{ px: { xs: 2.5, sm: 3 }, py: 2.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h5" fontWeight={750}>{title}</Typography>
          <IconButton aria-label="Close setup" onClick={onClose} disabled={loading} size="small">
            <CloseOutlined />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {preparationLoading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Loading your saved payout setup…
          </Alert>
        )}
        {!preparationLoading && initialDraft?.updatedAt && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Your saved payout setup has been restored. Review it before continuing.
          </Alert>
        )}
        {activeStep === 0 && (
          <Stack spacing={2.5}>
            <Typography variant="body1" fontWeight={650}>
              Select the account type and provide the information for identity verification to set up online payments.
            </Typography>

            <Stack spacing={1.5} role="radiogroup" aria-label="Bank account type">
              {[
                { value: 'individual', label: 'Individual', description: 'Individuals and sole proprietorships' },
                { value: 'business', label: 'Business', description: 'Companies, LLCs, and partnerships' }
              ].map((option) => {
                const selected = draft.operatingType === option.value;
                return (
                  <Paper
                    key={option.value}
                    component="button"
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    variant="outlined"
                    onClick={() => updateDraft('operatingType', option.value)}
                    sx={{
                      width: '100%',
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      textAlign: 'left',
                      color: 'text.primary',
                      bgcolor: selected ? (theme) => alpha(theme.palette.success.main, 0.06) : 'background.paper',
                      borderColor: selected ? 'success.main' : 'divider',
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'success.main' }
                    }}
                  >
                    <Radio checked={selected} color="success" tabIndex={-1} />
                    <Box>
                      <Typography fontWeight={750}>{option.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{option.description}</Typography>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
            {errors.operatingType && <FormHelperText error>{errors.operatingType}</FormHelperText>}

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', color: 'warning.main' }}>
              <BulbOutlined style={{ fontSize: 20, marginTop: 1 }} />
              <Box sx={{ flex: 1 }}>
                <Divider sx={{ borderColor: 'warning.light', mb: 1.25 }} />
                <Typography variant="body2" color="text.secondary">
                  We use Stripe to make sure you get paid on time and to keep your personal bank details secure. Click Next to continue your secure payment setup.
                </Typography>
              </Box>
            </Box>
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2.5}>
            <Typography variant="body1">
              {draft.operatingType === 'business' ? 'Provide the details about your company.' : 'Provide the name tenants and your team recognize.'}
            </Typography>
            {draft.operatingType === 'business' ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  required
                  label="Legal Business Name"
                  placeholder="Company"
                  value={draft.displayName}
                  onChange={(event) => updateDraft('displayName', event.target.value)}
                  error={Boolean(errors.displayName)}
                  helperText={errors.displayName}
                  fullWidth
                  autoFocus
                />
                <TextField
                  required
                  label="EIN"
                  placeholder="00-0000000"
                  value={ein}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, '').slice(0, 9);
                    setEin(digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits);
                    setErrors((current) => ({ ...current, ein: undefined }));
                  }}
                  error={Boolean(errors.ein)}
                  helperText={errors.ein}
                  inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
                  fullWidth
                />
              </Stack>
            ) : (
              <TextField
                required
                label="Landlord display name"
                value={draft.displayName}
                onChange={(event) => updateDraft('displayName', event.target.value)}
                error={Boolean(errors.displayName)}
                helperText={errors.displayName || 'Use the name tenants and your team recognize.'}
                fullWidth
                autoFocus
              />
            )}

            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', color: 'warning.main' }}>
              <BulbOutlined style={{ fontSize: 20, marginTop: 1 }} />
              <Box sx={{ flex: 1 }}>
                <Divider sx={{ borderColor: 'warning.light', mb: 1.25 }} />
                <Typography variant="subtitle2" color="text.primary" fontWeight={750}>Please note!</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {draft.operatingType === 'business'
                    ? "The Legal Business Name must match the legal account holder's name on the bank account. The EIN is sent securely to Stripe and is not stored by Property Peace."
                    : 'The account holder name must match the name used during Stripe verification.'}
                </Typography>
              </Box>
            </Box>
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Confirm the property scope
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Select the properties this payout setup is intended to support. This confirmation does not approve payouts.
              </Typography>
            </Box>

            <FormControl error={Boolean(errors.propertyIds)}>
              <FormLabel>Properties using online rent payments</FormLabel>
              <Paper variant="outlined" sx={{ mt: 1, maxHeight: 230, overflow: 'auto' }}>
                {propertiesLoading ? (
                  <Stack spacing={1} alignItems="center" sx={{ p: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      Loading your properties…
                    </Typography>
                  </Stack>
                ) : propertiesError ? (
                  <Stack spacing={1.5} alignItems="flex-start" sx={{ p: 2 }}>
                    <Typography variant="body2" color="error.main">
                      We could not load your properties. Try again before continuing.
                    </Typography>
                    <Button size="small" onClick={onRetryProperties} disabled={!onRetryProperties}>
                      Retry
                    </Button>
                  </Stack>
                ) : properties.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    Add a property before setting up rent payouts.
                  </Typography>
                ) : (
                  properties.map((property, index) => {
                    const propertyId = getPropertyId(property);
                    return (
                      <Box key={propertyId}>
                        {index > 0 && <Divider />}
                        <FormControlLabel
                          sx={{ m: 0, px: 1.5, py: 0.75, width: '100%', alignItems: 'flex-start' }}
                          control={
                            <Checkbox
                              checked={draft.propertyIds.includes(propertyId)}
                              onChange={() => toggleProperty(propertyId)}
                            />
                          }
                          label={
                            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ pt: 0.75 }}>
                              <HomeOutlined style={{ marginTop: 2 }} />
                              <Box>
                                <Typography variant="body2" fontWeight={650}>
                                  {getPropertyName(property)}
                                </Typography>
                                {getPropertyAddress(property) && (
                                  <Typography variant="caption" color="text.secondary">
                                    {getPropertyAddress(property)}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>
                          }
                        />
                      </Box>
                    );
                  })
                )}
              </Paper>
              {errors.propertyIds && <FormHelperText>{errors.propertyIds}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth error={Boolean(errors.authorityRelationship)}>
              <FormLabel sx={{ mb: 1 }}>Your authority relationship</FormLabel>
              <Select
                value={draft.authorityRelationship}
                displayEmpty
                onChange={(event) => {
                  setDraft((current) => ({ ...current, authorityRelationship: event.target.value, authorityAttested: false }));
                  setErrors((current) => ({ ...current, authorityRelationship: undefined, authorityAttested: undefined }));
                }}
              >
                <MenuItem value="" disabled>
                  Choose your relationship
                </MenuItem>
                {authorityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.authorityRelationship && <FormHelperText>{errors.authorityRelationship}</FormHelperText>}
            </FormControl>

            <FormControl error={Boolean(errors.authorityAttested)}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={draft.authorityAttested}
                    onChange={(event) => updateDraft('authorityAttested', event.target.checked)}
                  />
                }
                label={`I confirm I am authorized to manage rent collection for the selected ${draft.propertyIds.length === 1 ? 'property' : 'properties'}.`}
              />
              {errors.authorityAttested && <FormHelperText>{errors.authorityAttested}</FormHelperText>}
            </FormControl>
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  color: 'success.main',
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.1)
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Ready for Stripe verification
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Next, Stripe securely verifies the payout recipient and bank account.
                </Typography>
              </Box>
            </Stack>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary">Operating profile</Typography>
                  <Typography variant="body2" fontWeight={650} textAlign="right">{draft.displayName}</Typography>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary">Selected property scope</Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent="flex-end">
                    {selectedProperties.map((property) => (
                      <Chip key={getPropertyId(property)} size="small" label={getPropertyName(property)} />
                    ))}
                  </Stack>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary">Authority</Typography>
                  <Typography variant="body2" fontWeight={650} textAlign="right">
                    {authorityOptions.find((option) => option.value === draft.authorityRelationship)?.label}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            <Alert severity="warning" icon={<SafetyCertificateOutlined />}>
              Completing Stripe verification does not automatically approve rent payouts. Property Peace payout approval is also required before transfers are enabled.
            </Alert>

            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Stripe secure verification may request
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Legal identity and tax details, beneficial-owner information when applicable, identity documents, acceptance of Stripe terms, and a payout bank account.
              </Typography>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={activeStep === 0 ? onClose : () => setActiveStep((current) => current - 1)} disabled={loading || preparationLoading}>
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep < 3 ? (
          <Button variant="contained" color="success" onClick={handleNext} disabled={preparationLoading || (activeStep === 2 && (propertiesLoading || propertiesError))}>
            Next
          </Button>
        ) : (
          <Button variant="contained" color="success" onClick={handleContinue} disabled={loading || preparationLoading} startIcon={<LockOutlined />}>
            {loading ? 'Opening Stripe…' : 'Continue to Stripe'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
