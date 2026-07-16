import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

// material-ui
import { Box, Stack, Typography, Chip, Divider, Grid } from '@mui/material';
import { alpha } from '@mui/system';
import moment from 'moment';

// project imports
import MainCard from 'components/MainCard';
import { HomeOutlined } from '@ant-design/icons';
import { formatRentStatus, getRentStatusColor } from 'utils/formatters';
import CircularLoader from 'components/CircularLoader';
import AnimateItem from 'components/AnimateItem';

// ==============================|| DASHBOARD - LEASE LIST ||============================== //

export default function LeaseList({ rentRecords = [], loading = false, properties = [], lastPaymentDates = {} }) {
  const navigate = useNavigate();

  // Get all leases from properties (only active leases)
  const allLeases = useMemo(() => {
    if (!properties || !Array.isArray(properties)) return [];
    const leases = [];

    properties.forEach((p) => {
      p.units?.forEach((u) => {
        const unitLease = u.lease || u.Lease;
        if (unitLease) {
          // Check if lease is active (handle both camelCase and PascalCase)
          const isLeaseActive = unitLease.isActive === true || 
                                unitLease.IsActive === true ||
                                unitLease.isActive === 1 ||
                                unitLease.IsActive === 1;
          
          // Only include active leases - filter out archived/inactive leases
          if (isLeaseActive) {
            leases.push({
              ...unitLease,
              propertyName: p.name?.trim() || p.streetAddress?.trim() || 'Property',
              propertyId: p.id,
              propertyType: p.propertyType,
              unitName: u.name,
              unitId: u.id,
              tenants: unitLease.tenants || [],
              hasLease: true
            });
          }
        }
      });
    });
    return leases;
  }, [properties]);

  // Calculate lease status counts
  const leaseStatusCounts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let active = 0;
    let future = 0;
    let drafted = 0;
    let overdue = 0;

    // Calculate overdue from rentRecords
    if (rentRecords && Array.isArray(rentRecords)) {
      overdue = rentRecords.filter(r => r.status === 'overdue' || r.status === 'Overdue').length;
    }

    allLeases.forEach((lease) => {
      const isActive = lease.isActive ?? lease.IsActive ?? true;
      const startDate = lease.startDate || lease.StartDate;
      const signatureStatus = lease.signatureStatus ?? lease.SignatureStatus ?? null;
      
      // Check if lease is drafted - check isDrafted flag first, then signature status
      // isDrafted flag takes precedence over signature status
      const isDraftedFlag = lease.isDrafted ?? lease.IsDrafted ?? false;
      const isDraftedByFlag = isDraftedFlag === true || isDraftedFlag === 1;
      const isDraftedByStatus = signatureStatus === 0 || signatureStatus === 'NotSent' || signatureStatus === 'notsent';
      const isDrafted = isDraftedByFlag || isDraftedByStatus;
      
      // Priority order: Drafted > Future > Active (overdue calculated separately from rentRecords)
      if (!isActive) {
        // Skip ended leases - we don't show them
        return;
      } else if (isDrafted) {
        // Drafted leases: active but either isDrafted flag is true or signature status is NotSent (not sent for signature yet)
        drafted++;
      } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        
        if (start > today) {
          // Future leases: active, sent for signature (or completed), but start date is in the future
          future++;
        } else {
          // Active leases: active, sent for signature (or completed), and start date has passed
          active++;
        }
      } else {
        // Active leases without start date: assume active if no start date is set
        active++;
      }
    });

    return { active, future, drafted, overdue };
  }, [allLeases, rentRecords]);

  // Sort and limit rent records: overdue first, then up-to-date, max 4 leases
  // Include drafted leases that don't have rent records
  const displayLeases = useMemo(() => {
    const result = [];

    // Create a map of active lease IDs for quick lookup
    const activeLeaseIds = new Set(allLeases.map(lease => lease.id || lease.Id));

    // Get rent records for active leases
    if (rentRecords && rentRecords.length > 0) {
      const activeRentRecords = rentRecords.filter(record => {
        const leaseId = record.leaseId || record.LeaseId || record.id || record.Id;
        return leaseId && activeLeaseIds.has(leaseId);
      });
      result.push(...activeRentRecords);
    }

    // Get drafted leases that don't have rent records
    const rentRecordLeaseIds = new Set(
      (rentRecords || []).map(r => r.leaseId || r.LeaseId || r.id || r.Id).filter(Boolean)
    );

    const draftedLeases = allLeases.filter(lease => {
      const leaseId = lease.id || lease.Id;
      const signatureStatus = lease.signatureStatus ?? lease.SignatureStatus ?? null;
      
      // Check if lease is drafted - check isDrafted flag first, then signature status
      const isDraftedFlag = lease.isDrafted ?? lease.IsDrafted ?? false;
      const isDraftedByFlag = isDraftedFlag === true || isDraftedFlag === 1;
      const isDraftedByStatus = signatureStatus === 0 || signatureStatus === 'NotSent' || signatureStatus === 'notsent';
      const isDrafted = isDraftedByFlag || isDraftedByStatus;
      
      // Include if it's a draft and doesn't have a rent record
      return isDrafted && leaseId && !rentRecordLeaseIds.has(leaseId);
    });

    // Convert drafted leases to display format (include updatedAt for sorting)
    const draftedLeaseRecords = draftedLeases.map(lease => ({
      leaseId: lease.id || lease.Id,
      id: lease.id || lease.Id,
      name: lease.name || lease.Name, // Include lease name
      propertyName: lease.propertyName,
      propertyId: lease.propertyId,
      propertyType: lease.propertyType,
      unitName: lease.unitName,
      dueDate: lease.startDate || lease.StartDate || null,
      status: 'draft',
      Status: 'Draft',
      isDraft: true,
      updatedAt: lease.updatedAt || lease.UpdatedAt || lease.startDate || lease.StartDate || null
    }));

    result.push(...draftedLeaseRecords);

    // Sort by most recently updated first (updatedAt descending), then by due date as tiebreaker
    const sorted = [...result].sort((a, b) => {
      const updatedA = a.updatedAt || a.UpdatedAt || a.dueDate || a.DueDate || 0;
      const updatedB = b.updatedAt || b.UpdatedAt || b.dueDate || b.DueDate || 0;
      const timeA = new Date(updatedA).getTime();
      const timeB = new Date(updatedB).getTime();
      return timeB - timeA; // descending: most recently updated first
    });

    // Limit to max 4 leases
    return sorted.slice(0, 4);
  }, [rentRecords, allLeases]);

  // Get property address by PropertyId
  const getPropertyAddress = (propertyId) => {
    if (!properties || !Array.isArray(properties) || !propertyId) return '';
    const property = properties.find(p => p.id === propertyId || p.Id === propertyId);
    if (!property) return '';
    return property.streetAddress || property.StreetAddress || '';
  };

  // Format lease display name - always return lease name, generate one if missing
  const formatLeaseDisplay = (rent, originalLease = null) => {
    // First, try to get lease name from original lease or rent record
    const leaseName = originalLease?.name || originalLease?.Name || rent.name || rent.Name;
    if (leaseName && leaseName.trim()) {
      return leaseName.trim();
    }
    
    // If no lease name exists, generate one from property/unit info
    const propertyId = rent.propertyId || rent.PropertyId;
    const propertyName = rent.propertyName || rent.PropertyName || '';
    const propertyType = rent.propertyType || rent.PropertyType || '';
    const unitName = rent.unitName || rent.UnitName || '';
    
    // Get property info from properties array if needed
    let displayPropertyName = propertyName;
    if (!displayPropertyName && propertyId) {
      const property = properties?.find(p => (p.id || p.Id) === propertyId);
      if (property) {
        displayPropertyName = property.name?.trim() || property.streetAddress?.trim() || property.StreetAddress?.trim() || '';
      }
    }
    
    // If still no property name, use property address
    if (!displayPropertyName && propertyId) {
      displayPropertyName = getPropertyAddress(propertyId);
    }
    
    // Generate lease name from property/unit info
    // For single family, use property name/address
    if (propertyType?.toLowerCase() === 'singlefamily') {
      return displayPropertyName || 'Lease';
    }
    
    // For multi-unit, append unit name if it's meaningful
    const isMeaningfulUnitName = unitName && unitName.trim() && !unitName.match(/^-\s*\d+$/);
    
    if (isMeaningfulUnitName) {
      return displayPropertyName ? `${displayPropertyName} – ${unitName}` : unitName || 'Lease';
    }
    
    return displayPropertyName || 'Lease';
  };

  const handleLeaseClick = (leaseId) => {
    if (leaseId) {
      navigate(`/landlord/leases/${leaseId}`);
    }
  };

  return (
    <MainCard
      title="Leases"
      sx={{
        height: '100%'
      }}
      secondary={
        <Link 
          component={RouterLink} 
          to="/landlord/leases" 
          color="primary" 
          sx={{ 
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          View all
        </Link>
      }
      content={false}
    >
      <Box sx={{ px: 2, pt: 1.5 }}>
        {/* Lease Status Counts */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, width: '100%' }}>
          <Box
            onClick={() => navigate('/landlord/leases?view=active')}
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.success.main, 0.06),
              border: (t) => `1px solid ${alpha(t.palette.success.main, 0.15)}`,
              textAlign: 'center',
              flex: 1,
              minWidth: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.success.main, 0.12),
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: (t) => `0 2px 8px ${alpha(t.palette.success.main, 0.2)}`
              }
            }}
          >
            <Typography variant="h5" fontWeight={700} color="success.main" sx={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
              {leaseStatusCounts.active}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
              Active
            </Typography>
          </Box>
<Box
            onClick={() => navigate('/landlord/leases?view=drafts')}
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.divider, 0.3),
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.5)}`,
              textAlign: 'center',
              flex: 1,
              minWidth: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.divider, 0.5),
                transform: 'translateY(-2px) scale(1.02)'
              }
            }}
          >
            <Typography variant="h5" fontWeight={600} color="text.secondary" sx={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
              {leaseStatusCounts.drafted}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
              Drafted
            </Typography>
          </Box>
          <Box
            onClick={() => navigate('/landlord/leases?view=overdue')}
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.error.main, 0.06),
              border: (t) => `1px solid ${alpha(t.palette.error.main, 0.15)}`,
              textAlign: 'center',
              flex: 1,
              minWidth: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.error.main, 0.12),
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: (t) => `0 2px 8px ${alpha(t.palette.error.main, 0.2)}`
              }
            }}
          >
            <Typography variant="h5" fontWeight={700} color="error.main" sx={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
              {leaseStatusCounts.overdue}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
              Overdue
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ mb: 1.5, borderColor: (t) => alpha(t.palette.divider, 0.08) }} />
      </Box>
      <Box
        sx={{
          maxHeight: '500px',
          overflowY: 'auto',
          px: 2,
          pb: 1.5
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '120px' }}>
            <CircularLoader />
          </Box>
        ) : displayLeases.length > 0 ? (
          <Stack spacing={0}>
            {displayLeases.map((lease, i) => {
              const leaseId = lease.leaseId || lease.LeaseId || lease.id || lease.Id;
              const dueDate = lease.dueDate || lease.DueDate;

              // Find the original lease from allLeases to check draft status and get lease name
              const originalLease = allLeases.find(l => (l.id || l.Id) === leaseId);
              
              // Format lease display name - always show lease name
              const leaseDisplayName = formatLeaseDisplay(lease, originalLease);
              
              // Check if lease is a draft (same logic as leases page)
              const isDraftedFlag = originalLease?.isDrafted ?? originalLease?.IsDrafted ?? false;
              const isDraftedByFlag = isDraftedFlag === true || isDraftedFlag === 1;
              const signatureStatus = originalLease?.signatureStatus ?? originalLease?.SignatureStatus ?? null;
              const isDraftedByStatus = signatureStatus === 0 || signatureStatus === 'NotSent' || signatureStatus === 'notsent';
              const isDraft = isDraftedByFlag || isDraftedByStatus || lease.isDraft;
              
              // Determine status: prioritize draft status over rent record status
              let displayStatus = lease.status || lease.Status || '';
              if (isDraft) {
                displayStatus = 'draft';
              }

              // Active, not overdue, not draft → show "Active" chip instead of "Up to Date"
              const isUpToDate = displayStatus === 'upToDate' || displayStatus === 'UpToDate';
              const chipLabel = !isDraft && isUpToDate ? 'Active' : formatRentStatus(displayStatus);
              const chipColor = !isDraft && isUpToDate ? 'success' : getRentStatusColor(displayStatus);

              return (
                <AnimateItem key={leaseId || i} delay={i * 50} direction="bottom">
                  <Box>
                    <Box
                      onClick={() => handleLeaseClick(leaseId)}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                          transform: 'translateX(4px)'
                        }
                      }}
                    >
                      {/* Property Name and Status Chip Row */}
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={0.75}>
                        <Typography 
                          variant="subtitle2" 
                          fontWeight={600} 
                          color="text.primary"
                          sx={{ 
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            pr: 1
                          }}
                        >
                          {leaseDisplayName}
                        </Typography>
                        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.25}>
                          <Chip
                            label={chipLabel}
                            color={chipColor}
                            size="small"
                            sx={{ 
                              flexShrink: 0,
                              height: 22,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              '& .MuiChip-label': {
                                px: 1
                              }
                            }}
                          />
                        </Box>
                      </Box>

                      {/* Rent Due Date Row */}
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {isDraft 
                          ? 'Draft lease - finish setup to continue'
                          : dueDate 
                            ? `Rent due: ${moment(dueDate).format('MMM DD, YYYY')}` 
                            : 'No due date'}
                      </Typography>
                    </Box>
                    {i < displayLeases.length - 1 && (
                      <Divider sx={{ mx: 2, borderColor: (t) => alpha(t.palette.divider, 0.08) }} />
                    )}
                  </Box>
                </AnimateItem>
              );
            })}
          </Stack>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '120px' }}>
            <Stack spacing={1} alignItems="center">
              <HomeOutlined style={{ fontSize: 40, opacity: 0.3 }} />
              <Typography variant="body2" color="text.secondary">
                No leases found
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>
    </MainCard>
  );
}

