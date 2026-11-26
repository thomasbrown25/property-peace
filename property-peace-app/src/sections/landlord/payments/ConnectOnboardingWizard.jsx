import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
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

import FormInput from 'components/input/FormInput';
import {
  buildConnectOnboardingContext,
  createConnectOnboardingDraft,
  validateConnectOnboardingContext,
  validateConnectOnboardingStep
} from 'utils/connectOnboarding';

const setupSteps = ['Account type', 'Account details', 'Property authority', 'Stripe verification'];

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
  embedded = false,
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
  const [draftState, setDraft] = useState(() => makeInitialDraft({ user, initialDraft }));
  const draft = { ...draftState, displayName: draftState.displayNames[draftState.operatingType] ?? '' };
  const [ein, setEin] = useState('');
  const [errors, setErrors] = useState({});
  const setupHeadingId = useId();
  const accountTypeErrorId = useId();
  const einInputId = useId();
  const stepHeadingRef = useRef(null);
  const previousStep = useRef(activeStep);

  useEffect(() => {
    if (!open && !embedded) return;
    setActiveStep(0);
    setDraft(makeInitialDraft({ user, initialDraft }));
    setEin('');
    setErrors({});
  }, [open, embedded, user, initialDraft]);

  useEffect(() => {
    if (embedded && previousStep.current !== activeStep) stepHeadingRef.current?.focus();
    previousStep.current = activeStep;
  }, [activeStep, embedded]);

  const selectedProperties = useMemo(() => {
    const selected = new Set(draft.propertyIds);
    return properties.filter((property) => selected.has(getPropertyId(property)));
  }, [draft.propertyIds, properties]);
  const allPropertiesSelected = selectedProperties.length === properties.length && draft.propertyIds.length === properties.length;

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateDisplayName = (event) => {
    const value = event.target.value;
    setDraft((current) => ({
      ...current,
      displayNames: { ...current.displayNames, [current.operatingType]: value }
    }));
    setErrors((current) => ({ ...current, displayName: undefined }));
  };

  const updatePropertySelection = (propertyIds) => {
    setDraft((current) => ({ ...current, propertyIds, authorityAttested: false }));
    setErrors((current) => ({ ...current, propertyIds: undefined, authorityAttested: undefined }));
  };

  const toggleProperty = (propertyId) => {
    const selected = new Set(draft.propertyIds);
    if (selected.has(propertyId)) selected.delete(propertyId);
    else selected.add(propertyId);
    updatePropertySelection([...selected]);
  };

  const nextErrors = validateConnectOnboardingStep(activeStep, draft, ein);
  const nextDisabled = loading || preparationLoading || Object.keys(nextErrors).length > 0 ||
    (activeStep === 2 && (propertiesLoading || propertiesError || selectedProperties.length === 0));

  const handleNext = () => {
    if (!nextDisabled) setActiveStep((current) => Math.min(current + 1, 3));
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
    ? (embedded ? 'Account type' : 'New bank account')
    : activeStep === 1
      ? draft.operatingType === 'business' ? 'Business details' : 'Individual details'
      : activeStep === 2
        ? 'Property authority'
        : 'Stripe verification';

  const stepContent = (
    <>
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

          <RadioGroup
            aria-label="Bank account type"
            aria-describedby={errors.operatingType ? accountTypeErrorId : undefined}
            value={draft.operatingType}
            onChange={(_event, value) => updateDraft('operatingType', value)}
            sx={{ gap: 1.5 }}
          >
            {[
              { value: 'individual', label: 'Individual', description: 'Individuals and sole proprietorships' },
              { value: 'business', label: 'Business', description: 'Companies, LLCs, and partnerships' }
            ].map((option) => {
              const selected = draft.operatingType === option.value;
              return (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio color="primary" />}
                  disableTypography
                  label={
                    <Box component="span">
                      <Typography component="span" display="block" fontWeight={750}>{option.label}</Typography>
                      <Typography component="span" display="block" variant="body2" color="text.secondary">{option.description}</Typography>
                    </Box>
                  }
                  sx={{
                    m: 0,
                    p: 2,
                    gap: 1.5,
                    color: 'text.primary',
                    bgcolor: selected ? (theme) => alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                    border: '1px solid',
                    borderColor: selected ? 'primary.main' : 'divider',
                    borderRadius: 1.5,
                    '&:hover, &:focus-within': { borderColor: 'primary.main' },
                    '&:has(.Mui-focusVisible)': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }
                  }}
                />
              );
            })}
          </RadioGroup>
          {errors.operatingType && <FormHelperText id={accountTypeErrorId} role="alert" error>{errors.operatingType}</FormHelperText>}
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={2.5}>
          <Typography variant="body1">
            {draft.operatingType === 'business' ? 'Provide the details about your company.' : 'Provide the name tenants and your team recognize.'}
          </Typography>
          {draft.operatingType === 'business' ? (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              <FormInput
                name="legalBusinessName"
                required
                label="Legal Business Name *"
                placeholder="Company"
                value={draft.displayName}
                onChange={updateDisplayName}
                error={Boolean(errors.displayName)}
                helperText={errors.displayName}
                autoFocus={!embedded}
              />
              <Stack sx={{ gap: 1 }}>
                <InputLabel htmlFor={einInputId}>EIN *</InputLabel>
                <TextField
                  id={einInputId}
                  required
                  size="small"
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
            </Box>
          ) : (
            <FormInput
              name="landlordDisplayName"
              required
              label="Landlord display name *"
              placeholder="ex. John Doe"
              value={draft.displayName}
              onChange={updateDisplayName}
              error={Boolean(errors.displayName)}
              helperText={errors.displayName || 'Use the name tenants and your team recognize.'}
              autoFocus={!embedded}
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
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <FormLabel>Properties using online rent payments</FormLabel>
              <Button
                size="small"
                aria-label="Select all properties"
                onClick={() => updatePropertySelection(properties.map(getPropertyId))}
                disabled={propertiesLoading || propertiesError || properties.length === 0 || allPropertiesSelected}
                sx={{ flexShrink: 0 }}
              >
                Select all
              </Button>
            </Stack>
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

          <Alert severity="info" icon={<SafetyCertificateOutlined />}>
            Stripe verifies your account details. Manage your account, payout settings, and bank accounts in your full Stripe Dashboard.
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
    </>
  );

  const stepActions = (
    <>
      {(!embedded || onClose || activeStep > 0) && (
        <Button onClick={activeStep === 0 ? onClose : () => setActiveStep((current) => current - 1)} disabled={loading || preparationLoading}>
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>
      )}
      <Box sx={{ flex: 1 }} />
      {activeStep < 3 ? (
        <Button variant="contained" color="primary" onClick={handleNext} disabled={nextDisabled}>
          Next
        </Button>
      ) : (
        <Button variant="contained" color="primary" onClick={handleContinue} disabled={loading || preparationLoading} startIcon={<LockOutlined />}>
          {loading ? 'Opening Stripe…' : 'Continue to Stripe'}
        </Button>
      )}
    </>
  );

  if (embedded) {
    return (
      <Stack component="section" aria-labelledby={setupHeadingId} spacing={2.5} sx={{ maxWidth: 840 }}>
        <Box>
          <Typography id={setupHeadingId} component="h2" variant="h5" fontWeight={700}>Set up Stripe</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Connect Stripe to accept online rent payments and receive payouts.
          </Typography>
        </Box>

        <Box
          component="ol"
          aria-label="Stripe setup progress"
          sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}
        >
          {setupSteps.map((label, index) => (
            <Box
              key={label}
              component="li"
              aria-current={index === activeStep ? 'step' : undefined}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5,
                color: index <= activeStep ? 'text.primary' : 'text.secondary',
                bgcolor: index === activeStep ? (theme) => alpha(theme.palette.primary.main, 0.09) : undefined
              }}
            >
              <Box
                component="span"
                aria-hidden="true"
                sx={{
                  display: 'grid', placeItems: 'center', width: 24, height: 24, flexShrink: 0, borderRadius: '50%',
                  bgcolor: index === activeStep ? 'primary.main' : 'action.hover',
                  color: index === activeStep ? 'primary.contrastText' : index < activeStep ? 'success.main' : 'inherit',
                  typography: 'caption', fontWeight: 700
                }}
              >
                {index < activeStep ? <CheckCircleOutlined /> : index + 1}
              </Box>
              <Typography variant="body2" fontWeight={index === activeStep ? 700 : 500}>{label}</Typography>
            </Box>
          ))}
        </Box>

        <Paper variant="outlined">
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography component="h3" variant="h6" ref={stepHeadingRef} tabIndex={-1} sx={{ mb: 2 }}>{title}</Typography>
            {stepContent}
          </Box>
          <Stack direction="row" spacing={1} sx={{ p: { xs: 2, sm: 3 }, borderTop: '1px solid', borderColor: 'divider' }}>
            {stepActions}
          </Stack>
        </Paper>
      </Stack>
    );
  }

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
      <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>{stepContent}</DialogContent>
      <DialogActions sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>{stepActions}</DialogActions>
    </Dialog>
  );
}
