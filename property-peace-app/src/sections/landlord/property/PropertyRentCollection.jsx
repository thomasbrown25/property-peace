import { Box, Grid, Stack, Typography, Card, CardContent, Button, alpha, useTheme } from '@mui/material';
import { DollarOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import { useNavigate } from 'react-router-dom';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import CircularLoader from 'components/CircularLoader';
import { propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyRentCollection({ propertyId }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { summary, loading } = useFetchRentCollection(propertyId);
  
  // Get values from summary
  const collectedThisMonth = summary?.collectedThisMonth || 0;
  const overdue = summary?.overdue || 0;
  const expectedThisMonth = summary?.expectedThisMonth || 0;

  // Get current month name for title
  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const rentCollectionTitle = `${currentMonth} Payments`;

  return (
    <MainCard
      title={rentCollectionTitle}
      sx={propertyAccentCardSx(theme.palette.success.main, {
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
      })}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularLoader />
        </Box>
      ) : (
        <Stack spacing={3}>
          {/* Expected this month */}
          {expectedThisMonth > 0 && (
            <Stack direction="row" justifyContent="space-between" alignItems="center"
              sx={{ px: 1.5, py: 1, borderRadius: 1, bgcolor: (t) => alpha(t.palette.divider, 0.4) }}
            >
              <Typography variant="body2" color="text.secondary">Expected this month</Typography>
              <Typography variant="body2" fontWeight={600} color="text.primary">{formatCurrency(expectedThisMonth)}</Typography>
            </Stack>
          )}

          {/* Rent Collected and Past Due Cards */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                sx={{
                  bgcolor: collectedThisMonth > 0
                    ? (t) => alpha(t.palette.success.main, 0.08)
                    : (t) => alpha(t.palette.divider, 0.3),
                  border: collectedThisMonth > 0
                    ? `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                    : `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                  boxShadow: (t) => t.palette.mode === 'dark' ? `0 10px 24px ${alpha(theme.palette.success.main, 0.12)}` : 'none',
                  height: '100%'
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Rent Collected
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={collectedThisMonth > 0 ? 'success.main' : 'text.secondary'}>
                      {formatCurrency(collectedThisMonth)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                sx={{
                  bgcolor: (t) => alpha(t.palette.error.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                  boxShadow: (t) => t.palette.mode === 'dark' ? `0 10px 24px ${alpha(theme.palette.error.main, 0.12)}` : 'none',
                  height: '100%'
                }}
              >
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Past Due
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="error.main">
                      {formatCurrency(overdue)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<DollarOutlined />}
              onClick={() => {
                // Navigate to record payment page or open modal
                navigate(`/landlord/property/${propertyId}?tab=leases`);
              }}
              sx={{
                textTransform: 'none'
              }}
            >
              Record Payment
            </Button>
            <Button
              variant="contained"
              fullWidth
              startIcon={<DollarOutlined />}
              onClick={() => {
                // Navigate to set up payments page or open modal
                navigate(`/landlord/property/${propertyId}?tab=leases`);
              }}
              sx={{
                textTransform: 'none'
              }}
            >
              Set Up Payments
            </Button>
          </Stack>
        </Stack>
      )}
    </MainCard>
  );
}
