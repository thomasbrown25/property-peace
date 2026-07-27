import PropTypes from 'prop-types';
import { Box, Button, FormHelperText, Link, OutlinedInput, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import * as Yup from 'yup';
import { Formik } from 'formik';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { formatPhoneInput } from 'utils/formatters';

const meaningfulText = (label) =>
  Yup.string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(100, `${label} is too long`)
    .matches(/.*[A-Za-z].*/, `${label} must include a letter`)
    .required(`${label} is required`);
const validPhone = (value) => Boolean(value && parsePhoneNumberFromString(value, 'US')?.isValid());

export default function LandlordPersonalInfoStep({
  initialFirstName = '',
  initialLastName = '',
  initialPhoneNumber = '',
  initialOrganizationName = '',
  googleProfile = false,
  onNext,
  onBack
}) {
  const googleHasName = googleProfile && Boolean(initialFirstName.trim() && initialLastName.trim());
  const nameFields = [
    ['firstName', 'First name'],
    ['lastName', 'Last name']
  ].filter(([name]) => !googleProfile || !String(name === 'firstName' ? initialFirstName : initialLastName).trim());
  return (
    <Box sx={{ width: '100%', maxWidth: 460, mx: 'auto' }}>
      <Button onClick={onBack} sx={{ px: 0, mb: 2, textTransform: 'none' }}>
        Back
      </Button>
      <Typography color="success.main" fontWeight={700} variant="body2">
        Step 3 of 3 · Your workspace
      </Typography>
      <Typography variant="h3" sx={{ mt: 1, mb: 1, color: '#061e35', fontWeight: 700 }}>
        Tell us about your business
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Add the details we need to personalize your workspace. Your phone number is required for account and property communications.
      </Typography>
      <Formik
        initialValues={{
          firstName: initialFirstName,
          lastName: initialLastName,
          phoneNumber: initialPhoneNumber,
          organizationName: initialOrganizationName,
          submit: null
        }}
        enableReinitialize
        validationSchema={Yup.object({
          firstName: meaningfulText('First name'),
          lastName: meaningfulText('Last name'),
          organizationName: meaningfulText('Workspace name').max(255),
          phoneNumber: Yup.string()
            .trim()
            .required('Phone number is required')
            .test('valid-phone', 'Enter a complete, valid US phone number', validPhone)
        })}
        onSubmit={(values, { setSubmitting }) => {
          onNext({
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            phoneNumber: values.phoneNumber.trim(),
            organizationName: values.organizationName.trim()
          });
          setSubmitting(false);
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, setFieldValue, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {googleProfile && (initialFirstName.trim() || initialLastName.trim()) && (
                <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Google profile
                  </Typography>
                  <Typography fontWeight={600}>{[initialFirstName.trim(), initialLastName.trim()].filter(Boolean).join(' ')}</Typography>
                </Box>
              )}
              {!googleHasName && nameFields.length > 0 && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  {nameFields.map(([name, label]) => (
                    <Box key={name} sx={{ flex: 1 }}>
                      <Typography component="label" htmlFor={`personal-${name}`} variant="body2" fontWeight={600}>
                        {label}
                      </Typography>
                      <OutlinedInput
                        id={`personal-${name}`}
                        name={name}
                        value={values[name]}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        fullWidth
                        error={Boolean(touched[name] && errors[name])}
                        inputProps={{ maxLength: 100 }}
                        sx={{ mt: 0.75 }}
                      />
                      {touched[name] && errors[name] && <FormHelperText error>{errors[name]}</FormHelperText>}
                    </Box>
                  ))}
                </Stack>
              )}
              <Box>
                <Typography component="label" htmlFor="workspace-name" variant="body2" fontWeight={600}>
                  Workspace or business name
                </Typography>
                <OutlinedInput
                  id="workspace-name"
                  name="organizationName"
                  value={values.organizationName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  fullWidth
                  error={Boolean(touched.organizationName && errors.organizationName)}
                  inputProps={{ maxLength: 255 }}
                  placeholder="Example: Oak Street Rentals"
                  sx={{ mt: 0.75 }}
                />
                {touched.organizationName && errors.organizationName ? (
                  <FormHelperText error>{errors.organizationName}</FormHelperText>
                ) : (
                  <FormHelperText>This is how your portfolio will be identified in Property Peace.</FormHelperText>
                )}
              </Box>
              <Box>
                <Typography component="label" htmlFor="personal-phone" variant="body2" fontWeight={600}>
                  Phone number
                </Typography>
                <OutlinedInput
                  id="personal-phone"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  value={values.phoneNumber}
                  onChange={(event) => setFieldValue('phoneNumber', formatPhoneInput(event.target.value))}
                  onBlur={handleBlur}
                  fullWidth
                  error={Boolean(touched.phoneNumber && errors.phoneNumber)}
                  inputProps={{ inputMode: 'tel', maxLength: 18 }}
                  placeholder="(555) 555-5555"
                  sx={{ mt: 0.75 }}
                />
                {touched.phoneNumber && errors.phoneNumber ? (
                  <FormHelperText error>{errors.phoneNumber}</FormHelperText>
                ) : (
                  <FormHelperText>Required. Enter a complete 10-digit US number, including area code.</FormHelperText>
                )}
              </Box>
              {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}
              <Button
                fullWidth
                size="large"
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                sx={{ py: 1.4, textTransform: 'none', fontWeight: 700 }}
              >
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                By creating an account, you agree to our{' '}
                <Link component={RouterLink} to="/terms">
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link component={RouterLink} to="/privacy">
                  Privacy Policy
                </Link>
                .
              </Typography>
            </Stack>
          </form>
        )}
      </Formik>
    </Box>
  );
}

LandlordPersonalInfoStep.propTypes = {
  initialFirstName: PropTypes.string,
  initialLastName: PropTypes.string,
  initialPhoneNumber: PropTypes.string,
  initialOrganizationName: PropTypes.string,
  googleProfile: PropTypes.bool,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func
};
