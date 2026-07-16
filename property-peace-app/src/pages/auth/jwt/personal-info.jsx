import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Box } from '@mui/material';
import { Typography } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import PersonalInfoForm from 'sections/auth/jwt/PersonalInfoForm';
import axiosServices from 'utils/axios';

// ================================|| JWT - PERSONAL INFO ||================================ //

export default function PersonalInfo() {
  const { isLoggedIn, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [googleData, setGoogleData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const source = searchParams.get('source');
    
    if (source === 'google') {
      // Get Google token from sessionStorage
      const googleToken = sessionStorage.getItem('googleAccessToken');
      if (!googleToken) {
        navigate('/register');
        return;
      }

      // Fetch Google user info
      const fetchGoogleData = async () => {
        try {
          const response = await axiosServices.post('/api/user/google-user-info', {
            accessToken: googleToken
          });
          
          if (response.data?.success) {
            setGoogleData(response.data.data);
            // Pre-fill email if available
            if (response.data.data?.email) {
              sessionStorage.setItem('registerEmail', response.data.data.email);
            }
          }
        } catch (err) {
          console.error('Error fetching Google data:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchGoogleData();
    } else {
      // Email registration flow - check if we have email and password
      const email = sessionStorage.getItem('registerEmail');
      const password = sessionStorage.getItem('registerPassword');
      
      if (!email || !password) {
        navigate('/register');
        return;
      }
      setLoading(false);
    }
  }, [navigate, searchParams, isLoggedIn, user]);

  if (loading) {
    return (
      <AuthWrapper splitScreen>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>Loading...</Typography>
        </Box>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper splitScreen>
      <PersonalInfoForm googleData={googleData} />
    </AuthWrapper>
  );
}

