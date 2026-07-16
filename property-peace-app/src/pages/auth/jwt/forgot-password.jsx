import { useSearchParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Button } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import AuthForgotPassword from 'sections/auth/jwt/AuthForgotPassword';
import AnimateButton from 'components/@extended/AnimateButton';

// ================================|| JWT - FORGOT PASSWORD ||================================ //

export default function ForgotPassword() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const auth = searchParams.get('auth'); // get auth and set route based on that

  const handleBackToLogin = () => {
    const loginPath = isLoggedIn ? '/auth/login' : auth ? `/${auth}/login?auth=jwt` : '/login';
    navigate(loginPath);
  };

  return (
    <AuthWrapper>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: { xs: -0.5, sm: 0.5 } }}>
            <Typography variant="h3">Forgot Password</Typography>
            <AnimateButton>
              <Button
                disableElevation
                size="medium"
                variant="outlined"
                onClick={handleBackToLogin}
                sx={{
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
              >
                Back to Login
              </Button>
            </AnimateButton>
          </Stack>
        </Grid>
        <Grid size={12}>
          <AuthForgotPassword />
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}
