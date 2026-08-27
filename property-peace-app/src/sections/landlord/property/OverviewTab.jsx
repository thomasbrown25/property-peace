import { useMemo, useState, useEffect } from 'react';
import { Box, Grid, Stack, Typography, Card, CardContent, Button, alpha, useTheme, Divider, Link, Chip, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { UserOutlined, FileTextOutlined, DollarOutlined, PlusOutlined, ToolOutlined, KeyOutlined, EditOutlined, SendOutlined, RightOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency, formatDate } from 'utils/formatters';
import { applicationAPI } from 'api';
import PropertyRentCollection from './PropertyRentCollection';
import axiosServices from 'utils/axios';
import { useNavigate } from 'react-router-dom';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import { useSubscription } from 'hooks/useSubscription';
import RentEstimateCard from 'components/RentEstimateCard';

export default function OverviewTab({ property, propertyId, selectedProperty, leases: propLeases, loadingLeases: propLoadingLeases, onLeasesRefresh, onAddUnit }) {
  // Use selectedProperty if property is not provided
  const propertyData = property || selectedProperty;
  const theme = useTheme();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const isPremium = subscription?.plan?.name?.toLowerCase() === 'premium' || subscription?.cancelAtPeriodEnd === true;
  const firstUnitId = propertyData?.units?.[0]?.id ?? null;
  const [applicantsCount, setApplicantsCount] = useState(null);
  const [applicantsLoading, setApplicantsLoading] = useState(true);
  const { maintenances } = useFetchMaintenances(propertyId);
  
  // Count open maintenance requests
  const openMaintenanceCount = useMemo(() => {
    if (!maintenances || !Array.isArray(maintenances)) return 0;
    return maintenances.filter(req => {
      const status = req.status?.toLowerCase();
      return status !== 'completed' && status !== 'cancelled';
    }).length;
  }, [maintenances]);

  // Use leases from props if provided, otherwise use local state (for backward compatibility)
  const [localLeases, setLocalLeases] = useState([]);
  const [localLoadingLeases, setLocalLoadingLeases] = useState(true);
  
  const leases = propLeases !== undefined ? propLeases : localLeases;
  const loadingLeases = propLoadingLeases !== undefined ? propLoadingLeases : localLoadingLeases;

  // Extract leases directly from property units (no API call needed)
  useEffect(() => {
    if (propLeases !== undefined) return; // Skip if leases are provided via props
    
    setLocalLoadingLeases(true);
    try {
      const leasesFromUnits = [];
      if (propertyData?.units && Array.isArray(propertyData.units)) {
        propertyData.units.forEach((unit) => {
          const unitLease = unit.lease || unit.Lease;
          if (unitLease && (unitLease.id || unitLease.Id)) {
            leasesFromUnits.push(unitLease);
          }
        });
      }
      setLocalLeases(leasesFromUnits);
    } catch (error) {
      console.error('Error extracting leases from property units:', error);
      setLocalLeases([]);
    } finally {
      setLocalLoadingLeases(false);
    }
  }, [propertyData?.units, propLeases]);

  // Tenant count — synchronous derivation from leases, no async, no loading cycle
  const tenantsCount = useMemo(() => {
    const activeLeases = leases.filter(lease => lease.isActive || lease.IsActive);
    const tenants = new Set();
    activeLeases.forEach(lease => {
      if (lease.tenants && Array.isArray(lease.tenants)) {
        lease.tenants.forEach(tenant => {
          if (tenant.id || tenant.Id) {
            tenants.add(tenant.id || tenant.Id);
          }
        });
      }
    });
    return tenants.size;
  }, [leases]);

  // Applicant count — only depends on propertyId, runs once per property
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setApplicantsLoading(true);
    setApplicantsCount(null);
    applicationAPI.getApplicationsByProperty(propertyId)
      .then(response => {
        if (cancelled) return;
        setApplicantsCount(response.success && response.data ? response.data.length || 0 : 0);
      })
      .catch(() => { if (!cancelled) setApplicantsCount(0); })
      .finally(() => { if (!cancelled) setApplicantsLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  // Check if property is single family
  const isSingleFamily = useMemo(() => {
    const propType = propertyData?.propertyType?.toLowerCase();
    return propType === 'singlefamily' || propType === 'single-family';
  }, [propertyData?.propertyType]);

  // Format lease display text: prioritize lease name, fallback to date-based format
  const formatLeaseDisplayText = (lease, property) => {
    if (!lease) return '';
    
    // First, try to get lease name from lease record
    const leaseName = lease.name || lease.Name;
    if (leaseName && leaseName.trim()) {
      return leaseName.trim();
    }
    
    // Fallback to lease nickname if available
    if (lease.leaseNickname || lease.LeaseNickname) {
      return lease.leaseNickname || lease.LeaseNickname;
    }
    
    // Fallback to date-based format if startDate exists and is valid
    const dateToUse = lease.startDate || lease.StartDate;
    if (dateToUse) {
      const date = new Date(dateToUse);
      // Check if date is valid (not Invalid Date and not epoch date)
      if (!isNaN(date.getTime()) && date.getTime() !== 0) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        
        let streetAddress = property?.streetAddress || '';
        let streetOnly = streetAddress || '';
        if (streetOnly.includes(',')) {
          streetOnly = streetOnly.split(',')[0].trim();
        } else {
          const zipCodePattern = /\s+\d{5}(-\d{4})?$/;
          if (zipCodePattern.test(streetOnly)) {
            streetOnly = streetOnly.replace(zipCodePattern, '').trim();
          }
        }
        
        return `${streetOnly} - ${month} ${year}`;
      }
    }
    
    // If no valid name or date, return a default
    return 'Lease';
  };

  // Get lease status
  const getLeaseStatus = (lease) => {
    // Check IsDrafted property from database
    const isDraftedFlag = lease.isDrafted ?? lease.IsDrafted ?? false;
    const signatureStatus = lease.signatureStatus ?? lease.SignatureStatus ?? null;
    const isDraftedByStatus = signatureStatus === 0 || signatureStatus === 'NotSent' || signatureStatus === 'notsent';
    const isDrafted = isDraftedFlag === true || isDraftedFlag === 1 || isDraftedByStatus;
    
    if (isDrafted) {
      return { label: 'DRAFT LEASE', color: 'info', isDraft: true };
    }
    
    const isActive = lease.isActive ?? lease.IsActive ?? true;
    if (!isActive) {
      return { label: 'ENDED', color: 'default', isDraft: false };
    }
    
    return { label: 'ACTIVE', color: 'success', isDraft: false };
  };

  // Navigate to build-lease-agreement: use existing lease if available, otherwise go to lease builder
  const handleBuildLeaseAgreement = () => {
    if (!propertyId) {
      navigate('/landlord/leases/builder');
      return;
    }
    // Prefer a draft lease, else use the most recent lease (leases are already sorted by date desc in the card)
    const draftOrFirstLease = leases.find((l) => getLeaseStatus(l).isDraft) || leases[0];
    if (draftOrFirstLease) {
      const lid = draftOrFirstLease.id || draftOrFirstLease.Id;
      const uid = draftOrFirstLease.unitId ?? draftOrFirstLease.UnitId ?? propertyData?.units?.find((u) => (u.lease || u.Lease)?.id === lid || (u.lease || u.Lease)?.Id === lid)?.id;
      const query = `leaseId=${lid}&propertyId=${propertyId}${uid ? `&unitId=${uid}` : ''}`;
      navigate(`/landlord/leases/build-lease-agreement?${query}`);
    } else {
      const firstUnitId = propertyData?.units?.[0]?.id;
      const params = new URLSearchParams({ propertyId: String(propertyId) });
      if (firstUnitId) params.set('unitId', String(firstUnitId));
      navigate(`/landlord/leases/builder?${params.toString()}`);
    }
  };

  const hasActiveLease = useMemo(() =>
    leases.some(l => l.isActive || l.IsActive),
    [leases]
  );

  // Action items list (only for single family properties) — context-aware based on lease state
  const actionItems = hasActiveLease
    ? [
        {
          icon: <FileTextOutlined style={{ fontSize: 20 }} />,
          label: 'Build a Lease Agreement',
          onClick: handleBuildLeaseAgreement
        },
        {
          icon: <EditOutlined style={{ fontSize: 20 }} />,
          label: 'E-Sign a Document',
          onClick: () => navigate(`/landlord/property/${propertyId}/e-sign`)
        }
      ]
    : [
        {
          icon: <SendOutlined style={{ fontSize: 20 }} />,
          label: 'Invite to Apply',
          onClick: () => navigate(`/landlord/invite-renter${propertyId ? `?propertyId=${propertyId}` : ''}`)
        },

        {
          icon: <FileTextOutlined style={{ fontSize: 20 }} />,
          label: 'Build a Lease Agreement',
          onClick: handleBuildLeaseAgreement
        },
        {
          icon: <EditOutlined style={{ fontSize: 20 }} />,
          label: 'E-Sign a Document',
          onClick: () => navigate(`/landlord/property/${propertyId}/e-sign`)
        }
      ];

  return (
    <Grid container spacing={3}>
      {/* Left Column - Overview Cards and Rent Collection */}
      <Grid size={{ xs: 12, sm: 12, md: 7 }}>
        <Grid container spacing={3}>
          {/* Rent Collection Component */}
          <Grid size={{ xs: 12 }}>
            <PropertyRentCollection propertyId={propertyId} />
          </Grid>

          {/* Lease Card (Single Family) or Units & Rooms Card (Multi-Unit) */}
          <Grid size={{ xs: 12 }}>
            {isSingleFamily ? (
              /* Lease Card for Single Family */
              <MainCard
                title={
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <FileTextOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                    <Typography variant="h6" fontWeight={600}>
                      Leases
                    </Typography>
                  </Stack>
                }
                action={
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PlusOutlined />}
                    onClick={() => navigate(`/landlord/property/${propertyId}?tab=leases`)}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Lease
                  </Button>
                }
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
              >
                {loadingLeases ? (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Loading leases...</Typography>
                  </Box>
                ) : leases.length > 0 ? (
                  <Stack spacing={0}>
                    {leases
                      .sort((a, b) => {
                        // Sort by creation date (most recent first) - use Id as proxy if dates are equal
                        const dateA = a.startDate || a.StartDate || a.createdAt || a.CreatedAt || new Date(0);
                        const dateB = b.startDate || b.StartDate || b.createdAt || b.CreatedAt || new Date(0);
                        const dateDiff = new Date(dateB) - new Date(dateA);
                        if (dateDiff !== 0) return dateDiff;
                        // If dates are equal, use ID (higher ID = more recent)
                        return (b.id || b.Id || 0) - (a.id || a.Id || 0);
                      })
                      .map((lease, index) => {
                      const leaseStatus = getLeaseStatus(lease);
                      const leaseDisplay = formatLeaseDisplayText(lease, propertyData);
                      const leaseId = lease.id || lease.Id;
                      const monthlyRent = lease.rentAmount || lease.RentAmount || 0;
                      
                      // Format lease term
                      const startDate = lease.startDate || lease.StartDate;
                      const endDate = lease.endDate || lease.EndDate;
                      let leaseTermText = '';
                      if (startDate && endDate) {
                        leaseTermText = `${formatDate(startDate)} - ${formatDate(endDate)}`;
                      } else if (startDate) {
                        leaseTermText = `Started ${formatDate(startDate)}`;
                      } else if (endDate) {
                        leaseTermText = `Ends ${formatDate(endDate)}`;
                      } else {
                        leaseTermText = 'No term set';
                      }
                      
                      return (
                        <Box key={leaseId}>
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="flex-start"
                            justifyContent="space-between"
                            onClick={() => navigate(`/landlord/leases/${leaseId}`)}
                            sx={{
                              py: 2,
                              px: 2,
                              borderBottom: index < leases.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                              cursor: 'pointer',
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.04)
                              }
                            }}
                          >
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                <Chip
                                  label={leaseStatus.label}
                                  size="small"
                                  color={leaseStatus.color}
                                  variant="outlined"
                                  sx={{ 
                                    fontWeight: 500,
                                    bgcolor: leaseStatus.color === 'info' ? alpha(theme.palette.info.main, 0.1) : 'transparent',
                                    color: leaseStatus.color === 'info' ? theme.palette.info.main : undefined
                                  }}
                                />
                                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                                  {leaseTermText}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                                <Typography variant="body1" fontWeight={600} sx={{ flex: 1, minWidth: 0 }}>
                                  {leaseDisplay}
                                </Typography>
                                {monthlyRent > 0 && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ ml: 'auto', whiteSpace: 'nowrap' }}
                                  >
                                    {formatCurrency(monthlyRent)}/mo
                                  </Typography>
                                )}
                              </Stack>
                            </Box>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No leases found
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<PlusOutlined />}
                      onClick={() => navigate(`/landlord/property/${propertyId}?tab=leases`)}
                      sx={{ textTransform: 'none' }}
                    >
                      Create New Lease
                    </Button>
                  </Box>
                )}
              </MainCard>
            ) : (
              /* Units & Rooms Card for Multi-Unit */
              <MainCard
                title={
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <KeyOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                      <Typography variant="h6" fontWeight={600}>Units & Rooms</Typography>
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PlusOutlined />}
                      onClick={onAddUnit}
                      sx={{ textTransform: 'none' }}
                    >
                      New
                    </Button>
                  </Stack>
                }
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
              >
                {propertyData?.units && propertyData.units.length > 0 ? (
                  <Stack spacing={0}>
                    {propertyData.units.map((unit, index) => {
                      const unitLease = unit?.lease;
                      const leaseId = unitLease?.id || unitLease?.Id;
                      const isOccupied = unit?.isOccupied || !!leaseId;
                      const unitName = unit?.name || `Unit ${index + 1}`;
                      const rent = unitLease?.rentAmount || unitLease?.RentAmount;

                      return (
                        <Box key={unit.id || index}>
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                            justifyContent="space-between"
                            onClick={() => unit.id ? navigate(`/landlord/unit/${unit.id}`) : undefined}
                            sx={{
                              py: 1.75,
                              px: 2,
                              cursor: unit.id ? 'pointer' : 'default',
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
                            }}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} sx={{ minWidth: 20 }}>
                                {index + 1}
                              </Typography>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={500} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {unitName}
                                </Typography>
                                {leaseId && (
                                  <Typography variant="caption" color="text.secondary">
                                    {formatLeaseDisplayText(unitLease, propertyData)}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              {rent > 0 && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatCurrency(rent)}/mo
                                </Typography>
                              )}
                              <Chip
                                label={isOccupied ? 'Occupied' : 'Vacant'}
                                size="small"
                                sx={{
                                  bgcolor: isOccupied ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.warning.main, 0.1),
                                  color: isOccupied ? theme.palette.success.main : theme.palette.warning.main,
                                  fontWeight: 500,
                                  fontSize: '0.7rem'
                                }}
                              />
                            </Stack>
                          </Stack>
                          {index < propertyData.units.length - 1 && <Divider />}
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No units found
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<PlusOutlined />}
                      onClick={() => navigate(`/landlord/property/${propertyId}?tab=units`)}
                      sx={{ textTransform: 'none' }}
                    >
                      Add New Unit
                    </Button>
                  </Box>
                )}
              </MainCard>
            )}
          </Grid>
        </Grid>
      </Grid>

      {/* Right Column - Tenants/Applicants Cards, Action Items (Single Family) and Maintenance */}
      <Grid size={{ xs: 12, sm: 12, md: 5 }}>
        <Stack spacing={3}>
          {/* Tenants and Applicants Cards */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                onClick={() => navigate(`/landlord/property/${propertyId}?tab=tenants`)}
                sx={{
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: (t) => `0 4px 12px ${alpha(t.palette.primary.main, 0.2)}`,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                        Tenants
                      </Typography>
                      <Typography variant="h4" fontWeight={700} color="primary.main">
                        {loadingLeases ? '-' : tenantsCount}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                onClick={() => navigate(`/landlord/listings?tab=applications&propertyId=${propertyId}`)}
                sx={{
                  bgcolor: (t) => alpha(t.palette.info.main, 0.08),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: (t) => `0 4px 12px ${alpha(t.palette.info.main, 0.2)}`,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Box sx={{ width: 48, height: 48, borderRadius: 1.5, bgcolor: alpha(theme.palette.info.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileTextOutlined style={{ fontSize: 24, color: theme.palette.info.main }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                        Applicants
                      </Typography>
                      <Typography variant="h4" fontWeight={700} color="info.main">
                        {applicantsLoading ? '-' : applicantsCount}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Action Items List - Only for Single Family Properties */}
          {isSingleFamily && (
            <MainCard
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <Stack spacing={0}>
                {actionItems.map((item, index) => (
                  <Box key={index}>
                    <ListItemButton
                      onClick={item.onClick}
                      sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08)
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box sx={{ color: 'primary.main' }}>
                          {item.icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          variant: 'body1',
                          fontWeight: 500,
                          color: 'text.primary'
                        }}
                      />
                      <RightOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                    </ListItemButton>
                    {index < actionItems.length - 1 && <Divider />}
                  </Box>
                ))}
              </Stack>
            </MainCard>
          )}

          {/* Open Maintenance Card */}
          <MainCard
            title={
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <ToolOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600}>Open Maintenance</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {openMaintenanceCount > 0 && (
                    <Chip
                      label={openMaintenanceCount}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 700, minWidth: 28 }}
                    />
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PlusOutlined />}
                    onClick={() => navigate(`/landlord/maintenances/add${propertyId ? `?propertyId=${propertyId}` : ''}`)}
                    sx={{ textTransform: 'none' }}
                  >
                    New
                  </Button>
                </Stack>
              </Stack>
            }
            sx={{ bgcolor: (t) => alpha(t.palette.background.paper, 0.6), boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}` }}
          >
            {openMaintenanceCount === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                No open maintenance requests.
              </Typography>
            ) : (
              <Stack spacing={0}>
                {maintenances
                  .filter(req => {
                    const status = req.status?.toLowerCase();
                    return status !== 'completed' && status !== 'cancelled';
                  })
                  .slice(0, 4)
                  .map((req, index, arr) => (
                    <Box key={req.id || index}>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        onClick={() => navigate(`/landlord/maintenances/${req.id}`)}
                        sx={{
                          py: 1.25,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                          borderRadius: 1
                        }}
                      >
                        <ExclamationCircleOutlined style={{
                          fontSize: 16,
                          color: req.priority === 'High' || req.priority === 'Emergency'
                            ? theme.palette.error.main
                            : theme.palette.warning.main,
                          flexShrink: 0
                        }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={500} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {req.title || req.description || 'Maintenance Request'}
                          </Typography>
                          {req.status && (
                            <Typography variant="caption" color="text.secondary">{req.status}</Typography>
                          )}
                        </Box>
                        <RightOutlined style={{ fontSize: 12, color: theme.palette.text.disabled, flexShrink: 0 }} />
                      </Stack>
                      {index < arr.length - 1 && <Divider />}
                    </Box>
                  ))}
                {openMaintenanceCount > 4 && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => navigate(`/landlord/property/${propertyId}?tab=maintenance`)}
                    sx={{ textTransform: 'none', mt: 0.5 }}
                  >
                    View all {openMaintenanceCount} requests
                  </Button>
                )}
              </Stack>
            )}
          </MainCard>

          {/* Market Rent Estimate */}
          <MainCard
            title="Market Rent Estimate"
            sx={{ bgcolor: (t) => alpha(t.palette.background.paper, 0.6), boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}` }}
          >
            <RentEstimateCard
              propertyId={propertyId}
              unitId={firstUnitId}
              isPremium={isPremium}
            />
          </MainCard>
        </Stack>
      </Grid>
    </Grid>
  );
}
