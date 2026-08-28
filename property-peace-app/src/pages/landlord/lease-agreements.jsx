import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Card,
  CardContent,
  Grid,
  alpha,
  useTheme,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  InputLabel,
  Fade
} from '@mui/material';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DownloadOutlined,
  AppstoreOutlined,
  TableOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import { tenantDocumentAPI } from 'api';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { formatDate } from 'utils/formatters';

export default function LeaseAgreementsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const theme = useTheme();
  const properties = useSelector(selectProperties);
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const { propertiesRefetch } = useFetchProperties();

  const [filters, setFilters] = useState({
    status: ['active'] // Default to active, now an array for multi-select
  });
  const [leaseLayout, setLeaseLayout] = useState('cards');
  const [loading, setLoading] = useState(true);
  const [leaseAgreements, setLeaseAgreements] = useState([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);

  // Fade-in animation state
  const [fadeIn, setFadeIn] = useState(false);

  // Trigger fade-in animation on mount - start immediately so components can render
  useEffect(() => {
    // Set fadeIn immediately so components render, even if they start with opacity 0
    setFadeIn(true);
  }, []);

  // Reset property selection on mount
  useEffect(() => {
    dispatch(setProperty(null));
    dispatch(setUnit(null));
  }, [dispatch]);

  // Load properties
  useEffect(() => {
    setLoading(true);
    propertiesRefetch().finally(() => setLoading(false));
  }, [propertiesRefetch]);

  // Fetch lease agreements for all leases
  useEffect(() => {
    const fetchLeaseAgreements = async () => {
      if (!properties || properties.length === 0) {
        setLeaseAgreements([]);
        return;
      }

      setLoadingAgreements(true);
      try {
        const agreements = [];

        // Get all leases from properties
        const allLeases = [];
        properties.forEach((p) => {
          p.units?.forEach((u) => {
            const unitLease = u.lease || u.Lease;
            if (unitLease && unitLease.id) {
              allLeases.push({
                ...unitLease,
                propertyName: p.name,
                propertyId: p.id,
                propertyType: p.propertyType,
                unitName: u.name,
                unitId: u.id,
                tenants: unitLease.tenants || [],
                organizationId: p.organizationId
              });
            }
          });
        });

        // Fetch lease agreement for each lease
        for (const lease of allLeases) {
          try {
            const response = await tenantDocumentAPI.getLeaseAgreement(lease.id);
            if (response.success && response.data) {
              agreements.push({
                ...lease,
                agreement: response.data,
                hasAgreement: true
              });
            } else {
              // Lease exists but no agreement document
              agreements.push({
                ...lease,
                agreement: null,
                hasAgreement: false
              });
            }
          } catch (error) {
            // If 404 or 400, lease exists but no agreement
            const status = error?.response?.status;
            if (status === 404 || status === 400) {
              agreements.push({
                ...lease,
                agreement: null,
                hasAgreement: false
              });
            } else {
              console.error(`Error fetching agreement for lease ${lease.id}:`, error);
            }
          }
        }

        setLeaseAgreements(agreements);
      } catch (error) {
        console.error('Error fetching lease agreements:', error);
        setLeaseAgreements([]);
      } finally {
        setLoadingAgreements(false);
      }
    };

    fetchLeaseAgreements();
  }, [properties]);

  // Filter lease agreements
  const filteredLeaseAgreements = useMemo(() => {
    let filtered = leaseAgreements || [];

    // Only show leases that have an agreement document
    filtered = filtered.filter((la) => la.hasAgreement === true);

    // Filter by property
    if (selectedProperty?.id) {
      filtered = filtered.filter((la) => la.propertyId === selectedProperty.id);
    }

    // Filter by unit
    if (selectedUnit?.id) {
      filtered = filtered.filter((la) => la.unitId === selectedUnit.id);
    }

    // Filter by status (now supports multiple statuses)
    const statusFilters = Array.isArray(filters.status) ? filters.status : [filters.status || 'active'];
    if (statusFilters.length > 0 && !statusFilters.includes('all')) {
      filtered = filtered.filter((la) => {
        if (statusFilters.includes('active') && statusFilters.includes('inactive')) {
          return true; // Show all if both are selected
        }
        if (statusFilters.includes('active')) {
          return la.isActive === true;
        }
        if (statusFilters.includes('inactive')) {
          return la.isActive === false;
        }
        return true;
      });
    }

    return filtered.sort((a, b) => {
      // Sort by property name, then unit name
      const aProp = a.propertyName || '';
      const bProp = b.propertyName || '';
      if (aProp !== bProp) {
        return aProp.localeCompare(bProp);
      }
      const aUnit = a.unitName || '';
      const bUnit = b.unitName || '';
      return aUnit.localeCompare(bUnit);
    });
  }, [leaseAgreements, selectedProperty, selectedUnit, filters.status]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = filteredLeaseAgreements.length;
    const withAgreement = filteredLeaseAgreements.filter((la) => la.hasAgreement).length;
    const withoutAgreement = total - withAgreement;
    const active = filteredLeaseAgreements.filter((la) => la.isActive === true).length;
    const expired = filteredLeaseAgreements.filter((la) => {
      if (!la.endDate) return false;
      const endDate = new Date(la.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return endDate < today;
    }).length;

    return {
      total,
      withAgreement,
      withoutAgreement,
      active,
      expired
    };
  }, [filteredLeaseAgreements]);

  const handleViewAgreement = async (leaseAgreement) => {
    if (!leaseAgreement.agreement) {
      openSnackbar({
        open: true,
        message: 'No lease agreement document available',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    try {
      // Always fetch a fresh lease agreement to get a new SAS URL (SAS URLs expire after 1 hour)
      // This ensures the document can be viewed even if the page has been open for a while
      const response = await tenantDocumentAPI.getLeaseAgreement(leaseAgreement.id);
      if (response.success && response.data?.blobUrl) {
        window.open(response.data.blobUrl, '_blank');
      } else {
        openSnackbar({
          open: true,
          message: 'Unable to open lease agreement',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error viewing lease agreement:', error);
      openSnackbar({
        open: true,
        message: 'Error opening lease agreement',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleViewLease = (leaseAgreement) => {
    navigate(`/landlord/lease/${leaseAgreement.propertyId}/${leaseAgreement.unitId}`);
  };

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible' }}>
        {/* Header */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <Box sx={{ mb: 4 }}>
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Lease Agreements' }
          ]}
        />

        {/* Header Row */}
        <Stack direction="row" alignItems="center" spacing={2} mb={1}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <FileTextOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h3" fontWeight={700}>
              Lease Agreements
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and view lease agreement documents
            </Typography>
          </Box>
        </Stack>
      </Box>
        </AnimateIn>

      {/* Summary Cards */}
      <AnimateIn direction="bottom" delay={200} distance={120}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <FileTextOutlined style={{ fontSize: 24, color: '#1877F2' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Total Leases
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {metrics.total}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlined style={{ fontSize: 24, color: '#2e7d32' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    With Agreement
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {metrics.withAgreement}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <ClockCircleOutlined style={{ fontSize: 24, color: '#ed6c02' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Without Agreement
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {metrics.withoutAgreement}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlined style={{ fontSize: 24, color: '#2e7d32' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Active
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {metrics.active}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CloseCircleOutlined style={{ fontSize: 24, color: '#d32f2f' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Expired
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {metrics.expired}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </AnimateIn>

      {/* Filters */}
      <AnimateIn direction="bottom" delay={300} distance={120}>
        <MainCard
        sx={{
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            '@media (max-width: 912px)': {
              flexDirection: 'column',
              alignItems: 'stretch'
            }
          }}
        >
          {/* Left: Add Agreement button */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            {/* Add Agreement Button */}
            <Button
              size="small"
              variant="contained"
              startIcon={<FileTextOutlined style={{ fontSize: 16 }} />}
              onClick={() => navigate('/landlord/lease-agreement-builder')}
              sx={{
                px: 2.5,
                py: 0.75,
                textTransform: 'none',
                flexShrink: 0,
                boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': {
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`
                }
              }}
            >
              Add Agreement
            </Button>
          </Box>

          {/* Right: Toggle buttons, Status Dropdown, PropertySelect */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              flexWrap: 'wrap',
              flexShrink: 0,
              '@media (max-width: 912px)': {
                width: '100%',
                justifyContent: 'flex-start'
              }
            }}
          >
            <ToggleButtonGroup
              value={leaseLayout}
              exclusive
              onChange={(e, newLayout) => {
                if (newLayout !== null) {
                  setLeaseLayout(newLayout);
                }
              }}
              size="small"
              aria-label="view layout"
            >
              <Tooltip title="Card View">
                <ToggleButton value="cards" aria-label="cards">
                  <AppstoreOutlined />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Table View">
                <ToggleButton value="table" aria-label="table">
                  <TableOutlined />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>

            {/* Status Multi-Select Dropdown */}
            <FormControl size="small" sx={{ minWidth: 200, flexShrink: 0 }}>
              <InputLabel>Status</InputLabel>
              <Select
                multiple
                value={Array.isArray(filters.status) ? filters.status : [filters.status || 'active']}
                onChange={(e) => {
                  const selectedStatuses = e.target.value;
                  setFilters(prev => ({ ...prev, status: selectedStatuses }));
                }}
                label="Status"
                renderValue={(selected) => {
                  if (selected.length === 0) return 'All Statuses';
                  const statusLabels = {
                    'active': 'Active',
                    'inactive': 'Inactive',
                    'all': 'All'
                  };
                  if (selected.length === Object.keys(statusLabels).length) return 'All Statuses';
                  return selected.map(s => statusLabels[s] || s).join(', ');
                }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="all">All</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ flexShrink: 0 }}>
              <PropertySelect width={300} />
            </Box>
          </Box>
        </Box>
      </MainCard>
      </AnimateIn>

      {/* Table */}
      <AnimateIn direction="bottom" delay={400} distance={120}>
      {loading || loadingAgreements ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredLeaseAgreements.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No lease agreements found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {selectedProperty
                ? 'Try adjusting your filter criteria.'
                : 'Lease agreements will appear here once leases are created.'}
            </Typography>
          </Box>
        </MainCard>
      ) : leaseLayout === 'cards' ? (
        <MainCard>
          <Grid container spacing={2}>
            {filteredLeaseAgreements.map((leaseAgreement) => {
              const isNotStarted = leaseAgreement.startDate && new Date(leaseAgreement.startDate) > new Date();
              const statusLabel = isNotStarted ? 'Not Started' : (leaseAgreement.isActive ? 'Active' : 'Inactive');
              const statusColor = isNotStarted ? 'warning' : (leaseAgreement.isActive ? 'success' : 'default');
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={leaseAgreement.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      borderRadius: 2,
                      bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
                      '&:hover': {
                        boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.12)}`
                      }
                    }}
                  >
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {leaseAgreement.propertyName || 'N/A'}
                          {leaseAgreement.unitName ? ` - ${leaseAgreement.unitName}` : ''}
                        </Typography>
                        <Chip label={statusLabel} color={statusColor} size="small" />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Tenants: {leaseAgreement.tenants && leaseAgreement.tenants.length > 0
                          ? leaseAgreement.tenants.map((t) => `${t.firstName || ''} ${t.lastName || ''}`.trim()).join(', ') || 'N/A'
                          : 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {leaseAgreement.startDate && leaseAgreement.endDate
                          ? `${formatDate(leaseAgreement.startDate)} - ${formatDate(leaseAgreement.endDate)}`
                          : 'N/A'}
                      </Typography>
                      <Box
                        onClick={() => leaseAgreement.hasAgreement && handleViewAgreement(leaseAgreement)}
                        sx={{
                          cursor: leaseAgreement.hasAgreement ? 'pointer' : 'default',
                          '&:hover': leaseAgreement.hasAgreement ? { textDecoration: 'underline' } : {}
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Agreement: {leaseAgreement.agreement?.fileName || 'Available'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ mt: 'auto', pt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EyeOutlined />}
                          onClick={() => handleViewLease(leaseAgreement)}
                          sx={{ textTransform: 'none' }}
                        >
                          View Lease
                        </Button>
                        {leaseAgreement.hasAgreement && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<DownloadOutlined />}
                            onClick={() => handleViewAgreement(leaseAgreement)}
                            sx={{ textTransform: 'none' }}
                          >
                            View Agreement
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </MainCard>
      ) : (
        <MainCard>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Property</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Tenants</TableCell>
                  <TableCell>Lease Period</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Agreement</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLeaseAgreements.map((leaseAgreement) => (
                  <TableRow key={leaseAgreement.id} hover>
                    <TableCell>{leaseAgreement.propertyName || 'N/A'}</TableCell>
                    <TableCell>{leaseAgreement.unitName || 'N/A'}</TableCell>
                    <TableCell>
                      {leaseAgreement.tenants && leaseAgreement.tenants.length > 0
                        ? leaseAgreement.tenants.map((t) => `${t.firstName || ''} ${t.lastName || ''}`.trim()).join(', ') || 'N/A'
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {leaseAgreement.startDate && leaseAgreement.endDate
                        ? `${formatDate(leaseAgreement.startDate)} - ${formatDate(leaseAgreement.endDate)}`
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isNotStarted = leaseAgreement.startDate && new Date(leaseAgreement.startDate) > new Date();
                        if (isNotStarted) {
                          return (
                            <Chip
                              label="Not Started"
                              color="warning"
                              size="small"
                            />
                          );
                        }
                        return (
                          <Chip
                            label={leaseAgreement.isActive ? 'Active' : 'Inactive'}
                            color={leaseAgreement.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Box
                        onClick={() => handleViewAgreement(leaseAgreement)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        {leaseAgreement.agreement?.fileName || 'Available'}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="View Lease">
                          <IconButton
                            size="small"
                            onClick={() => handleViewLease(leaseAgreement)}
                            sx={{ color: 'primary.main' }}
                          >
                            <EyeOutlined />
                          </IconButton>
                        </Tooltip>
                        {leaseAgreement.hasAgreement && (
                          <Tooltip title="View Agreement">
                            <IconButton
                              size="small"
                              onClick={() => handleViewAgreement(leaseAgreement)}
                              sx={{ color: 'primary.main' }}
                            >
                              <DownloadOutlined />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>
      )}
      </AnimateIn>
      </Box>
    </Fade>
  );
}
