import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert
} from '@mui/material';
import { CheckCircleOutlined, HomeOutlined } from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';

export default function LeaseAddedPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lease, setLease] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLease = async () => {
      if (!isLoggedIn || !user) {
        // If not logged in, store the leaseId in localStorage and redirect to login
        if (leaseId) {
          localStorage.setItem('pendingLeaseAdded', leaseId);
        }
        navigate('/login', { state: { returnUrl: `/tenant/lease-added/${leaseId}` } });
        return;
      }

      try {
        setLoading(true);
        const response = await axiosServices.get(`/api/lease/${leaseId}`);
        
        if (response.data?.success && response.data?.data) {
          setLease(response.data.data);
        } else {
          setError('Lease not found');
        }
      } catch (err) {
        console.error('Error fetching lease:', err);
        setError('Failed to load lease information');
      } finally {
        setLoading(false);
      }
    };

    fetchLease();
  }, [leaseId, isLoggedIn, user, navigate]);

  const handleViewLease = () => {
    navigate('/tenant/lease');
  };

  const handleGoToDashboard = () => {
    navigate('/tenant/dashboard');
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          p: 3
        }}
      >
        <Card sx={{ maxWidth: 500, width: '100%' }}>
          <CardContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/tenant/dashboard')}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const propertyName = lease?.propertyName || 'the property';
  const unitName = lease?.unitName ? ` - ${lease.unitName}` : '';

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        p: 3
      }}
    >
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleOutlined
            style={{
              fontSize: 64,
              color: '#4caf50',
              marginBottom: 24
            }}
          />
          <Typography variant="h4" gutterBottom fontWeight={600}>
            New Lease Added
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            You've been added to a lease for <strong>{propertyName}{unitName}</strong>.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            You can now access lease information, payment history, and submit maintenance requests for this property.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              startIcon={<HomeOutlined />}
              onClick={handleViewLease}
            >
              View Lease
            </Button>
            <Button
              variant="outlined"
              onClick={handleGoToDashboard}
            >
              Go to Dashboard
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
