import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Stack,
  Typography,
  TextField,
  FormHelperText,
  Switch,
  FormControlLabel,
  InputLabel,
  Alert,
  InputAdornment
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// form + validation
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

// project imports
import FormInput from 'components/input/FormInput';
import FormNumberInput from 'components/input/FormNumberInput';
import AddressFieldWithPlaces from 'components/input/AddressFieldWithPlaces';
import { openSnackbar } from 'api/snackbar';
import * as applicationApi from 'api/application';
import AnimateButton from 'components/@extended/AnimateButton';
import { formatCurrency } from 'utils/formatters';
import DollarOutlined from '@ant-design/icons/DollarOutlined';

// ==============================|| TENANT APPLICATION FORM ||============================== //

const ApplicationSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  phoneNumber: Yup.string(),
  monthlyIncome: Yup.number().min(0, 'Monthly income must be positive').nullable(),
  employmentMonths: Yup.number().min(0, 'Employment months must be positive').nullable(),
  numberOfOccupants: Yup.number().min(1, 'Number of occupants must be at least 1').nullable()
});

const getInitialValues = (application) => {
  if (!application) {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      dateOfBirth: null,
      ssn: '',
      currentAddress: '',
      currentCity: '',
      currentState: '',
      currentZipCode: '',
      employerName: '',
      jobTitle: '',
      monthlyIncome: '',
      employmentMonths: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelationship: '',
      previousLandlordName: '',
      previousLandlordPhone: '',
      numberOfOccupants: '',
      hasPets: false,
      petDetails: '',
      hasVehicles: false,
      vehicleDetails: '',
      desiredMoveInDate: null,
      additionalNotes: ''
    };
  }

  return {
    // Applicant Information (pre-filled from existing application)
    firstName: application.firstName || '',
    lastName: application.lastName || '',
    email: application.email || '',
    phoneNumber: application.phoneNumber || '',
    dateOfBirth: application.dateOfBirth ? new Date(application.dateOfBirth) : null,
    ssn: application.ssn || '',
    currentAddress: application.currentAddress || '',
    currentCity: application.currentCity || '',
    currentState: application.currentState || '',
    currentZipCode: application.currentZipCode || '',

    // Employment Information
    employerName: application.employerName || '',
    jobTitle: application.jobTitle || '',
    monthlyIncome: application.monthlyIncome || '',
    employmentMonths: application.employmentMonths || '',

    // References
    emergencyContactName: application.emergencyContactName || '',
    emergencyContactPhone: application.emergencyContactPhone || '',
    emergencyContactRelationship: application.emergencyContactRelationship || '',
    previousLandlordName: application.previousLandlordName || '',
    previousLandlordPhone: application.previousLandlordPhone || '',

    // Application Details
    numberOfOccupants: application.numberOfOccupants || '',
    hasPets: application.hasPets || false,
    petDetails: application.petDetails || '',
    hasVehicles: application.hasVehicles || false,
    vehicleDetails: application.vehicleDetails || '',
    desiredMoveInDate: application.desiredMoveInDate ? new Date(application.desiredMoveInDate) : null,
    additionalNotes: application.additionalNotes || ''
  };
};

