import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import useAuth from 'hooks/useAuth';
import { formatPhoneInput } from 'utils/formatters';

// ============================|| ORGANIZATION FORM ||============================ //

export default function OrganizationForm({ onSuccess, showBackButton = true, onBack, hideStepper = false, collectPhoneNumber = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get stored data from sessionStorage or from logged-in user
  const email = user?.Email || user?.email || sessionStorage.getItem('registerEmail') || '';
  const firstName = user?.FirstName || user?.firstName || user?.Firstname || user?.firstname || sessionStorage.getItem('registerFirstName') || '';
  const lastName = user?.LastName || user?.lastName || user?.Lastname || user?.lastname || sessionStorage.getItem('registerLastName') || '';
  const phoneNumber = user?.PhoneNumber || user?.phoneNumber || sessionStorage.getItem('registerPhoneNumber') || '';

  // Keep this step focused on business setup. Google signup should not default the business name to the user's personal name.
  const initialOrganizationName = user?.BusinessName || user?.businessName || sessionStorage.getItem('registerOrganizationName') || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ width: '100%' }}
    >
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

        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        >
          {/* Pull up when Back is present so title aligns with "Sign up for Property Peace" */}
          <Box sx={{ textAlign: 'center', mb: 2, mt: showBackButton ? { xs: -3, sm: -3, md: -8 } : { xs: 6, sm: 6, md: 0 } }}>
            {showBackButton && (
              <Box sx={{ textAlign: 'left', mb: 2 }}>
                <Button
                  startIcon={<ArrowLeftOutlined />}
                  onClick={() => onBack ? onBack() : navigate('/register/personal-info')}
                  variant="text"
                  color="inherit"
                  sx={{ mb: 2, p: 0, minWidth: 'auto' }}
                >
                  Back
                </Button>
              </Box>
            )}
            <Typography variant="h3" sx={{ fontWeight: 600, mb: 1, textAlign: 'center', fontSize: { xs: '1.875rem', md: '2rem' }, color: '#061e35' }}>
              What is the name of your business?
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, textAlign: 'center' }}>
              This name will be used to organize your properties and team members in Property Peace.
            </Typography>
          </Box>
        </motion.div>

      <Formik
        initialValues={{
          organizationName: initialOrganizationName,
          phoneNumber,
          submit: null
        }}
        validationSchema={Yup.object().shape({
          organizationName: Yup.string().max(255).required('Business name is required'),
          phoneNumber: collectPhoneNumber ? Yup.string().trim().max(50).required('Phone number is required') : Yup.string().nullable().max(50)
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            sessionStorage.setItem('registerOrganizationName', values.organizationName.trim());
            if (collectPhoneNumber) {
              sessionStorage.setItem('registerPhoneNumber', values.phoneNumber?.trim() || '');
            }

            if (!email || !firstName || !lastName) {
              throw new Error('Missing required registration information');
            }

            if (onSuccess) onSuccess();
          } catch (err) {
            setErrors({ submit: err.message || 'Please complete all required steps first.' });
          }
          setSubmitting(false);
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values, setFieldValue }) => (
          <>
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {/* Organization Name */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
              >
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                    Business Name
                  </Typography>
                  <OutlinedInput
                    id="organization-name-signup"
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
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 0, 0, 0.3)'
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main'
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main'
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                    {touched.organizationName && errors.organizationName ? (
                      <FormHelperText error>{errors.organizationName}</FormHelperText>
                    ) : (
                      <Box />
                    )}
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {values.organizationName.length} / 255
                    </Typography>
                  </Box>
                </Box>
              </motion.div>

              {collectPhoneNumber && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary', fontWeight: 500 }}>
                      Phone
                    </Typography>
                    <OutlinedInput
                      id="business-phone-signup"
                      type="tel"
                      value={values.phoneNumber || ''}
                      name="phoneNumber"
                      onBlur={handleBlur}
                      onChange={(e) => setFieldValue('phoneNumber', formatPhoneInput(e.target.value))}
                      placeholder=""
                      fullWidth
                      size="medium"
                      error={Boolean(touched.phoneNumber && errors.phoneNumber)}
                      inputProps={{ maxLength: 50 }}
                      sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(0, 0, 0, 0.3)'
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main'
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'primary.main'
                        }
                      }}
                    />
                    {touched.phoneNumber && errors.phoneNumber && (
                      <FormHelperText error sx={{ mt: 0.5 }}>
                        {errors.phoneNumber}
                      </FormHelperText>
                    )}
                  </Box>
                </motion.div>
              )}

              {/* Error Messages */}
              {errors.submit && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <FormHelperText error>{errors.submit}</FormHelperText>
                </motion.div>
              )}

              {/* Continue Button - padding so hover scale isn't clipped */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.4 }}
              >
                <Box sx={{ py: 0.5, overflow: 'visible' }}>
                  <AnimateButton>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Button
                      disableElevation
                      disabled={isSubmitting}
                      size="large"
                      type="submit"
                      variant="contained"
                      color="primary"
                      startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        py: 1.5,
                        px: 6,
                        minWidth: 250,
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        }
                      }}
                    >
                      Continue
                    </Button>
                  </Box>
                </AnimateButton>
                </Box>
              </motion.div>
            </Stack>
          </form>
          </>
        )}
      </Formik>
      </Box>
    </motion.div>
  );
}
