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
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  alpha
} from '@mui/material';
import {
  BankOutlined,
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

const steps = ['Your rent business', 'Property authority', 'Stripe verification'];

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
  const [draft, setDraft] = useState(() => createConnectOnboardingDraft({ user, savedPreparation: initialDraft }));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setActiveStep(0);
    setDraft(createConnectOnboardingDraft({ user, savedPreparation: initialDraft }));
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
    if (activeStep === 1 && (propertiesLoading || propertiesError)) return;
    const nextErrors = validateConnectOnboardingStep(activeStep, draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleContinue = () => {
    const context = buildConnectOnboardingContext(draft);
    const nextErrors = validateConnectOnboardingContext(context, properties.map(getPropertyId));
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setActiveStep(nextErrors.operatingType || nextErrors.displayName ? 0 : 1);
      return;
    }
    onContinue(context);
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
    >
      <DialogTitle sx={{ p: { xs: 2.5, sm: 3 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1.5,
                color: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1)
              }}
            >
              <BankOutlined style={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={750}>
                Verify your business and set up rent payouts
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Property Peace prepares your rent-collection profile, then Stripe securely verifies the payout recipient.
              </Typography>
            </Box>
          </Stack>
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
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3.5 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Who will receive rent payouts?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Use the name tenants and your team recognize. Stripe will collect the formal legal details in the secure step.
              </Typography>
            </Box>

            <FormControl>
              <FormLabel>Operating as</FormLabel>
              <RadioGroup
                row
                value={draft.operatingType}
                onChange={(event) => updateDraft('operatingType', event.target.value)}
              >
                <FormControlLabel value="individual" control={<Radio />} label="Individual landlord" />
                <FormControlLabel value="business" control={<Radio />} label="Property-management business" />
              </RadioGroup>
            </FormControl>

            <TextField
              label={draft.operatingType === 'business' ? 'Business or management name' : 'Landlord display name'}
              value={draft.displayName}
              onChange={(event) => updateDraft('displayName', event.target.value)}
              error={Boolean(errors.displayName)}
              helperText={errors.displayName || 'This is Property Peace display information, not a legal identity submission.'}
              fullWidth
              autoFocus
            />

            <Alert severity="info" icon={<LockOutlined />}>
              Property Peace does not collect or store your SSN, identity documents, or full bank account details. You will enter those only in Stripe secure verification.
            </Alert>
          </Stack>
        )}

        {activeStep === 1 && (
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

        {activeStep === 2 && (
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
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext} disabled={preparationLoading || (activeStep === 1 && (propertiesLoading || propertiesError))}>
            Continue
          </Button>
        ) : (
          <Button variant="contained" onClick={handleContinue} disabled={loading || preparationLoading} startIcon={<LockOutlined />}>
            {loading ? 'Opening Stripe…' : 'Continue to Stripe'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
