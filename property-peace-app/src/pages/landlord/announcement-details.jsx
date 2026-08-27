import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import {
  alpha,
  Avatar,
  Container,
  Box,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Divider,
  Paper,
  useTheme
} from '@mui/material';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  MailOutlined,
  NotificationOutlined,
  SendOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import { formatDateAndTime } from 'utils/formatters';
import { announcementAPI, organizationAPI } from 'api';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

// ==============================|| ANNOUNCEMENT DETAILS PAGE ||============================== //

export default function AnnouncementDetailsPage() {
  const theme = useTheme();
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
    const failedCount = Number(announcement.failedCount || announcement.FailedCount || 0);
    const baseSx = {
      height: 30,
      borderRadius: 1.5,
      fontWeight: 700,
      '& .MuiChip-icon': { color: 'inherit' }
    };

    if (isCompleted) {
      return (
        <Chip
          label={failedCount > 0 ? 'Sent with issues' : 'Sent'}
          size="small"
          icon={<CheckCircleOutlined />}
          sx={{ ...baseSx, bgcolor: failedCount > 0 ? '#fef3c7' : '#dcfce7', color: failedCount > 0 ? '#92400e' : '#166534' }}
        />
      );
    }

    if (scheduledAt) {
      return (
        <Chip
          label="Scheduled"
          size="small"
          icon={<ClockCircleOutlined />}
          sx={{ ...baseSx, bgcolor: '#e0f2fe', color: '#0369a1' }}
        />
      );
    }

    return (
      <Chip
        label="Pending"
        size="small"
        icon={<ExclamationCircleOutlined />}
        sx={{ ...baseSx, bgcolor: '#fef3c7', color: '#92400e' }}
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

  const title = announcement.title || announcement.Title || 'Announcement';
  const message = announcement.formattedMessage || announcement.FormattedMessage || announcement.message || announcement.Message || 'No message';
  const createdBy = announcement.createdByName || announcement.CreatedByName || 'Unknown';
  const createdAt = announcement.createdAt || announcement.CreatedAt;
  const scheduledAt = announcement.scheduledAt || announcement.ScheduledAt;
  const completedAt = announcement.completedAt || announcement.CompletedAt;
  const sendAsNotification = announcement.sendAsNotification ?? announcement.SendAsNotification;
  const sendAsEmail = announcement.sendAsEmail ?? announcement.SendAsEmail;
  const sentCount = Number(announcement.sentCount || announcement.SentCount || 0);
  const failedCount = Number(announcement.failedCount || announcement.FailedCount || 0);
  const organizationName = announcement.organizationName || announcement.OrganizationName || 'Current organization';
  const isCompleted = Boolean(announcement.isCompleted || announcement.IsCompleted);
  const audienceSummary = unitIds.length > 0
    ? `${unitIds.length} selected unit${unitIds.length === 1 ? '' : 's'}`
    : propIds.length > 0
      ? `${propIds.length} selected propert${propIds.length === 1 ? 'y' : 'ies'}`
      : orgIds.length > 0
        ? `${orgIds.length} organization${orgIds.length === 1 ? '' : 's'}`
        : 'All eligible tenants';
  const channelSummary = [sendAsNotification && 'In-app', sendAsEmail && 'Email'].filter(Boolean).join(' + ') || 'No delivery channel';
  const surfaceSx = {
    border: `1px solid ${alpha(theme.palette.divider, 0.14)}`,
    borderRadius: 3,
    bgcolor: 'background.paper',
    boxShadow: `0 10px 32px ${alpha('#061e35', 0.055)}`
  };
  const metaItems = [
    { label: 'Created by', value: createdBy, icon: <UserOutlined /> },
    { label: 'Created', value: createdAt ? formatDateAndTime(createdAt) : 'N/A', icon: <CalendarOutlined /> },
    scheduledAt
      ? { label: completedAt ? 'Scheduled for' : 'Sends on', value: formatDateAndTime(scheduledAt), icon: <ClockCircleOutlined /> }
      : completedAt
        ? { label: 'Sent', value: formatDateAndTime(completedAt), icon: <CheckCircleOutlined /> }
        : { label: 'Status', value: 'Awaiting delivery', icon: <ClockCircleOutlined /> }
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: { xs: 1.5, md: 2.5 } }}>
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2.25, sm: 3 },
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
            color: '#fff',
            bgcolor: '#061e35',
            backgroundImage: `radial-gradient(circle at 88% 15%, ${alpha('#41a541', 0.22)}, transparent 32%)`,
            boxShadow: `0 16px 38px ${alpha('#061e35', 0.18)}`
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={2.5}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Button
                startIcon={<ArrowLeftOutlined />}
                onClick={() => navigate('/landlord/announcements')}
                sx={{ mb: 1.1, px: 0, minWidth: 0, color: alpha('#fff', 0.78), '&:hover': { color: '#fff', bgcolor: 'transparent' } }}
              >
                Back to announcements
              </Button>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.5, overflowWrap: 'anywhere' }}>
                {title}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.35 }}>
                <Chip
                  icon={<TeamOutlined />}
                  label={audienceSummary}
                  size="small"
                  sx={{ bgcolor: alpha('#fff', 0.1), color: '#fff', '& .MuiChip-icon': { color: alpha('#fff', 0.72) } }}
                />
                <Chip
                  icon={<SendOutlined />}
                  label={channelSummary}
                  size="small"
                  sx={{ bgcolor: alpha('#fff', 0.1), color: '#fff', '& .MuiChip-icon': { color: alpha('#fff', 0.72) } }}
                />
              </Stack>
            </Box>
            {getStatusChip()}
          </Stack>
        </Paper>

        <Grid container spacing={3} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              <Paper elevation={0} sx={surfaceSx}>
                <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 42, height: 42, bgcolor: alpha('#41a541', 0.12), color: '#41a541' }}>
                      <SendOutlined />
                    </Avatar>
                    <Box minWidth={0}>
                      <Typography variant="h5" sx={{ fontWeight: 750 }}>Message</Typography>
                      <Typography sx={{ mt: 0.2, fontSize: '0.77rem', color: 'text.secondary' }}>
                        The message your recipients received
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Divider />

                <Box sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box
                    sx={{
                      p: { xs: 2, sm: 2.5 },
                      borderRadius: 2.5,
                      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                      bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.08) : '#f8fafc'
                    }}
                  >
                    <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.96rem', lineHeight: 1.8, color: 'text.primary' }}>
                      {message}
                    </Typography>
                  </Box>
                </Box>

                <Divider />

                <Grid container>
                  {metaItems.map((item, index) => (
                    <Grid key={item.label} size={{ xs: 12, sm: 4 }}>
                      <Stack
                        direction="row"
                        spacing={1.15}
                        sx={{
                          p: 2,
                          minHeight: 78,
                          borderTop: { xs: index === 0 ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.1)}`, sm: 'none' },
                          borderLeft: { xs: 'none', sm: index === 0 ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.1)}` }
                        }}
                      >
                        <Box sx={{ mt: 0.15, color: 'text.secondary', fontSize: 16 }}>{item.icon}</Box>
                        <Box minWidth={0}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.45 }}>
                            {item.label}
                          </Typography>
                          <Typography sx={{ mt: 0.45, fontSize: '0.8rem', fontWeight: 650 }}>{item.value}</Typography>
                        </Box>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              <Paper elevation={0} sx={surfaceSx}>
                <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar sx={{ width: 40, height: 40, bgcolor: alpha(theme.palette.primary.main, 0.09), color: 'primary.main' }}>
                      <TeamOutlined />
                    </Avatar>
                    <Box minWidth={0}>
                      <Typography variant="h5" fontWeight={750}>Audience</Typography>
                      <Typography sx={{ mt: 0.2, fontSize: '0.77rem', color: 'text.secondary' }}>
                        Properties and units selected for this announcement
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
                <Divider />
                <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                  {isAllProperties ? (
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ width: 36, height: 36, bgcolor: alpha('#41a541', 0.11), color: '#41a541' }}><HomeOutlined /></Avatar>
                      <Box>
                        <Typography fontWeight={700}>All eligible tenants</Typography>
                        <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>Across every property in {organizationName}</Typography>
                      </Box>
                    </Stack>
                  ) : unitIds.length > 0 ? (
                    <Stack spacing={1.5}>
                      {Object.keys(unitsByProperty).length > 0 ? Object.entries(unitsByProperty).map(([propertyId, units]) => (
                        <Box key={propertyId} sx={{ p: 1.75, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.035) }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.15 }}>
                            <HomeOutlined style={{ color: theme.palette.text.secondary }} />
                            <Typography fontWeight={700}>{propertyNames[propertyId] || `Property ${propertyId}`}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            {units.map((unit) => (
                              <Chip key={unit.id} label={unit.name || `Unit ${unit.id}`} size="small" variant="outlined" sx={{ bgcolor: 'background.paper', fontWeight: 650 }} />
                            ))}
                          </Stack>
                        </Box>
                      )) : (
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                          {unitIds.map((unitId) => <Chip key={unitId} label={unitNames[unitId] || `Unit ${unitId}`} size="small" variant="outlined" />)}
                        </Stack>
                      )}
                    </Stack>
                  ) : propIds.length > 0 ? (
                    <Stack spacing={1}>
                      {propIds.map((propertyId) => (
                        <Stack key={propertyId} direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.035) }}>
                          <HomeOutlined style={{ color: theme.palette.text.secondary }} />
                          <Typography fontWeight={700}>{propertyNames[propertyId] || `Property ${propertyId}`}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Stack spacing={1}>
                      {orgIds.map((organizationId) => (
                        <Typography key={organizationId} fontWeight={700}>{organizationNames[organizationId] || organizationName}</Typography>
                      ))}
                    </Stack>
                  )}
                </Box>
              </Paper>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={0} sx={{ ...surfaceSx, position: { md: 'sticky' }, top: { md: 88 } }}>
              <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                <Typography variant="h5" fontWeight={750}>Delivery summary</Typography>
                <Typography sx={{ mt: 0.35, fontSize: '0.77rem', color: 'text.secondary' }}>How this message was delivered</Typography>
              </Box>
              <Divider />

              <Stack divider={<Divider flexItem />}>
                <Box sx={{ p: 2.25 }}>
                  <Typography sx={{ mb: 1.3, fontSize: '0.69rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary' }}>
                    Channels
                  </Typography>
                  <Stack spacing={1}>
                    {[
                      { label: 'In-app notification', enabled: sendAsNotification, icon: <NotificationOutlined /> },
                      { label: 'Email', enabled: sendAsEmail, icon: <MailOutlined /> }
                    ].map((channel) => (
                      <Stack key={channel.label} direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                        <Stack direction="row" spacing={1.1} alignItems="center">
                          <Avatar sx={{ width: 34, height: 34, bgcolor: channel.enabled ? alpha('#41a541', 0.11) : alpha(theme.palette.text.secondary, 0.07), color: channel.enabled ? '#41a541' : 'text.disabled' }}>
                            {channel.icon}
                          </Avatar>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 650, color: channel.enabled ? 'text.primary' : 'text.disabled' }}>{channel.label}</Typography>
                        </Stack>
                        <Chip
                          label={channel.enabled ? 'On' : 'Off'}
                          size="small"
                          sx={{ height: 22, fontSize: '0.66rem', fontWeight: 750, bgcolor: channel.enabled ? '#dcfce7' : alpha(theme.palette.text.secondary, 0.08), color: channel.enabled ? '#166534' : 'text.secondary' }}
                        />
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Box sx={{ p: 2.25 }}>
                  <Typography sx={{ fontSize: '0.69rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary' }}>
                    Delivery result
                  </Typography>
                  {isCompleted ? (
                    <Stack direction="row" alignItems="baseline" spacing={0.75} sx={{ mt: 0.6 }}>
                      <Typography sx={{ fontSize: '1.9rem', lineHeight: 1, fontWeight: 780 }}>{sentCount}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{sentCount === 1 ? 'recipient delivered' : 'recipients delivered'}</Typography>
                    </Stack>
                  ) : (
                    <Box sx={{ mt: 0.85, p: 1.35, borderRadius: 2, bgcolor: alpha('#0ea5e9', 0.08) }}>
                      <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#0369a1' }}>
                        {scheduledAt ? 'Awaiting scheduled send' : 'Awaiting delivery'}
                      </Typography>
                      <Typography sx={{ mt: 0.3, fontSize: '0.72rem', color: 'text.secondary' }}>
                        Delivery totals will appear after this announcement is sent.
                      </Typography>
                    </Box>
                  )}
                  {failedCount > 0 && (
                    <Alert severity="warning" sx={{ mt: 1.5, py: 0.25, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                      {failedCount} delivery {failedCount === 1 ? 'attempt needs' : 'attempts need'} attention
                    </Alert>
                  )}
                </Box>

                <Box sx={{ p: 2.25 }}>
                  <Typography sx={{ fontSize: '0.69rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary' }}>
                    Organization
                  </Typography>
                  <Typography sx={{ mt: 0.65, fontSize: '0.84rem', fontWeight: 700 }}>{organizationName}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
