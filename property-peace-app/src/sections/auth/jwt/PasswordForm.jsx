import PropTypes from 'prop-types';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { OutlinedInput } from '@mui/material';
import { InputAdornment } from '@mui/material';
import { IconButton } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Stepper, Step, StepLabel } from '@mui/material';

// ant design icons
import { EyeOutlined, EyeInvisibleOutlined, ArrowLeftOutlined } from '@ant-design/icons';

// third-party
import * as Yup from 'yup';
import { Formik } from 'formik';

// project imports
import AnimateButton from 'components/@extended/AnimateButton';
import { passwordRequirementStatuses, validatePassword } from 'utils/password-validation';

// ============================|| PASSWORD FORM ||============================ //

export default function PasswordForm({ email, onNext, onBack, hideStepper = false }) {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (event) => {
    event.preventDefault();
  };

  const steps = ['Account Type', 'Verification', 'Password', 'Personal Info', 'Business Info', 'Complete'];
  const currentStep = 2; // Password is step 3 (0-indexed: 2)

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
      {/* Steps Indicator - Fixed position */}
      {!hideStepper && (
        <Box 
          sx={{ 
            mb: 2,
            pt: 4,
            position: 'relative',
            minHeight: 80, // Fixed height to prevent movement
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Stepper activeStep={currentStep} alternativeLabel sx={{ width: '100%' }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* Welcome Message */}
      <Box sx={{ textAlign: 'center', mb: 2, mt: { xs: 6, sm: 6, md: 0 } }}>
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
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 1, textAlign: 'center' }}>
          Create Your Password
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Choose a secure password for your account
        </Typography>
      </Box>

      <Formik
        initialValues={{
          password: '',
          submit: null
        }}
        validationSchema={Yup.object().shape({
          password: Yup.string()
            .required('Password is required')
            .test('api-password-rules', (value, context) => {
              const message = validatePassword(value || '');
              return message ? context.createError({ message }) : true;
            })
        })}
        onSubmit={async (values, { setErrors, setSubmitting }) => {
          try {
            // Store password in sessionStorage
            sessionStorage.setItem('registerPassword', values.password);
            // Call callback or navigate
            if (onNext) {
              onNext(values.password);
            } else {
              // Navigate to personal info page
              navigate('/register/personal-info');
            }
            setSubmitting(false);
          } catch (err) {
            console.error(err);
            setErrors({ submit: 'An error occurred. Please try again.' });
            setSubmitting(false);
          }
        }}
      >
        {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
          <form noValidate onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {/* Email Display (read-only) */}
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  Email
                </Typography>
                <OutlinedInput
                  value={email}
                  fullWidth
                  size="medium"
                  disabled
                  sx={{
                    bgcolor: 'action.disabledBackground',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider'
                    }
                  }}
                />
              </Box>

              {/* Password Input */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Password
                </Typography>
                <OutlinedInput
                  fullWidth
                  size="medium"
                  error={Boolean(touched.password && errors.password)}
                  id="password-signup"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  name="password"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  placeholder="Your password"
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        onMouseDown={handleMouseDownPassword}
                        edge="end"
                        sx={{ color: 'text.secondary' }}
                      >
                        {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                      </IconButton>
                    </InputAdornment>
                  }
                  sx={{
                    bgcolor: 'background.paper',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'divider'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main'
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main'
                    }
                  }}
                />
                {touched.password && errors.password && (
                  <FormHelperText error sx={{ mt: 0.5 }}>
                    {errors.password}
                  </FormHelperText>
                )}
                {/* Live requirements */}
                {values.password.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {passwordRequirementStatuses(values.password).map(({ label, met }) => (
                      <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.4,
                        px: 1, py: 0.25,
                        bgcolor: met ? 'success.lighter' : 'action.hover',
                        border: '1px solid', borderColor: met ? 'success.light' : 'divider' }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: met ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: met ? 'success.dark' : 'text.disabled' }}>{label}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              {/* Error Messages */}
              {errors.submit && <FormHelperText error>{errors.submit}</FormHelperText>}

              {/* Continue Button */}
              <AnimateButton>
                <Button disableElevation disabled={isSubmitting} fullWidth size="medium" type="submit" variant="contained" color="primary">
                  Continue
                </Button>
              </AnimateButton>
            </Stack>
          </form>
        )}
      </Formik>
    </Box>
  );
}

PasswordForm.propTypes = { 
  email: PropTypes.string.isRequired,
  onNext: PropTypes.func,
  onBack: PropTypes.func,
  hideStepper: PropTypes.bool
};

