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
  Alert
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
import { applicationInviteAPI } from 'api';
import AnimateButton from 'components/@extended/AnimateButton';

// ==============================|| APPLICATION FORM ||============================== //

const ApplicationSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  phoneNumber: Yup.string(),
  monthlyIncome: Yup.number().min(0, 'Monthly income must be positive').nullable(),
  employmentMonths: Yup.number().min(0, 'Employment months must be positive').nullable(),
  numberOfOccupants: Yup.number().min(1, 'Number of occupants must be at least 1').nullable()
});

const getInitialValues = (inviteData) => ({
  // Property/Unit (from invite, not editable)
  propertyId: inviteData?.propertyId || null,
  unitId: inviteData?.unitId || null,

  // Applicant Information
  firstName: inviteData?.applicantName?.split(' ')[0] || '',
  lastName: inviteData?.applicantName?.split(' ').slice(1).join(' ') || '',
  email: inviteData?.email || '',
  phoneNumber: '',
  dateOfBirth: null,
  ssn: '',
  currentAddress: '',
  currentCity: '',
  currentState: '',
  currentZipCode: '',

  // Employment Information
  employerName: '',
  jobTitle: '',
  monthlyIncome: '',
  employmentMonths: '',

  // References
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  previousLandlordName: '',
  previousLandlordPhone: '',

  // Application Details
  numberOfOccupants: '',
  hasPets: false,
  petDetails: '',
  hasVehicles: false,
  vehicleDetails: '',
  desiredMoveInDate: null,
  additionalNotes: ''
});

export default function ApplicationForm({ inviteToken, inviteData }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formik = useFormik({
    initialValues: getInitialValues(inviteData),
    validationSchema: ApplicationSchema,
    enableReinitialize: false,
    onSubmit: async (values, { setSubmitting, setErrors }) => {
      try {
        setLoading(true);

        // Prepare payload
        const payload = {
          propertyId: inviteData?.propertyId,
          unitId: inviteData?.unitId || null,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phoneNumber: values.phoneNumber?.trim() || null,
          dateOfBirth: values.dateOfBirth || null,
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
          desiredMoveInDate: values.desiredMoveInDate || null,
          additionalNotes: values.additionalNotes?.trim() || null,
          status: 1 // Always submit
        };

        const response = await applicationInviteAPI.submitApplicationWithToken(inviteToken, payload);

        if (response.success) {
          setSubmitted(true);
          openSnackbar({
            open: true,
            message: 'Application submitted successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
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
                      disabled={!!inviteData?.email}
                      errorText={errors.email}
                      touched={touched.email}
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
                      onSelected={(address, place) => {
                        // AddressFieldWithPlaces will auto-fill city, state, zipCode
                        // We need to map them to currentCity, currentState, currentZipCode
                        if (place?.addressComponents) {
                          const components = Array.isArray(place.addressComponents) 
                            ? place.addressComponents 
                            : Array.from(place.addressComponents || []);
                          
                          let city = '';
                          let state = '';
                          let zipCode = '';
                          
                          for (const component of components) {
                            if (!component) continue;
                            
                            let types = [];
                            if (Array.isArray(component.types)) {
                              types = component.types;
                            } else if (component.types && typeof component.types[Symbol.iterator] === 'function') {
                              types = Array.from(component.types);
                            }
                            
                            const longText = component.longText || component.long_name || '';
                            const shortText = component.shortText || component.short_name || '';
                            
                            if ((types.includes('locality') || types.includes('sublocality') || types.includes('sublocality_level_1')) && !city) {
                              city = longText || shortText;
                            } else if (types.includes('administrative_area_level_1') && !state) {
                              state = shortText || longText;
                            } else if (types.includes('postal_code') && !zipCode) {
                              zipCode = longText || shortText;
                            }
                          }
                          
                          if (city) formik.setFieldValue('currentCity', city);
                          if (state) formik.setFieldValue('currentState', state);
                          if (zipCode) formik.setFieldValue('currentZipCode', zipCode);
                        }
                      }}
                    />
                    {touched.currentAddress && errors.currentAddress && (
                      <FormHelperText error sx={{ mt: 0.5, ml: 1.75 }}>
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
                    <FormInput
                      {...getFieldProps('monthlyIncome')}
                      label="Monthly Income"
                      valueType="currency"
                      errorText={errors.monthlyIncome}
                      touched={touched.monthlyIncome}
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
                  <Grid size={{ xs: 12}}>
                    <FormInput
                      {...getFieldProps('emergencyContactName')}
                      label="Emergency Contact Name"
                      errorText={errors.emergencyContactName}
                      touched={touched.emergencyContactName}
                    />
                  </Grid>
                  <Grid size={{ xs: 12}}>
                    <FormInput
                      {...getFieldProps('emergencyContactPhone')}
                      label="Emergency Contact Phone"
                      valueType="phone"
                      errorText={errors.emergencyContactPhone}
                      touched={touched.emergencyContactPhone}
                    />
                  </Grid>
                  <Grid size={{ xs: 12}}>
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

ApplicationForm.propTypes = {
  inviteToken: PropTypes.string.isRequired,
  inviteData: PropTypes.object.isRequired
};

