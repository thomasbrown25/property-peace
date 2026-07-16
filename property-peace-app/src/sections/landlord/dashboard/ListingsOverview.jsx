import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { alpha, Box, Button, Card, Grid, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import CircularLoader from 'components/CircularLoader';
import listingApi from 'api/listing';
import { RocketOutlined, PlusOutlined } from '@ant-design/icons';

const STATUS_MAP = { 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' };

function statusLabel(status) {
  if (typeof status === 'string') return status;
  return STATUS_MAP[status] ?? 'Draft';
}

export default function ListingsOverview() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await listingApi.getListings();
        if (cancelled) return;
        const data = res?.data ?? res;
        setListings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const draftCount = listings.filter((l) => statusLabel(l.status) === 'Draft').length;
  const activeCount = listings.filter((l) => statusLabel(l.status) === 'Active').length;
  const total = listings.length;

  const StatCard = ({ title, value, color, onClick }) => (
    <Card
      onClick={onClick}
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        borderRadius: 2,
        p: 3,
        height: '100%',
        minHeight: 140,
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
        '&:hover': {
          boxShadow: onClick ? `0 4px 12px ${alpha(color, 0.15)}` : undefined,
          transform: onClick ? 'translateY(-2px) scale(1.02)' : 'none'
        }
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
            {title}
          </Typography>
        </Stack>
        <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary', fontSize: '1.5rem', lineHeight: 1.2 }}>
          {value}
        </Typography>
      </Stack>
    </Card>
  );

  return (
    <MainCard
      title="Listings Overview"
      sx={{ transition: 'all 0.2s ease' }}
      secondary={
        <Button
          variant="contained"
          size="small"
          startIcon={<PlusOutlined />}
          onClick={() => navigate('/landlord/listings/add')}
          sx={{ textTransform: 'none' }}
        >
          Create listing
        </Button>
      }
    >
      {loading ? (
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader />
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12 }}>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 6, sm: 6, md: 4 }}>
                <StatCard
                  title="Total listings"
                  value={total}
                  color={theme.palette.primary.main}
                  onClick={() => navigate('/landlord/listings')}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 6, md: 4 }}>
                <StatCard
                  title="Active"
                  value={activeCount}
                  color={theme.palette.success.main}
                  onClick={() => navigate('/landlord/listings?status=active')}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 6, md: 4 }}>
                <StatCard
                  title="Draft"
                  value={draftCount}
                  color={theme.palette.grey[600]}
                  onClick={() => navigate('/landlord/listings?status=draft')}
                />
              </Grid>
            </Grid>
          </Grid>
          {total === 0 && (
            <Grid size={{ xs: 12 }}>
              <Box
                sx={{
                  py: 4,
                  px: 3,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: `1px dashed ${alpha(theme.palette.divider, 0.5)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.03)
                }}
              >
                <RocketOutlined style={{ fontSize: 40, color: theme.palette.primary.main, marginBottom: 12 }} />
                <Typography variant="subtitle1" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>
                  No listings yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create a listing to market your property and receive applications.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<PlusOutlined />}
                  onClick={() => navigate('/landlord/listings/add')}
                  sx={{ textTransform: 'none' }}
                >
                  Create your first listing
                </Button>
              </Box>
            </Grid>
          )}
        </Grid>
      )}
    </MainCard>
  );
}
