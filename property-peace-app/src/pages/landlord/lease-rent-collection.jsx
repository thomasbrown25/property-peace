import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';

export default function LeaseRentCollection() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const [selectedMethod, setSelectedMethod] = useState(null);

  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
  };

  const handleNext = async () => {
    if (!selectedMethod) return;

    try {
      // TODO: Save the selected rent collection method to the lease
      if (selectedMethod === 'through-platform') {
        // If they selected "through Property Peace", navigate to payment setup
        navigate(`/landlord/leases/${leaseId}/payment-setup`);
      } else {
        // If they selected "outside platform", just mark as complete and go back
        openSnackbar({
          open: true,
          message: 'Rent collection method saved successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        navigate(`/landlord/leases/${leaseId}`);
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: 'Failed to save rent collection method',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleBack = () => {
    navigate(`/landlord/leases/${leaseId}/charges`);
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Leases', path: '/landlord/leases' },
          { label: 'Set Up Rent Collection' }
        ]}
      />

      <Stack spacing={3} sx={{ mt: 3, maxWidth: 800, mx: 'auto' }}>
        {/* Heading Card */}
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Button
              variant="text"
              startIcon={<ArrowLeftOutlined />}
              onClick={handleBack}
              sx={{ textTransform: 'none', minWidth: 'auto', p: 0 }}
            >
              Back
            </Button>
          </Stack>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>
            How will you collect rent?
          </Typography>
        </MainCard>

        {/* Payment Method Options */}
        <Stack spacing={2}>
          {/* Option 1: Payments through Property Peace */}
          <Card
            onClick={() => handleMethodSelect('through-platform')}
            sx={{
              cursor: 'pointer',
              border: `2px solid ${selectedMethod === 'through-platform' ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)}`,
              bgcolor: 'white',
              borderRadius: 2,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: theme.palette.primary.main
              }
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Checkbox
                  checked={selectedMethod === 'through-platform'}
                  onChange={() => handleMethodSelect('through-platform')}
                  sx={{ mt: -1 }}
                />
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="h6" fontWeight={600}>
                      Payments through Property Peace
                    </Typography>
                    <Chip
                      label="RECOMMENDED"
                      size="small"
                      sx={{
                        bgcolor: '#ff9800',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        height: 22
                      }}
                    />
                  </Stack>
                  <Stack spacing={0.5} sx={{ ml: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      • ACH/direct deposit
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Debit or credit card
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* Option 2: Methods outside of Property Peace */}
          <Card
            onClick={() => handleMethodSelect('outside-platform')}
            sx={{
              cursor: 'pointer',
              border: `2px solid ${selectedMethod === 'outside-platform' ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)}`,
              bgcolor: 'white',
              borderRadius: 2,
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: theme.palette.primary.main
              }
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Checkbox
                  checked={selectedMethod === 'outside-platform'}
                  onChange={() => handleMethodSelect('outside-platform')}
                  sx={{ mt: -1 }}
                />
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight={600}>
                    Methods outside of Property Peace
                  </Typography>
                  <Stack spacing={0.5} sx={{ ml: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      • Cash, check, payment apps, voucher, money order, etc.
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        {/* Next Button */}
        {selectedMethod && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
            <Button
              variant="contained"
              onClick={handleNext}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                px: 4,
                py: 1.5,
                minWidth: 200
              }}
            >
              NEXT
            </Button>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
