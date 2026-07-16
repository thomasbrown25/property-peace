import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  Card,
  CardContent,
  Grid,
  alpha,
  useTheme,
  InputAdornment,
  IconButton,
  Link,
  Alert,
  Tooltip
} from '@mui/material';
import { 
  UserOutlined, 
  ShopOutlined, 
  FileTextOutlined,
  LockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import StripeConnectOnboardingDialog from 'components/dialogs/StripeConnectOnboardingDialog';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function LeasePaymentSetup() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const [accountType, setAccountType] = useState('personal'); // 'personal' or 'business'
  const [showSSN, setShowSSN] = useState(false);
  const [stripeDialogOpen, setStripeDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Personal form state
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    phoneNumber: '',
    streetAddress: '',
    unit: '',
    city: '',
    state: '',
    zipCode: '',
    dateOfBirth: '',
    ssn: ''
  });

  // Business form state
  const [businessInfo, setBusinessInfo] = useState({
    companyName: '',
    dba: '',
    phoneNumber: '',
    taxId: '',
    companyStreetAddress: '',
    companyUnit: '',
    companyCity: '',
    companyState: '',
    companyZipCode: '',
    ownerFirstName: '',
    ownerMiddleName: '',
    ownerLastName: '',
    ownerPhoneNumber: '',
    ownerStreetAddress: '',
    ownerUnit: '',
    ownerCity: '',
    ownerState: '',
    ownerZipCode: '',
    companyCreatedLessThan90Days: 'no'
  });

  const handlePersonalInfoChange = (field, value) => {
    setPersonalInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleBusinessInfoChange = (field, value) => {
    setBusinessInfo(prev => ({ ...prev, [field]: value }));
  };

  const validatePersonalForm = () => {
    const required = ['firstName', 'lastName', 'phoneNumber', 'streetAddress', 'city', 'state', 'zipCode', 'dateOfBirth', 'ssn'];
    for (const field of required) {
      if (!personalInfo[field]) {
        return false;
      }
    }
    return true;
  };

  const validateBusinessForm = () => {
    const required = ['companyName', 'phoneNumber', 'taxId', 'companyStreetAddress', 'companyCity', 'companyState', 'companyZipCode',
                     'ownerFirstName', 'ownerLastName', 'ownerPhoneNumber', 'ownerStreetAddress', 'ownerCity', 'ownerState', 'ownerZipCode'];
    for (const field of required) {
      if (!businessInfo[field]) {
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    // Validate form based on account type
    const isValid = accountType === 'personal' ? validatePersonalForm() : validateBusinessForm();
    
    if (!isValid) {
      openSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setLoading(true);
      
      // Save the payment setup information
      const formData = accountType === 'personal' 
        ? { accountType: 'personal', ...personalInfo }
        : { accountType: 'business', ...businessInfo };

      // TODO: Save to backend/lease
      // await axiosServices.post(`/api/lease/${leaseId}/payment-setup`, formData);

      // Open Stripe Connect onboarding
      setStripeDialogOpen(true);
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to save payment setup information',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStripeComplete = async () => {
    // After Stripe onboarding is complete, navigate back to lease page
    openSnackbar({
      open: true,
      message: 'Payment setup completed successfully',
      variant: 'alert',
      alert: { color: 'success' }
    });
    navigate(`/landlord/leases/${leaseId}`);
  };

  const handleBack = () => {
    navigate(`/landlord/leases/${leaseId}/rent-collection`);
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Leases', path: '/landlord/leases' },
          { label: 'Payment Setup' }
        ]}
      />

      <Stack spacing={3} sx={{ mt: 3, maxWidth: 900, mx: 'auto' }}>
        {/* Header */}
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="flex-start" spacing={2} sx={{ mb: 2 }}>
            <Button
              variant="text"
              startIcon={<ArrowLeftOutlined />}
              onClick={handleBack}
              sx={{ textTransform: 'none', minWidth: 'auto', width: 'fit-content', p: 0 }}
            >
              Back
            </Button>
          </Stack>
          <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ mb: 1 }}>
            PAYMENT SETUP
          </Typography>
          <Typography variant="h4" fontWeight={700}>
            Add Bank Details
          </Typography>
        </MainCard>

        {/* Account Type Selection */}
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            What type of bank account will you receive payments with?
          </Typography>
          <Stack direction="row" spacing={2}>
            <Card
              onClick={() => setAccountType('personal')}
              sx={{
                flex: 1,
                cursor: 'pointer',
                border: `2px solid ${accountType === 'personal' ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)}`,
                bgcolor: accountType === 'personal' 
                  ? alpha(theme.palette.primary.main, 0.05) 
                  : 'transparent',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.02)
                }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Radio checked={accountType === 'personal'} />
                  <UserOutlined style={{ fontSize: 32, color: accountType === 'personal' ? theme.palette.primary.main : theme.palette.text.secondary }} />
                  <Typography variant="h6" fontWeight={600}>
                    Personal
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card
              onClick={() => setAccountType('business')}
              sx={{
                flex: 1,
                cursor: 'pointer',
                border: `2px solid ${accountType === 'business' ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)}`,
                bgcolor: accountType === 'business' 
                  ? alpha(theme.palette.primary.main, 0.05) 
                  : 'transparent',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.02)
                }
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Radio checked={accountType === 'business'} />
                  <ShopOutlined style={{ fontSize: 32, color: accountType === 'business' ? theme.palette.primary.main : theme.palette.text.secondary }} />
                  <Typography variant="h6" fontWeight={600}>
                    Business
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </MainCard>

        {/* Personal Form */}
        {accountType === 'personal' && (
          <MainCard
            title={
              <Stack direction="row" spacing={1} alignItems="center">
                <UserOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                <Typography variant="h6" fontWeight={700}>
                  Your Information
                </Typography>
              </Stack>
            }
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2
            }}
          >
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                This information must match the information on the bank account you'll use to collect rent. You'll add your bank account on the next step.
              </Typography>
              <Link href="#" sx={{ fontSize: '0.875rem' }}>
                Why do you require this information?
              </Link>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Legal First Name *"
                    value={personalInfo.firstName}
                    onChange={(e) => handlePersonalInfoChange('firstName', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Middle Name (Optional)"
                    value={personalInfo.middleName}
                    onChange={(e) => handlePersonalInfoChange('middleName', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Last Name *"
                    value={personalInfo.lastName}
                    onChange={(e) => handlePersonalInfoChange('lastName', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Phone Number *"
                    value={personalInfo.phoneNumber}
                    onChange={(e) => handlePersonalInfoChange('phoneNumber', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Street Address *"
                    value={personalInfo.streetAddress}
                    onChange={(e) => handlePersonalInfoChange('streetAddress', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Unit (Optional)"
                    value={personalInfo.unit}
                    onChange={(e) => handlePersonalInfoChange('unit', e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    P.O. boxes are not accepted as a valid address. This is not the rental address.
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="City *"
                    value={personalInfo.city}
                    onChange={(e) => handlePersonalInfoChange('city', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControl fullWidth required>
                    <InputLabel>State *</InputLabel>
                    <Select
                      value={personalInfo.state}
                      label="State *"
                      onChange={(e) => handlePersonalInfoChange('state', e.target.value)}
                    >
                      {US_STATES.map(state => (
                        <MenuItem key={state} value={state}>{state}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label="Zip code *"
                    value={personalInfo.zipCode}
                    onChange={(e) => handlePersonalInfoChange('zipCode', e.target.value)}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Date of Birth"
                    type="date"
                    value={personalInfo.dateOfBirth}
                    onChange={(e) => handlePersonalInfoChange('dateOfBirth', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="SSN"
                    type={showSSN ? 'text' : 'password'}
                    value={personalInfo.ssn}
                    onChange={(e) => handlePersonalInfoChange('ssn', e.target.value)}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlined style={{ fontSize: 18, opacity: 0.6 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowSSN(!showSSN)} edge="end">
                            {showSSN ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>
              </Grid>
            </Stack>
          </MainCard>
        )}

        {/* Business Form */}
        {accountType === 'business' && (
          <Stack spacing={3}>
            {/* Company Information */}
            <MainCard
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <ShopOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={700}>
                    Company Information
                  </Typography>
                </Stack>
              }
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  This information must match the information on the bank account you'll use to collect rent. You'll add your bank account on the next step.
                </Typography>
                <Link href="#" sx={{ fontSize: '0.875rem' }}>
                  Why do you require this information?
                </Link>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Company Name *"
                      value={businessInfo.companyName}
                      onChange={(e) => handleBusinessInfoChange('companyName', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Doing Business As (DBA) (Optional)"
                      value={businessInfo.dba}
                      onChange={(e) => handleBusinessInfoChange('dba', e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Phone Number *"
                      value={businessInfo.phoneNumber}
                      onChange={(e) => handleBusinessInfoChange('phoneNumber', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Tax ID (TIN, EIN, etc.) *"
                      value={businessInfo.taxId}
                      onChange={(e) => handleBusinessInfoChange('taxId', e.target.value)}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlined style={{ fontSize: 18, opacity: 0.6 }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Tax identification number">
                              <InfoCircleOutlined style={{ fontSize: 18, opacity: 0.6, cursor: 'help' }} />
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Company Street Address *"
                      value={businessInfo.companyStreetAddress}
                      onChange={(e) => handleBusinessInfoChange('companyStreetAddress', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Unit (Optional)"
                      value={businessInfo.companyUnit}
                      onChange={(e) => handleBusinessInfoChange('companyUnit', e.target.value)}
                    />
                  </Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, mt: -1 }}>
                    P.O. boxes are not accepted as a valid address. This is not the rental address.
                  </Typography>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="City *"
                      value={businessInfo.companyCity}
                      onChange={(e) => handleBusinessInfoChange('companyCity', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth required>
                      <InputLabel>State *</InputLabel>
                      <Select
                        value={businessInfo.companyState}
                        label="State *"
                        onChange={(e) => handleBusinessInfoChange('companyState', e.target.value)}
                      >
                        {US_STATES.map(state => (
                          <MenuItem key={state} value={state}>{state}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Zip code *"
                      value={businessInfo.companyZipCode}
                      onChange={(e) => handleBusinessInfoChange('companyZipCode', e.target.value)}
                      required
                    />
                  </Grid>
                </Grid>
              </Stack>
            </MainCard>

            {/* Owner Information */}
            <MainCard
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <UserOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={700}>
                    Owner Information
                  </Typography>
                </Stack>
              }
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  The owner must be listed as a representative of the company.
                </Typography>
                <Link href="#" sx={{ fontSize: '0.875rem' }}>
                  Why do you require this information?
                </Link>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Legal First Name *"
                      value={businessInfo.ownerFirstName}
                      onChange={(e) => handleBusinessInfoChange('ownerFirstName', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Middle Name (Optional)"
                      value={businessInfo.ownerMiddleName}
                      onChange={(e) => handleBusinessInfoChange('ownerMiddleName', e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Last Name *"
                      value={businessInfo.ownerLastName}
                      onChange={(e) => handleBusinessInfoChange('ownerLastName', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Phone Number *"
                      value={businessInfo.ownerPhoneNumber}
                      onChange={(e) => handleBusinessInfoChange('ownerPhoneNumber', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      label="Your Street Address *"
                      value={businessInfo.ownerStreetAddress}
                      onChange={(e) => handleBusinessInfoChange('ownerStreetAddress', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Unit (Optional)"
                      value={businessInfo.ownerUnit}
                      onChange={(e) => handleBusinessInfoChange('ownerUnit', e.target.value)}
                    />
                  </Grid>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 2, mt: -1 }}>
                    P.O. boxes are not accepted as a valid address. This is not the rental address.
                  </Typography>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="City *"
                      value={businessInfo.ownerCity}
                      onChange={(e) => handleBusinessInfoChange('ownerCity', e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth required>
                      <InputLabel>State *</InputLabel>
                      <Select
                        value={businessInfo.ownerState}
                        label="State *"
                        onChange={(e) => handleBusinessInfoChange('ownerState', e.target.value)}
                      >
                        {US_STATES.map(state => (
                          <MenuItem key={state} value={state}>{state}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      fullWidth
                      label="Zip code *"
                      value={businessInfo.ownerZipCode}
                      onChange={(e) => handleBusinessInfoChange('ownerZipCode', e.target.value)}
                      required
                    />
                  </Grid>
                </Grid>
              </Stack>
            </MainCard>

            {/* Company Documents */}
            <MainCard
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <FileTextOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={700}>
                    Company Documents
                  </Typography>
                </Stack>
              }
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                borderRadius: 2
              }}
            >
              <Stack spacing={2}>
                <Typography variant="body2" fontWeight={600}>
                  Was your company created or updated less than 90 days ago?
                </Typography>
                <RadioGroup
                  value={businessInfo.companyCreatedLessThan90Days}
                  onChange={(e) => handleBusinessInfoChange('companyCreatedLessThan90Days', e.target.value)}
                >
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                  <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                </RadioGroup>
              </Stack>
            </MainCard>
          </Stack>
        )}

        {/* Next Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              py: 1.5,
              minWidth: 200
            }}
          >
            {loading ? 'Processing...' : 'NEXT'}
          </Button>
        </Box>

        {/* Terms and Security */}
        <Stack spacing={2} sx={{ textAlign: 'center', pb: 4 }}>
          <Typography variant="body2" color="text.secondary">
            By clicking the button above, you are agreeing to{' '}
            <Link href="https://stripe.com/legal" target="_blank" rel="noopener">Stripe's</Link>,{' '}
            <Link href="https://plaid.com/legal" target="_blank" rel="noopener">Plaid's</Link>, and{' '}
            <Link href="#" target="_blank" rel="noopener">Property Peace's</Link> terms of service. 
            Stripe is the industry leader in payment processing, while Plaid makes it easy to connect to your bank.
          </Typography>

          <Alert 
            severity="success" 
            icon={<LockOutlined />}
            sx={{ 
              bgcolor: alpha(theme.palette.success.main, 0.1),
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              '& .MuiAlert-icon': { color: theme.palette.success.main }
            }}
          >
            <Typography variant="body2">
              <strong>Guaranteed secure.</strong> Our payment processor, Stripe, requires identity verification in order to collect rent. 
              Property Peace takes security seriously.{' '}
              <Link href="#" sx={{ fontSize: 'inherit' }}>Learn how Property Peace protects its user's data.</Link>
            </Typography>
          </Alert>

          <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ pt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Powered by Stripe
            </Typography>
            <Typography variant="caption" color="text.secondary">
              SECURED BY SECTIGO
            </Typography>
            <Typography variant="caption" color="text.secondary">
              SECURE SSL ENCRYPTION
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      {/* Stripe Connect Onboarding Dialog */}
      <StripeConnectOnboardingDialog
        open={stripeDialogOpen}
        onClose={() => setStripeDialogOpen(false)}
        onComplete={handleStripeComplete}
      />
    </Box>
  );
}
