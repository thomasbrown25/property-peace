import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, MailOutlined, NotificationOutlined, HomeOutlined } from '@ant-design/icons';
import { formatDateAndTime } from 'utils/formatters';
import MainCard from 'components/MainCard';
import { announcementAPI, organizationAPI } from 'api';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

// ==============================|| ANNOUNCEMENT DETAILS PAGE ||============================== //

export default function AnnouncementDetailsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const announcementId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [announcement, setAnnouncement] = useState(null);
  const [organizationNames, setOrganizationNames] = useState({});
  const [propertyNames, setPropertyNames] = useState({});
  const [unitNames, setUnitNames] = useState({});
  const [unitsByProperty, setUnitsByProperty] = useState({}); // Map of propertyId -> array of {id, name}

  useEffect(() => {
    const loadAnnouncementDetails = async () => {
      if (!announcementId) {
        setError('No announcement ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await announcementAPI.getAnnouncementById(announcementId);
        
        if (result.success && result.data) {
          const data = result.data;
          setAnnouncement(data);

          // Parse recipient IDs
          const parseIds = (ids) => {
            if (!ids) return [];
            if (Array.isArray(ids)) return ids.map(id => Number(id)).filter(id => !isNaN(id));
            if (typeof ids === 'string') {
              try {
                return JSON.parse(ids).map(id => Number(id)).filter(id => !isNaN(id));
              } catch {
                return [];
              }
            }
            return [];
          };

          const orgIds = parseIds(data.organizationIds || data.OrganizationIds);
          const propIds = parseIds(data.propertyIds || data.PropertyIds);
          const unitIds = parseIds(data.unitIds || data.UnitIds);

          // Fetch organization names
          if (orgIds.length > 0) {
            try {
              const orgResponse = await organizationAPI.getUserOrganizations();
              if (orgResponse.success && orgResponse.data) {
                const namesMap = {};
                orgResponse.data.forEach(org => {
                  if (orgIds.includes(Number(org.id))) {
                    namesMap[org.id] = org.name;
                  }
                });
                setOrganizationNames(namesMap);
              }
            } catch (err) {
              console.error('Error fetching organization names:', err);
            }
          }

          // Fetch property names
          if (propIds.length > 0) {
            try {
              const propertyPromises = propIds.map(async (propId) => {
                try {
                  const propResponse = await axiosServices.get(`/api/property/${propId}`);
                  if (propResponse.data?.success && propResponse.data?.data) {
                    return { id: propId, name: propResponse.data.data.name || propResponse.data.data.Name };
                  }
                  return null;
                } catch (err) {
                  console.error(`Error fetching property ${propId}:`, err);
                  return null;
                }
              });

              const propertyResults = await Promise.all(propertyPromises);
              const propNamesMap = {};
              propertyResults.forEach(prop => {
                if (prop) {
                  propNamesMap[prop.id] = prop.name;
                }
              });
              setPropertyNames(propNamesMap);

              // Fetch unit names after properties are loaded
              if (unitIds.length > 0) {
                try {
                  const unitPromises = propIds.map(async (propId) => {
                    try {
                      const unitsResponse = await axiosServices.get(`/api/unit/${propId}`);
                      if (unitsResponse.data?.success && unitsResponse.data?.data) {
                        const units = Array.isArray(unitsResponse.data.data) ? unitsResponse.data.data : [];
                        return units
                          .filter(unit => unitIds.includes(Number(unit.id)))
                          .map(unit => ({ id: unit.id, name: unit.name || unit.Name, propertyId: propId }));
                      }
                      return [];
                    } catch (err) {
                      console.error(`Error fetching units for property ${propId}:`, err);
                      return [];
                    }
                  });

                  const unitResults = await Promise.all(unitPromises);
                  const unitNamesMap = {};
                  const unitsByPropMap = {};
                  
                  unitResults.flat().forEach(unit => {
                    unitNamesMap[unit.id] = unit.name;
                    if (!unitsByPropMap[unit.propertyId]) {
                      unitsByPropMap[unit.propertyId] = [];
                    }
                    unitsByPropMap[unit.propertyId].push({ id: unit.id, name: unit.name });
                  });
                  
                  setUnitNames(unitNamesMap);
                  setUnitsByProperty(unitsByPropMap);
                } catch (err) {
                  console.error('Error fetching unit names:', err);
                }
              }
            } catch (err) {
              console.error('Error fetching property names:', err);
            }
          } else if (unitIds.length > 0) {
            // If we have unit IDs but no property IDs, we need to find which properties have these units
            // For now, we'll try to fetch units from all properties in the organization
            // This is a fallback - ideally we'd have property IDs
            try {
              const propertiesResponse = await axiosServices.get('/api/property/list');
              if (propertiesResponse.data?.success && propertiesResponse.data?.data) {
                const allProperties = Array.isArray(propertiesResponse.data.data) ? propertiesResponse.data.data : [];
                const unitPromises = allProperties.map(async (property) => {
                  try {
                    const unitsResponse = await axiosServices.get(`/api/unit/${property.id}`);
                    if (unitsResponse.data?.success && unitsResponse.data?.data) {
                      const units = Array.isArray(unitsResponse.data.data) ? unitsResponse.data.data : [];
                      return units
                        .filter(unit => unitIds.includes(Number(unit.id)))
                        .map(unit => ({ id: unit.id, name: unit.name || unit.Name, propertyId: property.id }));
                    }
                    return [];
                  } catch (err) {
                    return [];
                  }
                });

                  const unitResults = await Promise.all(unitPromises);
                  const unitNamesMap = {};
                  const unitsByPropMap = {};
                  
                  unitResults.flat().forEach(unit => {
                    unitNamesMap[unit.id] = unit.name;
                    if (!unitsByPropMap[unit.propertyId]) {
                      unitsByPropMap[unit.propertyId] = [];
                    }
                    unitsByPropMap[unit.propertyId].push({ id: unit.id, name: unit.name });
                  });
                  
                  setUnitNames(unitNamesMap);
                  setUnitsByProperty(unitsByPropMap);
                  
                  // Also fetch property names for the units we found
                  const foundPropertyIds = Object.keys(unitsByPropMap).map(id => Number(id));
                  if (foundPropertyIds.length > 0) {
                    try {
                      const propertyPromises = foundPropertyIds.map(async (propId) => {
                        try {
                          const propResponse = await axiosServices.get(`/api/property/${propId}`);
                          if (propResponse.data?.success && propResponse.data?.data) {
                            return { id: propId, name: propResponse.data.data.name || propResponse.data.data.Name };
                          }
                          return null;
                        } catch (err) {
                          return null;
                        }
                      });
                      
                      const propertyResults = await Promise.all(propertyPromises);
                      const propNamesMap = {};
                      propertyResults.forEach(prop => {
                        if (prop) {
                          propNamesMap[prop.id] = prop.name;
                        }
                      });
                      setPropertyNames(prev => ({ ...prev, ...propNamesMap }));
                    } catch (err) {
                      console.error('Error fetching property names for units:', err);
                    }
                  }
              }
            } catch (err) {
              console.error('Error fetching unit names:', err);
            }
          }
        } else {
          setError(result.message || 'Failed to load announcement');
        }
      } catch (err) {
        console.error('Error loading announcement details:', err);
        setError(err.message || 'Failed to load announcement details');
        openSnackbar({
          open: true,
          message: 'Failed to load announcement details',
          variant: 'alert',
          alert: { color: 'error' },
          autoHideDuration: 5000
        });
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncementDetails();
  }, [announcementId]);

  const parseIds = (ids) => {
    if (!ids) return [];
    if (Array.isArray(ids)) return ids.map(id => Number(id)).filter(id => !isNaN(id));
    if (typeof ids === 'string') {
      try {
        return JSON.parse(ids).map(id => Number(id)).filter(id => !isNaN(id));
      } catch {
        return [];
      }
    }
    return [];
  };

  const getStatusChip = () => {
    if (!announcement) return null;
    
    const isCompleted = announcement.isCompleted || announcement.IsCompleted;
    const scheduledAt = announcement.scheduledAt || announcement.ScheduledAt;
    const isScheduled = scheduledAt && !isCompleted;

    if (isCompleted) {
      return (
        <Chip
          label="Sent"
          size="small"
          color="success"
          icon={<CheckCircleOutlined />}
        />
      );
    }
    
    if (isScheduled) {
      return (
        <Chip
          label="Scheduled"
          size="small"
          sx={{ bgcolor: '#17a2b8', color: 'white' }}
          icon={<ClockCircleOutlined style={{ color: 'white' }} />}
        />
      );
    }
    
    return (
      <Chip
        label="Pending"
        size="small"
        color="warning"
        icon={<ExclamationCircleOutlined />}
      />
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography variant="body1">Loading announcement details...</Typography>
          </Stack>
        </Box>
      </Container>
    );
  }

  if (error || !announcement) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>{error || 'Announcement not found'}</Alert>
          <Button startIcon={<ArrowLeftOutlined />} onClick={() => navigate('/landlord/announcements')}>
            Back to Announcements
          </Button>
        </Box>
      </Container>
    );
  }

  const orgIds = parseIds(announcement.organizationIds || announcement.OrganizationIds);
  const propIds = parseIds(announcement.propertyIds || announcement.PropertyIds);
  const unitIds = parseIds(announcement.unitIds || announcement.UnitIds);
  const isAllProperties = orgIds.length === 0 && propIds.length === 0 && unitIds.length === 0;
  
  // Calculate actual unit count from displayed units
  const actualUnitCount = Object.values(unitsByProperty).reduce((total, units) => total + units.length, 0) || unitIds.length;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowLeftOutlined />}
            onClick={() => navigate('/landlord/announcements')}
            sx={{ minWidth: 'auto' }}
          >
            Back
          </Button>
          <Typography variant="h4" sx={{ flex: 1 }}>
            Announcement Details
          </Typography>
          {getStatusChip()}
        </Stack>

        <Grid container spacing={3}>
          {/* Left Column - Main Details */}
          <Grid size={{ xs: 12, md: 8 }}>
            <MainCard title={announcement.title || announcement.Title || 'Announcement'} sx={{ mb: 3 }}>
              <Stack spacing={3}>
                {/* Message */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Message
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {announcement.message || announcement.Message || 'No message'}
                  </Typography>
                </Box>

                <Divider />

                {/* Created By */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Created By
                  </Typography>
                  <Typography variant="body1">
                    {announcement.createdByName || announcement.CreatedByName || 'Unknown'}
                  </Typography>
                </Box>

                {/* Dates */}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Created Date
                    </Typography>
                    <Typography variant="body1">
                      {announcement.createdAt 
                        ? formatDateAndTime(announcement.createdAt)
                        : 'N/A'}
                    </Typography>
                  </Grid>
                  {announcement.scheduledAt && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Scheduled Date
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <ClockCircleOutlined style={{ fontSize: 14, color: '#17a2b8' }} />
                        <Typography variant="body1">
                          {formatDateAndTime(announcement.scheduledAt)}
                        </Typography>
                      </Stack>
                    </Grid>
                  )}
                  {announcement.completedAt && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Sent Date
                      </Typography>
                      <Typography variant="body1">
                        {formatDateAndTime(announcement.completedAt)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Stack>
            </MainCard>

            {/* Recipients */}
            <MainCard title="Recipients" sx={{ mb: 3 }}>
              <Stack spacing={2}>
                {isAllProperties ? (
                  <Typography variant="body1" color="text.secondary">
                    All Properties
                  </Typography>
                ) : (
                  <>
                    {unitIds.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Units ({actualUnitCount})
                        </Typography>
                        {Object.keys(unitsByProperty).length > 0 ? (
                          <Stack spacing={2}>
                            {Object.entries(unitsByProperty).map(([propertyId, units]) => (
                              <Box key={propertyId}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                  {propertyNames[propertyId] || `Property ${propertyId}`}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  {units.map(unit => (
                                    <Chip
                                      key={unit.id}
                                      label={unit.name || `Unit ${unit.id}`}
                                      size="small"
                                      color="secondary"
                                      variant="outlined"
                                    />
                                  ))}
                                </Stack>
                              </Box>
                            ))}
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {unitIds.map(unitId => (
                              <Chip
                                key={unitId}
                                label={unitNames[unitId] || `Unit ${unitId}`}
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    )}
                  </>
                )}
              </Stack>
            </MainCard>
          </Grid>

          {/* Right Column - Stats & Info */}
          <Grid size={{ xs: 12, md: 4 }}>
            <MainCard title="Delivery Information" sx={{ mb: 3 }}>
              <Stack spacing={2}>
                {/* Delivery Methods */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Delivery Methods
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label="In-App Notification"
                      size="small"
                      color={announcement.sendAsNotification ? 'primary' : 'default'}
                      icon={<NotificationOutlined />}
                      sx={!announcement.sendAsNotification ? { opacity: 0.5 } : {}}
                    />
                    <Chip
                      label="Email"
                      size="small"
                      color={announcement.sendAsEmail ? 'primary' : 'default'}
                      icon={<MailOutlined />}
                      sx={!announcement.sendAsEmail ? { opacity: 0.5 } : {}}
                    />
                  </Stack>
                </Box>

                <Divider />

                {/* Recipient Count */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Recipients
                  </Typography>
                  <Typography variant="h5" fontWeight={600}>
                    {announcement.sentCount || announcement.SentCount || 0}
                  </Typography>
                  {(announcement.failedCount || announcement.FailedCount || 0) > 0 && (
                    <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                      {announcement.failedCount || announcement.FailedCount} failed
                    </Typography>
                  )}
                </Box>

                <Divider />

                {/* Organization */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Organization
                  </Typography>
                  <Typography variant="body1">
                    {announcement.organizationName || announcement.OrganizationName || 'N/A'}
                  </Typography>
                </Box>
              </Stack>
            </MainCard>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
