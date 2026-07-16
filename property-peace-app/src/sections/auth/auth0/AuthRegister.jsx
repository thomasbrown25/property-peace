import { useState } from 'react';

// material-ui
import { Button } from '@mui/material';
import { FormHelperText } from '@mui/material';
import { Grid } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import useScriptRef from 'hooks/useScriptRef';
import AnimateButton from 'components/@extended/AnimateButton';

// assets
import UserAddOutlined from '@ant-design/icons/UserAddOutlined';

// ============================|| AUTH0 - REGISTER ||============================ //

const AuthRegister = () => {
  const { loginAuth } = useAuth();
  const scriptedRef = useScriptRef();

  const [error, setError] = useState(null);
  const loginHandler = async () => {
    try {
      if (loginAuth) await loginAuth();
    } catch (err) {
      if (scriptedRef.current) {
        setError(err.message);
      }
    }
  };

  return (
    <Grid container justifyContent="center" alignItems="center" spacing={2}>
      {error && (
        <Grid size={12}>
          <FormHelperText error>{error}</FormHelperText>
        </Grid>
      )}
      <Grid size={12}>
        <AnimateButton>
          <Button onClick={loginHandler} variant="contained" fullWidth startIcon={<UserAddOutlined />}>
            Sing up with Auth0
          </Button>
        </AnimateButton>
      </Grid>
    </Grid>
  );
};

export default AuthRegister;
