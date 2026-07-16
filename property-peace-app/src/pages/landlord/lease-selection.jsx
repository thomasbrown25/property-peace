import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ==============================|| LEASE SELECTION PAGE ||============================== //
// NOTE: This page now redirects directly to the single lease builder.
// Bulk lease functionality has been commented out but preserved for reference.

export default function LeaseSelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Redirect directly to single lease builder
    const propertyId = searchParams.get('propertyId');
    const unitId = searchParams.get('unitId');
    
    let url = '/landlord/leases/builder';
    const params = new URLSearchParams();
    if (propertyId) params.append('propertyId', propertyId);
    if (unitId) params.append('unitId', unitId);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    navigate(url, { replace: true });
  }, [navigate, searchParams]);

  // This component now just redirects, so return null
  return null;

  /* BULK LEASE CODE - COMMENTED OUT BUT PRESERVED FOR REFERENCE
  const handleBulkLease = () => {
    navigate('/landlord/leases/builder-bulk');
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h3" align="center" sx={{ mb: 1 }}>
          Create Lease
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Choose how you'd like to create your lease
        </Typography>

        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
              onClick={handleSingleLease}
            >
              <CardContent sx={{ flexGrow: 1, p: 4 }}>
                <Stack spacing={3} alignItems="center" textAlign="center">
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      bgcolor: 'primary.lighter',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FileTextOutlined style={{ fontSize: 40, color: 'inherit' }} />
                  </Box>
                  <Typography variant="h5" fontWeight="bold">
                    Create Single Lease
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create a lease for one unit at a time. Perfect for individual lease agreements with detailed customization.
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    startIcon={<FileTextOutlined />}
                    sx={{ mt: 2 }}
                  >
                    Get Started
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
              onClick={handleBulkLease}
            >
              <CardContent sx={{ flexGrow: 1, p: 4 }}>
                <Stack spacing={3} alignItems="center" textAlign="center">
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      bgcolor: 'success.lighter',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <AppstoreOutlined style={{ fontSize: 40, color: 'inherit' }} />
                  </Box>
                  <Typography variant="h5" fontWeight="bold">
                    Create Lease in Bulk
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create multiple leases at once using templates. Efficiently manage leases for multiple units with shared terms.
                  </Typography>
                  <Button
                    variant="contained"
                    color="success"
                    fullWidth
                    size="large"
                    startIcon={<AppstoreOutlined />}
                    sx={{ mt: 2 }}
                  >
                    Get Started
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
  */
}