export default function TenantApplicationForm({ application, onSuccess }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formik = useFormik({
    initialValues: getInitialValues(application),
    validationSchema: ApplicationSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        setLoading(true);

        // Prepare payload for update
        const payload = {
          id: application.id,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(), // Email cannot be changed, but we send it for validation
          phoneNumber: values.phoneNumber?.trim() || null,
          dateOfBirth: values.dateOfBirth ? (values.dateOfBirth instanceof Date ? values.dateOfBirth.toISOString() : values.dateOfBirth) : null,
          ssn: values.ssn?.trim() || null,
          currentAddress: values.currentAddress?.trim() || null,
          currentCity: values.currentCity?.trim() || null,
          currentState: values.currentState?.trim() || null,
          currentZipCode: values.currentZipCode?.trim() || null,
          employerName: values.employerName?.trim() || null,
          jobTitle: values.jobTitle?.trim() || null,
          monthlyIncome: values.monthlyIncome ? Number(values.monthlyIncome) : null,
          employmentMonths: values.employmentMonths ? Number(values.employmentMonths) : null,
          emergencyContactName: values.emergencyContactName?.trim() || null,
          emergencyContactPhone: values.emergencyContactPhone?.trim() || null,
          emergencyContactRelationship: values.emergencyContactRelationship?.trim() || null,
          previousLandlordName: values.previousLandlordName?.trim() || null,
          previousLandlordPhone: values.previousLandlordPhone?.trim() || null,
          numberOfOccupants: values.numberOfOccupants ? Number(values.numberOfOccupants) : null,
          hasPets: values.hasPets || false,
          petDetails: values.petDetails?.trim() || null,
          hasVehicles: values.hasVehicles || false,
          vehicleDetails: values.vehicleDetails?.trim() || null,
          desiredMoveInDate: values.desiredMoveInDate ? (values.desiredMoveInDate instanceof Date ? values.desiredMoveInDate.toISOString() : values.desiredMoveInDate) : null,
          additionalNotes: values.additionalNotes?.trim() || null,
          status: 1 // Submit when tenant completes the form
        };

        const response = await applicationApi.updateApplication(application.id, payload);

        if (response.success) {
          setSubmitted(true);
          openSnackbar({
            open: true,
            message: 'Application submitted successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
          
          if (onSuccess) {
            setTimeout(() => {
              onSuccess();
            }, 1500);
          }
        } else {
          const errorMessage = response.message || 'Failed to submit application. Please try again.';
          setErrors({ submit: errorMessage });
          openSnackbar({
            open: true,
            message: errorMessage,
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error submitting application:', error);
        const errorMessage = error?.response?.data?.message || 'Failed to submit application. Please try again.';
        setErrors({ submit: errorMessage });
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  // State for monthly income display (formatted currency)
  const [monthlyIncomeDisplay, setMonthlyIncomeDisplay] = useState(
    values.monthlyIncome ? formatCurrency(values.monthlyIncome) : ''
  );

  // Parse currency string back to number (similar to PaymentModal)
  const parseCurrencyToNumber = (value) => {
    if (!value) return 0;
    // Remove currency symbols, commas, and spaces
    const cleaned = value.toString().replace(/[$,]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Sync monthlyIncomeDisplay when values.monthlyIncome changes externally
  useEffect(() => {
    if (values.monthlyIncome && typeof values.monthlyIncome === 'number' && values.monthlyIncome > 0) {
      setMonthlyIncomeDisplay(formatCurrency(values.monthlyIncome));
    } else if (!values.monthlyIncome || values.monthlyIncome === '') {
      setMonthlyIncomeDisplay('');
    }
  }, [values.monthlyIncome]);

  // Show success message if submitted
  if (submitted) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
            <Alert severity="success" sx={{ width: '100%', maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Application Submitted Successfully!
              </Typography>
              <Typography variant="body2">
                Thank you for your application. The landlord will review it and contact you soon.
              </Typography>
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <FormikProvider value={formik}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            {/* Error Alert */}
            {errors.submit && (
              <Alert severity="error" onClose={() => setFieldValue('submit', null)}>
                {errors.submit}
              </Alert>
            )}

            {/* Applicant Information */}
            <Card>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                  Applicant Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('firstName')}
                      label="First Name *"
                      errorText={errors.firstName}
                      touched={touched.firstName}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('lastName')}
                      label="Last Name *"
                      errorText={errors.lastName}
                      touched={touched.lastName}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('email')}
                      label="Email *"
                      type="email"
                      disabled={true}
                      errorText={errors.email}
                      touched={touched.email}
                      helperText="Email cannot be changed"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('phoneNumber')}
                      label="Phone Number"
                      valueType="phone"
                      errorText={errors.phoneNumber}
                      touched={touched.phoneNumber}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box>
                      <InputLabel htmlFor="dateOfBirth-input" sx={{ mb: 1 }}>
                        Date of Birth
                      </InputLabel>
                      <DatePicker
                        value={values.dateOfBirth}
                        onChange={(newValue) => setFieldValue('dateOfBirth', newValue)}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                            id: 'dateOfBirth-input',
                            name: 'dateOfBirth',
                            error: touched.dateOfBirth && !!errors.dateOfBirth
                          }
                        }}
                      />
                      {touched.dateOfBirth && errors.dateOfBirth && (
                        <FormHelperText error sx={{ mt: 0.5 }}>
                          {errors.dateOfBirth}
                        </FormHelperText>
                      )}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('ssn')}
                      label="SSN (Last 4 digits)"
                      placeholder="XXXX"
                      errorText={errors.ssn}
                      touched={touched.ssn}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <AddressFieldWithPlaces
                      formik={formik}
                      name="currentAddress"
                      label="Current Address"
                      placesOptions={{
                        includedPrimaryTypes: ['street_address', 'premise', 'subpremise']
                      }}
                      onSelected={(formattedAddress, place) => {
                        // Extract address components from the selected place
                        if (place) {
                          // Try multiple ways to access addressComponents (new API vs legacy)
                          let addressComponents = null;
                          
                          // New Places API (addressComponents as property)
                          if (place.addressComponents) {
                            addressComponents = place.addressComponents;
                          }
                          // Legacy API (address_components as property)
                          else if (place.address_components) {
                            addressComponents = place.address_components;
                          }
                          // Try as getter/method
                          else if (typeof place.getAddressComponents === 'function') {
                            addressComponents = place.getAddressComponents();
                          }

                          if (addressComponents) {
                            // Handle both array and array-like objects
                            const components = Array.isArray(addressComponents) 
                              ? addressComponents 
                              : Array.from(addressComponents || []);

                            let city = '';
                            let state = '';
                            let zipCode = '';

                            for (const component of components) {
                              if (!component) continue;

                              // Get types - handle both array and array-like
                              let types = [];
                              if (Array.isArray(component.types)) {
                                types = component.types;
                              } else if (component.types && typeof component.types[Symbol.iterator] === 'function') {
                                types = Array.from(component.types);
                              }

                              // Handle both new API (longText/shortText) and legacy API (long_name/short_name)
                              const longText = component.longText || component.long_name || '';
                              const shortText = component.shortText || component.short_name || '';

                              // Check for locality (city)
                              if ((types.includes('locality') || types.includes('sublocality') || types.includes('sublocality_level_1')) && !city) {
                                city = longText || shortText;
                              }
                              // Check for administrative_area_level_1 (state)
                              else if (types.includes('administrative_area_level_1') && !state) {
                                state = shortText || longText; // Prefer short code for state
                              }
                              // Check for postal_code (zip code)
                              else if (types.includes('postal_code') && !zipCode) {
                                zipCode = longText || shortText;
                              }
                            }

                            // Update formik values with the correct field names
                            if (city) setFieldValue('currentCity', city);
                            if (state) setFieldValue('currentState', state);
                            if (zipCode) setFieldValue('currentZipCode', zipCode);
                          }
                        }
                      }}
                    />
                    {touched.currentAddress && errors.currentAddress && (
                      <FormHelperText error sx={{ mt: 0.5 }}>
                        {errors.currentAddress}
                      </FormHelperText>
                    )}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormInput
                      {...getFieldProps('currentCity')}
                      label="City"
                      errorText={errors.currentCity}
                      touched={touched.currentCity}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormInput
                      {...getFieldProps('currentState')}
                      label="State"
                      errorText={errors.currentState}
                      touched={touched.currentState}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormInput
                      {...getFieldProps('currentZipCode')}
                      label="Zip Code"
                      errorText={errors.currentZipCode}
                      touched={touched.currentZipCode}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Employment Information */}
            <Card>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                  Employment Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('employerName')}
                      label="Employer Name"
                      errorText={errors.employerName}
                      touched={touched.employerName}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('jobTitle')}
                      label="Job Title"
                      errorText={errors.jobTitle}
                      touched={touched.jobTitle}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Monthly Income"
                      value={monthlyIncomeDisplay}
                      onChange={(e) => {
                        const value = e.target.value;
                        setMonthlyIncomeDisplay(value);
                        const parsed = parseCurrencyToNumber(value);
                        setFieldValue('monthlyIncome', parsed > 0 ? parsed : '');
                      }}
                      onBlur={(e) => {
                        // Format on blur if there's a valid amount
                        const parsed = parseCurrencyToNumber(e.target.value);
                        if (parsed > 0) {
                          setFieldValue('monthlyIncome', parsed);
                          setMonthlyIncomeDisplay(formatCurrency(parsed));
                        } else {
                          setMonthlyIncomeDisplay('');
                          setFieldValue('monthlyIncome', '');
                        }
                        // Trigger formik's onBlur
                        getFieldProps('monthlyIncome').onBlur(e);
                      }}
                      fullWidth
                      size="medium"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 1.5
                        }
                      }}
                      placeholder="Enter amount"
                      error={Boolean(touched.monthlyIncome && errors.monthlyIncome)}
                      helperText={touched.monthlyIncome && errors.monthlyIncome}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormNumberInput
                      {...getFieldProps('employmentMonths')}
                      label="Employment Duration (Months)"
                      setFieldValue={setFieldValue}
                      errorText={errors.employmentMonths}
                      touched={touched.employmentMonths}
                      min={0}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* References */}
            <Card>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                  References
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      {...getFieldProps('emergencyContactName')}
                      label="Emergency Contact Name"
                      errorText={errors.emergencyContactName}
                      touched={touched.emergencyContactName}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      {...getFieldProps('emergencyContactPhone')}
                      label="Emergency Contact Phone"
                      valueType="phone"
                      errorText={errors.emergencyContactPhone}
                      touched={touched.emergencyContactPhone}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      {...getFieldProps('emergencyContactRelationship')}
                      label="Relationship"
                      errorText={errors.emergencyContactRelationship}
                      touched={touched.emergencyContactRelationship}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('previousLandlordName')}
                      label="Previous Landlord Name"
                      errorText={errors.previousLandlordName}
                      touched={touched.previousLandlordName}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormInput
                      {...getFieldProps('previousLandlordPhone')}
                      label="Previous Landlord Phone"
                      valueType="phone"
                      errorText={errors.previousLandlordPhone}
                      touched={touched.previousLandlordPhone}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Application Details */}
            <Card>
              <CardContent>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
                  Application Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormNumberInput
                      {...getFieldProps('numberOfOccupants')}
                      label="Number of Occupants"
                      setFieldValue={setFieldValue}
                      errorText={errors.numberOfOccupants}
                      touched={touched.numberOfOccupants}
                      min={1}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Box>
                      <InputLabel htmlFor="desiredMoveInDate-input" sx={{ mb: 1 }}>
                        Desired Move-In Date
                      </InputLabel>
                      <DatePicker
                        value={values.desiredMoveInDate}
                        onChange={(newValue) => setFieldValue('desiredMoveInDate', newValue)}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                            id: 'desiredMoveInDate-input',
                            error: touched.desiredMoveInDate && !!errors.desiredMoveInDate
                          }
                        }}
                      />
                      {touched.desiredMoveInDate && errors.desiredMoveInDate && (
                        <FormHelperText error sx={{ mt: 0.5 }}>
                          {errors.desiredMoveInDate}
                        </FormHelperText>
                      )}
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={values.hasPets}
                          onChange={(e) => setFieldValue('hasPets', e.target.checked)}
                        />
                      }
                      label="Has Pets"
                    />
                  </Grid>
                  {values.hasPets && (
                    <Grid size={{ xs: 12 }}>
                      <FormInput
                        {...getFieldProps('petDetails')}
                        label="Pet Details"
                        multiline
                        rows={3}
                        placeholder="Type, breed, size, etc."
                        errorText={errors.petDetails}
                        touched={touched.petDetails}
                      />
                    </Grid>
                  )}
                  <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={values.hasVehicles}
                          onChange={(e) => setFieldValue('hasVehicles', e.target.checked)}
                        />
                      }
                      label="Has Vehicles"
                    />
                  </Grid>
                  {values.hasVehicles && (
                    <Grid size={{ xs: 12 }}>
                      <FormInput
                        {...getFieldProps('vehicleDetails')}
                        label="Vehicle Details"
                        multiline
                        rows={3}
                        placeholder="Make, model, license plate, etc."
                        errorText={errors.vehicleDetails}
                        touched={touched.vehicleDetails}
                      />
                    </Grid>
                  )}
                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      {...getFieldProps('additionalNotes')}
                      label="Additional Notes"
                      multiline
                      rows={4}
                      errorText={errors.additionalNotes}
                      touched={touched.additionalNotes}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/tenant/applications')}
                disabled={isSubmitting || loading}
              >
                Cancel
              </Button>
              <AnimateButton>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isSubmitting || loading}
                  sx={{ minWidth: 150 }}
                >
                  {isSubmitting || loading ? 'Submitting...' : 'Submit Application'}
                </Button>
              </AnimateButton>
            </Box>
          </Stack>
        </Form>
      </LocalizationProvider>
    </FormikProvider>
  );
}

TenantApplicationForm.propTypes = {
  application: PropTypes.object.isRequired,
  onSuccess: PropTypes.func
};

