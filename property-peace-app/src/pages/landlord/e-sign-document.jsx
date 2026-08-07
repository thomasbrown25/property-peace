import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  alpha,
  useTheme,
  IconButton,
  Tooltip
} from '@mui/material';
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import axiosServices from 'utils/axios';
import { useDispatch } from 'react-redux';
import { setProperty } from 'store/property/property.action';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

export default function ESignDocumentPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { propertyId } = useParams();
  const { presentation: signatureReadiness } = useFeatureReadiness(FEATURE_KEYS.eSignature);
  const [property, setPropertyData] = useState(null);
  const [leases, setLeases] = useState([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch property data
  useEffect(() => {
    const fetchProperty = async () => {
      if (!propertyId) return;
      try {
        const response = await axiosServices.get(`/api/property/${propertyId}`);
        if (response.data?.data) {
          const propData = response.data.data;
          setPropertyData(propData);
          dispatch(setProperty(propData));
        }
      } catch (error) {
        console.error('Error fetching property:', error);
      }
    };
    fetchProperty();
  }, [propertyId, dispatch]);

  // Extract leases directly from property units (no API call needed)
  useEffect(() => {
    if (!property) {
      setLeases([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const leasesFromUnits = [];
      if (property?.units && Array.isArray(property.units)) {
        property.units.forEach((unit) => {
          const unitLease = unit.lease || unit.Lease;
          if (unitLease && (unitLease.id || unitLease.Id)) {
            leasesFromUnits.push(unitLease);
          }
        });
      }
      setLeases(leasesFromUnits);
    } catch (error) {
      console.error('Error extracting leases from property units:', error);
      setLeases([]);
    } finally {
      setLoading(false);
    }
  }, [property]);

  // Format lease display text: "Address - Month Year"
  const formatLeaseDisplayText = (lease) => {
    if (!lease) return '';
    
    // Get start date (prefer startDate, fallback to endDate for display)
    const dateToUse = lease.startDate || lease.StartDate || lease.endDate || lease.EndDate;
    if (!dateToUse) return '';
    
    const date = new Date(dateToUse);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    // Get street address from property (we already have it)
    let streetAddress = property?.streetAddress || '';
    
    // Clean street address (remove city, state, zip)
    let streetOnly = streetAddress || '';
    if (streetOnly.includes(',')) {
      streetOnly = streetOnly.split(',')[0].trim();
    } else {
      const zipCodePattern = /\s+\d{5}(-\d{4})?$/;
      if (zipCodePattern.test(streetOnly)) {
        streetOnly = streetOnly.replace(zipCodePattern, '').trim();
      }
    }
    
    // Add unit name if it's a multi-unit property
    const unitName = lease.unitName || lease.unit?.name || '';
    const propertyType = property?.propertyType?.toLowerCase() || '';
    if (unitName && propertyType !== 'singlefamily' && propertyType !== 'single-family') {
      return `${streetOnly}${streetOnly ? ', ' : ''}${unitName} - ${month} ${year}`;
    }
    
    return `${streetOnly} - ${month} ${year}`;
  };

  // Format lease options for dropdown
  const leaseOptions = useMemo(() => {
    return leases.map(lease => ({
      id: lease.id || lease.Id,
      label: formatLeaseDisplayText(lease),
      lease: lease
    }));
  }, [leases, property]);

  const handleBack = () => {
    navigate(`/landlord/property/${propertyId}`);
  };

  const handleAddNewLease = () => {
    navigate(`/landlord/property/${propertyId}?tab=leases`);
  };

  const handleGetSignedFast = () => {
    if (!signatureReadiness.canInvoke) return;
    if (!selectedLeaseId) {
      // Show error or prompt to select a lease
      return;
    }
    // Navigate to document signing flow or show modal
    // For now, navigate to the lease page
    navigate(`/landlord/leases/${selectedLeaseId}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 4 }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, pt: 3 }}>
        {/* Back Button */}
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={handleBack}
          sx={{
            mb: 3,
            color: 'text.primary',
            textTransform: 'none',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08)
            }
          }}
        >
          BACK
        </Button>

        <Stack spacing={3}>
          <FeatureReadinessNotice presentation={signatureReadiness} featureName="E-signature" />
          {/* Upgrade Panel */}
          {signatureReadiness.canInvoke && (
            <Card
              sx={{
                bgcolor: 'background.paper',
                borderRadius: 2,
                boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.1)}`
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{
                  color: '#1a3a5f',
                  mb: 2
                }}
              >
                Upgrade to Premium now to save time and hassle with e-sign!
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Get documents signed faster when you don't have to meet your tenants in person or deal with a printer.
              </Typography>

              <Typography variant="body1" fontWeight={500} sx={{ mb: 2 }}>
                It takes less than 3 minutes to set up:
              </Typography>

              <Stack spacing={2} sx={{ mb: 4 }}>
                {/* Step 1 */}
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      flexShrink: 0,
                      mt: 0.5
                    }}
                  >
                    1
                  </Box>
                  <Typography variant="body1" sx={{ pt: 0.5 }}>
                    Upload the document(s) and select where everyone signs and dates.
                  </Typography>
                </Stack>

                {/* Step 2 */}
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      flexShrink: 0,
                      mt: 0.5
                    }}
                  >
                    2
                  </Box>
                  <Typography variant="body1" sx={{ pt: 0.5 }}>
                    We send it off to your tenants.
                  </Typography>
                </Stack>

                {/* Step 3 */}
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      flexShrink: 0,
                      mt: 0.5
                    }}
                  >
                    3
                  </Box>
                  <Typography variant="body1" sx={{ pt: 0.5 }}>
                    You sign once they're done, then everyone gets emailed a copy! We'll save it to your account too.
                  </Typography>
                </Stack>
              </Stack>

              {/* Lease Selection */}
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body1" fontWeight={600}>
                    Which lease needs a document signed?
                  </Typography>
                  <Tooltip title="Select a lease to sign a document for">
                    <IconButton size="small" sx={{ p: 0.5 }}>
                      <InfoCircleOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <FormControl fullWidth>
                  <Select
                    value={selectedLeaseId}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__add_new__') {
                        handleAddNewLease();
                        return;
                      }
                      setSelectedLeaseId(value);
                    }}
                    displayEmpty
                    sx={{
                      bgcolor: 'background.paper',
                      '& .MuiSelect-select': {
                        py: 1.5
                      }
                    }}
                  >
                    <MenuItem value="" disabled>
                      Select a lease...
                    </MenuItem>
                    {leaseOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id}>
                        {option.label}
                      </MenuItem>
                    ))}
                    <MenuItem 
                      value="__add_new__"
                      sx={{
                        color: 'primary.main',
                        fontWeight: 500
                      }}
                    >
                      + Add New Lease
                    </MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {/* Get It Signed Fast Button */}
              <Button
                variant="contained"
                fullWidth
                onClick={handleGetSignedFast}
                disabled={!signatureReadiness.canInvoke || !selectedLeaseId}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1rem',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  },
                  '&:disabled': {
                    bgcolor: alpha(theme.palette.action.disabledBackground, 0.5),
                    color: alpha(theme.palette.action.disabled, 0.5)
                  }
                }}
              >
                GET IT SIGNED FAST
              </Button>
            </CardContent>
            </Card>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
