import PropTypes from 'prop-types';
import { motion } from 'framer-motion';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';

// third-party
import * as Yup from 'yup';
import { formatPhoneInput } from 'utils/formatters';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';

// ============================|| LANDLORD PERSONAL INFO STEP ||============================ //

/**
 * Personal/business info step for landlord registration.
 * Pre-fill from Google when coming from source=google.
 */
export default function LandlordPersonalInfoStep({
  initialFirstName = '',
  initialLastName = '',
  initialPhoneNumber = '',
  initialOrganizationName = '',
  onNext,
  onBack,
  hideStepper = true
}) {
  return (
    <Box
      sx={{
        width: '100%',
        minWidth: { xs: '100%', sm: 400 },
        maxWidth: { xs: '100%', sm: 400 },
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}
    >
      {/* Pull up when Back is present so title aligns with "Sign up for Property Peace" */}
      <Box sx={{ textAlign: 'center', mb: 2, mt: onBack ? { xs: -3, sm: -3, md: -8 } : { xs: 6, sm: 6, md: 0 } }}>
        {onBack && (
          <Box sx={{ textAlign: 'left', mb: 2 }}>
            <Button
              startIcon={<ArrowLeftOutlined />}
              onClick={onBack}
              variant="text"
              color="inherit"
              sx={{ mb: 2, p: 0, minWidth: 'auto' }}
            >
              Back
            </Button>
          </Box>
        )}
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 1, textAlign: 'center', fontSize: { xs: '1.875rem', md: '2rem' }, color: '#061e35' }}>
          Personal information
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Confirm your details so we can create your Property Peace account.
        </Typography>
      </Box>

      <Formik
        initialValues={{
          firstName: initialFirstName,
          lastName: initialLastName,
          phoneNumber: initialPhoneNumber,
          organizationName: initialOrganizationName,
          submit: null
        }}
        enableReinitialize
        validationSchema={Yup.object().shape({
          firstName: Yup.string().max(255).required('First name is required'),
          lastName: Yup.string().max(255).required('Last name is required'),
          phoneNumber: Yup.string().trim().max(50).required('Phone number is required'),
          organizationName: Yup.string().trim().max(255).required('Business name is required')
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            const payload = {
              firstName: values.firstName.trim(),
              lastName: values.lastName.trim(),
              phoneNumber: values.phoneNumber.trim(),
              organizationName: values.organizationName.trim()
            };
            if (onNext) onNext(payload);
            setSubmitting(false);
          } catch (err) {
            setErrors({ submit: err?.message || 'An error occurred. Please try again.' });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values, setFieldValue }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                  First Name
                </Typography>
                <OutlinedInput
                  id="personal-first-name"
                  type="text"
                  value={values.firstName}
                  name="firstName"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder=""
                  fullWidth
                  size="medium"
                  error={Boolean(touched.firstName && errors.firstName)}
                  inputProps={{ maxLength: 255 }}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                  }}
                />
                {touched.firstName && errors.firstName && (
                  <FormHelperText error>{errors.firstName}</FormHelperText>
                )}
              </Box>

              <Box>
                <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                  Last Name
                </Typography>
                <OutlinedInput
                  id="personal-last-name"
                  type="text"
                  value={values.lastName}
                  name="lastName"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder=""
                  fullWidth
                  size="medium"
                  error={Boolean(touched.lastName && errors.lastName)}
                  inputProps={{ maxLength: 255 }}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                  }}
                />
                {touched.lastName && errors.lastName && (
                  <FormHelperText error>{errors.lastName}</FormHelperText>
                )}
              </Box>

              <Box>
                <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                  Phone
                </Typography>
                <OutlinedInput
                  id="personal-phone"
                  type="tel"
                  value={values.phoneNumber}
                  name="phoneNumber"
                  onBlur={handleBlur}
                  onChange={(e) => {
                    const formatted = formatPhoneInput(e.target.value);
                    setFieldValue('phoneNumber', formatted);
                  }}
                  placeholder=""
                  fullWidth
                  size="medium"
                  error={Boolean(touched.phoneNumber && errors.phoneNumber)}
                  inputProps={{ maxLength: 50 }}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                  }}
                />
                {touched.phoneNumber && errors.phoneNumber && (
                  <FormHelperText error>{errors.phoneNumber}</FormHelperText>
                )}
              </Box>

              <Box>
                <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                  Business Name
                </Typography>
                <OutlinedInput
                  id="personal-business-name"
                  type="text"
                  value={values.organizationName}
                  name="organizationName"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder=""
                  fullWidth
                  size="medium"
                  error={Boolean(touched.organizationName && errors.organizationName)}
                  inputProps={{ maxLength: 255 }}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 0, 0, 0.3)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                  }}
                />
                {touched.organizationName && errors.organizationName && (
                  <FormHelperText error>{errors.organizationName}</FormHelperText>
                )}
              </Box>

              {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}

              <Box sx={{ py: 0.5, overflow: 'visible' }}>
                <AnimateButton>
                  <Button
                    disableElevation
                    fullWidth
                    size="large"
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    sx={{
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      py: 1.5
                    }}
                  >
                    Continue
                  </Button>
                </AnimateButton>
              </Box>
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
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func,
  hideStepper: PropTypes.bool
};
