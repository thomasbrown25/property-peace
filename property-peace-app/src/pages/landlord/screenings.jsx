import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Stack, Button, Card, CardContent, Link, useTheme, alpha } from '@mui/material';
import { CheckCircleOutlined, LinkOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import ScreeningsHeader from 'sections/landlord/screenings/ScreeningsHeader';
import { openSnackbar } from 'api/snackbar';
import { useDispatch } from 'react-redux';
import { updateLease } from 'store/lease/lease.action';
import useFetchProperties from 'hooks/useFetchProperties';

export default function ScreeningsPage() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leaseId = searchParams.get('leaseId') ? parseInt(searchParams.get('leaseId')) : null;
  const { properties, propertiesRefetch } = useFetchProperties();
  const [isCompleted, setIsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Find the lease from properties to check if screening is already complete
  useEffect(() => {
    if (leaseId && properties) {
      for (const property of properties) {
        if (property.units) {
          for (const unit of property.units) {
            const unitLease = unit.lease || unit.Lease;
            if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
              const screeningComplete = unitLease.isScreeningComplete || unitLease.IsScreeningComplete;
              if (screeningComplete) {
                setIsCompleted(true);
              }
              break;
            }
          }
        }
      }
    }
  }, [leaseId, properties]);

  const handleComplete = async () => {
    if (!leaseId) {
      openSnackbar({
        open: true,
        message: 'No lease specified. Please access this page from a lease.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setSaving(true);
    try {
      // Find the lease to get its current data
      let leaseData = null;
      for (const property of properties || []) {
        if (property.units) {
          for (const unit of property.units) {
            const unitLease = unit.lease || unit.Lease;
            if (unitLease && (unitLease.id === leaseId || unitLease.Id === leaseId)) {
              leaseData = unitLease;
              break;
            }
          }
        }
        if (leaseData) break;
      }

      if (!leaseData) {
        throw new Error('Lease not found');
      }

      // Update the lease with screening complete flag
      const updatedLease = {
        id: leaseData.id || leaseData.Id,
        propertyId: leaseData.propertyId || leaseData.PropertyId,
        unitId: leaseData.unitId || leaseData.UnitId,
        name: leaseData.name || leaseData.Name,
        startDate: leaseData.startDate || leaseData.StartDate,
        endDate: leaseData.endDate || leaseData.EndDate,
        rentAmount: leaseData.rentAmount || leaseData.RentAmount,
        depositAmount: leaseData.depositAmount || leaseData.DepositAmount,
        leaseLength: leaseData.leaseLength || leaseData.LeaseLength,
        rentFrequency: leaseData.rentFrequency || leaseData.RentFrequency,
        rentDueDay: leaseData.rentDueDay || leaseData.RentDueDay,
        isActive: leaseData.isActive !== false,
        isDrafted: leaseData.isDrafted || leaseData.IsDrafted,
        isScreeningComplete: true, // Mark screening as complete
        organizationId: leaseData.organizationId || leaseData.OrganizationId
      };

      const result = await dispatch(updateLease(updatedLease));

      if (result?.success) {
        setIsCompleted(true);
        await propertiesRefetch(); // Refresh properties to get updated lease data
        openSnackbar({
          open: true,
          message: 'Screening step marked as complete',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Navigate back to the lease page if we came from there
        if (leaseId) {
          setTimeout(() => {
            navigate(`/landlord/leases/${leaseId}`);
          }, 1000);
        }
      } else {
        throw new Error(result?.message || 'Failed to update lease');
      }
    } catch (error) {
      console.error('Error marking screening as complete:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to mark screening as complete',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const smartMoveUrl = 'https://www.mysmartmove.com/?utm_source=google&utm_medium=cpc&utm_campaign=WP+%7C+GG+%7C+S+%7C+SM+%7C+Brand+Core+AdCopyRefresh+4.26&utm_content=Transunion&utm_keyword=transunion%20smartmove&utm_matchtype=e&gad_source=1&gad_campaignid=661926470&gbraid=0AAAAADsZIDD-4nxySSjFph5Esv5M5NByZ&gclid=CjwKCAiAqKbMBhBmEiwAZ3UboEJN4n1aM8Aj9fSJo7It6zX43LB1DuAo2gZHsvVqmCCmjE0votQSpRoCIPsQAvD_BwE';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 4 }}>
      <ScreeningsHeader />

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2
        }}
      >
        <CardContent>
          <Stack spacing={3} sx={{ textAlign: 'center', alignItems: 'center' }}>
            <Box sx={{ maxWidth: 800 }}>
              <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
                Tenant Screening Integration
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                We are currently in the process of integrating a comprehensive tenant screening solution directly into our platform. 
                This will allow you to view and manage background checks, credit reports, and other screening information for your tenants all in one place.
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                In the meantime, you can use <strong>TransUnion SmartMove</strong> to screen your tenants. SmartMove provides comprehensive 
                tenant screening reports including credit checks, criminal background checks, eviction history, and income verification.
              </Typography>
            </Box>

            <Card
              variant="outlined"
              sx={{
                bgcolor: alpha(theme.palette.info.main, 0.05),
                borderColor: alpha(theme.palette.info.main, 0.2),
                borderWidth: 2,
                maxWidth: 800,
                width: '100%'
              }}
            >
              <CardContent>
                <Stack spacing={2} sx={{ textAlign: 'center', alignItems: 'center' }}>
                  <Typography variant="h6" fontWeight={600} color="info.main">
                    TransUnion SmartMove
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Get critical tenant screening information from a trusted source. SmartMove offers:
                  </Typography>
                  <Box component="ul" sx={{ pl: 0, mb: 0, listStyle: 'none', textAlign: 'center', maxWidth: 600 }}>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      • ResidentScore® - Predicts rental eviction risk 15% better than traditional credit scores
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      • Credit Reports - Full credit history and scores
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      • Criminal Background Checks - Comprehensive criminal record searches
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      • Eviction History - Check for past eviction records
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      • Income Insights - Verify applicant income and employment
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<LinkOutlined />}
                    href={smartMoveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      textTransform: 'none',
                      mt: 1
                    }}
                  >
                    Visit TransUnion SmartMove
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </CardContent>
      </MainCard>
    </Box>
  );
}
