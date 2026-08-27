import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Stack,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons';

import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import useOrganizationSummary from 'hooks/useOrganizationSummary';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import { generatePortfolioSummaryItems } from 'utils/portfolioSummaryGeneration';
import { createPortfolioScopeGuard, makePortfolioScopeKey } from 'utils/portfolioSummaryScope';

function extractSuggestedActions(data) {
  const suggested = [];

  // Rent guidance is navigation-only. Percy mutations are intentionally
  // unavailable until they can execute through the confirmation policy.
  if (data?.rentStatus?.overdue?.length > 0) {
    const first = data.rentStatus.overdue[0];
    suggested.push({
      action: 'navigateToPage',
      params: { route: first.leaseId ? `/landlord/leases/${first.leaseId}` : '/landlord/leases', leaseId: first.leaseId },
      label: 'View overdue lease',
      tooltip: 'Review the overdue lease'
    });
  }

  // Rent due soon
  if (data?.rentStatus?.dueSoon?.length > 0) {
    const first = data.rentStatus.dueSoon[0];
    suggested.push({
      action: 'navigateToPage',
      params: { route: first.leaseId ? `/landlord/leases/${first.leaseId}` : '/landlord/leases', leaseId: first.leaseId },
      label: 'View upcoming rent',
      tooltip: 'Review the lease and payment status'
    });
  }

  // Expiring leases
  if (data?.leaseExpirations?.length > 0) {
    const first = data.leaseExpirations[0];
    suggested.push({
      action: 'navigateToPage',
      params: { route: `/landlord/leases/${first.id}`, leaseId: first.id },
      label: 'View lease',
      tooltip: `View expiring lease${first.propertyName ? ` for ${first.propertyName}` : ''}`
    });
  }

  // Pending applications
  if (data?.applications?.length > 0) {
    const first = data.applications[0];
    const nameWords = first.applicantName?.split(' ') || [];
    const shortName = nameWords.length > 2 ? nameWords.slice(0, 2).join(' ') : first.applicantName;
    suggested.push({
      action: 'viewApplication',
      params: { applicationId: first.id, applicantName: first.applicantName },
      label: `Review ${shortName}'s application`,
      tooltip: `Review ${first.applicantName}'s application`
    });
  }

  // Maintenance requests
  if (data?.maintenanceRequests?.length > 0) {
    const first = data.maintenanceRequests[0];
    const titleWords = first.title?.split(' ') || [];
    const shortTitle = titleWords.length > 4 ? titleWords.slice(0, 4).join(' ') : first.title;
    suggested.push({
      action: 'viewMaintenanceRequest',
      params: { maintenanceRequestId: first.id, title: first.title },
      label: `View ${shortTitle} maintenance`,
      tooltip: `View "${first.title}" maintenance request`
    });
  }

  // Upcoming leases → view property
  if (data?.upcomingLeases?.length > 0) {
    const uniqueProperties = new Map();
    data.upcomingLeases.forEach((lease) => {
      if (lease.propertyId && !uniqueProperties.has(lease.propertyId)) {
        uniqueProperties.set(lease.propertyId, { propertyId: lease.propertyId, propertyName: lease.propertyName });
      }
    });
    uniqueProperties.forEach((property) => {
      const propertyWords = property.propertyName?.split(' ') || [];
      const shortName = propertyWords.length > 3 ? propertyWords.slice(0, 3).join(' ') : property.propertyName;
      suggested.push({
        action: 'navigateToPage',
        params: { route: `/landlord/property/${property.propertyId}` },
        label: `View ${shortName}`,
        tooltip: `View ${property.propertyName}`
      });
    });
  }

  // Unsigned leases
  if (data?.leases?.length > 0) {
    const unsigned = data.leases.filter(
      (l) => l.signatureStatus !== 'Completed' && ['NotSent', 'Sent', 'InProgress', 'PartiallySigned'].includes(l.signatureStatus)
    );
    if (unsigned.length > 0) {
      const notSent = unsigned.filter((l) => l.signatureStatus === 'NotSent');
      if (notSent.length > 0) {
        const first = notSent[0];
        suggested.push({
          action: 'navigateToPage',
          params: {
            route: `/landlord/lease-agreement-builder?leaseId=${first.leaseId}${first.propertyId ? `&propertyId=${first.propertyId}` : ''}${first.unitId ? `&unitId=${first.unitId}` : ''}`
          },
          label: 'Sign lease',
          tooltip: `Sign the lease for ${first.propertyName}${first.unitName ? ` - ${first.unitName}` : ''}`
        });
      }
      const awaitingSignature = unsigned.find((l) => l.signatureStatus !== 'NotSent');
      if (awaitingSignature) {
        suggested.push({
          action: 'navigateToPage',
          params: { route: `/landlord/leases/${awaitingSignature.leaseId}`, leaseId: awaitingSignature.leaseId },
          label: 'Review signature status',
          tooltip: 'Review the lease signature status'
        });
      }
    }
  }

  // Tenants without accounts
  if (data?.leases?.length > 0) {
    for (const lease of data.leases) {
      if (!lease.isActive) continue;
      const noAccount = lease.tenants?.filter((t) => !t.hasAccount) || [];
      if (noAccount.length > 0) {
        suggested.push({
          action: 'navigateToPage',
          params: { route: lease.unitId ? `/landlord/unit/${lease.unitId}` : '/landlord/households' },
          label: 'Review tenant account',
          tooltip: 'Review tenant account setup details'
        });
        break;
      }
    }
  }

  // Unpaid deposits
  if (data?.importantTasks?.length > 0) {
    const depositTasks = data.importantTasks.filter((t) => t.type === 'UnpaidDeposit');
    if (depositTasks.length > 0) {
      const first = depositTasks[0];
      const leaseMatch = data?.leases?.find((l) => {
        if (!l.propertyName || !l.unitName) return false;
        const desc = first.description || '';
        return desc.includes(l.propertyName) && desc.includes(l.unitName);
      });
      if (leaseMatch) {
        const hasTenants = leaseMatch.tenants?.length > 0;
        const hasContactInfo = hasTenants && leaseMatch.tenants.some((t) => t.email?.trim().length > 0 || t.phoneNumber?.trim().length > 0);
        if (!hasTenants || !hasContactInfo) {
          suggested.push({
            action: 'navigateToPage',
            params: {
              route: leaseMatch.unitId
                ? `/landlord/unit/${leaseMatch.unitId}`
                : leaseMatch.propertyId
                ? `/landlord/property/${leaseMatch.propertyId}`
                : '/landlord/households'
            },
            label: 'Add tenant info',
            tooltip: `Add tenant information to this unit`
          });
        } else {
          suggested.push({
            action: 'navigateToPage',
            params: { route: `/landlord/leases/${leaseMatch.leaseId}`, leaseId: leaseMatch.leaseId },
            label: 'Review unpaid deposit',
            tooltip: 'Review the lease deposit status'
          });
        }
      }
    }

    // Incomplete checklists
    const checklistTasks = data.importantTasks.filter((t) =>
      ['IncompleteMoveInChecklist', 'MissingMoveInChecklist', 'IncompleteMoveOutChecklist', 'MissingMoveOutChecklist'].includes(t.type)
    );
    if (checklistTasks.length > 0) {
      const first = checklistTasks[0];
      const propertyMatch = data?.properties?.find((p) => p.name && (first.description || '').includes(p.name));
      if (propertyMatch?.id) {
        suggested.push({
          action: 'navigateToPage',
          params: { route: `/landlord/property/${propertyMatch.id}` },
          label: 'View checklists',
          tooltip: `View checklists for ${propertyMatch.name}`
        });
      }
    }
  }

  // Urgent messages
  if (data?.urgentMessages?.length > 0) {
    const first = data.urgentMessages[0];
    const nameWords = first.tenantName?.split(' ') || [];
    const shortName = nameWords.length > 2 ? nameWords.slice(0, 2).join(' ') : first.tenantName;
    suggested.push({
      action: 'navigateToPage',
      params: { route: `/landlord/messages?conversation=${first.conversationId}` },
      label: first.tenantName ? `View message from ${shortName}` : 'View urgent message',
      tooltip: `View urgent message${first.tenantName ? ` from ${first.tenantName}` : ''}`
    });
  }

  // View all lists
  if (data?.maintenanceRequests?.length > 1) {
    suggested.push({
      action: 'navigateToPage',
      params: { route: '/landlord/maintenances' },
      label: 'View all maintenance requests',
      tooltip: 'View all maintenance requests'
    });
  }
  if (data?.applications?.length > 1) {
    suggested.push({
      action: 'navigateToPage',
      params: { route: '/landlord/listings?tab=applications' },
      label: 'View all applications',
      tooltip: 'View all applications'
    });
  }

  return suggested.slice(0, 8);
}

function getDetailModalData(item, summaryData) {
  if (!item?.action || !summaryData) return null;
  const { action: actionType, params } = item.action;

  if (actionType === 'viewMaintenanceRequest') {
    const mr = summaryData.maintenanceRequests?.find((m) => m.id === params.maintenanceRequestId);
    return {
      type: 'maintenance',
      title: mr?.title || params.title || 'Maintenance Request',
      fields: [
        { label: 'Property', value: mr?.propertyName || '—' },
        { label: 'Priority', value: mr?.priority || '—' },
        { label: 'Status', value: mr?.status || '—' },
        { label: 'Days Open', value: mr?.daysOpen != null ? `${mr.daysOpen} days` : '—' },
        { label: 'Reported By', value: mr?.tenantName || '—' }
      ],
      navigateTo: `/landlord/maintenance/${params.maintenanceRequestId}`,
      navigateLabel: 'View Maintenance'
    };
  }

  if (actionType === 'viewApplication') {
    const app = summaryData.applications?.find((a) => a.id === params.applicationId);
    return {
      type: 'application',
      applicationId: params.applicationId,
      title: app?.applicantName || params.applicantName || 'Application',
      fields: [
        { label: 'Property', value: app?.propertyName || '—' },
        { label: 'Unit', value: app?.unitName || '—' },
        { label: 'Status', value: app?.status || '—' },
        { label: 'Days Pending', value: app?.daysPending != null ? `${app.daysPending} days` : '—' },
        { label: 'Submitted', value: app?.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—' }
      ],
      navigateTo: `/landlord/listings?tab=applications&applicationId=${params.applicationId}`,
      navigateLabel: 'View Application'
    };
  }

  if (actionType === 'navigateToPage') {
    const route = params.route;

    // Lease agreement builder → lease signing
    if (route?.includes('lease-agreement-builder')) {
      const leaseIdMatch = route.match(/leaseId=(\d+)/);
      const leaseId = leaseIdMatch ? parseInt(leaseIdMatch[1]) : null;
      const lease = leaseId ? summaryData.leases?.find((l) => l.leaseId === leaseId) : summaryData.leases?.[0];
      return {
        type: 'lease',
        title: lease?.propertyName ? `Lease — ${lease.propertyName}${lease.unitName ? ` · ${lease.unitName}` : ''}` : 'Lease Agreement',
        fields: [
          { label: 'Property', value: lease?.propertyName || '—' },
          { label: 'Unit', value: lease?.unitName || '—' },
          { label: 'Tenants', value: lease?.tenants?.map((t) => t.tenantName).join(', ') || '—' },
          { label: 'Signature Status', value: lease?.signatureStatus || '—' },
          { label: 'Start Date', value: lease?.startDate ? new Date(lease.startDate).toLocaleDateString() : '—' },
          { label: 'Rent', value: lease?.rentAmount != null ? `$${lease.rentAmount.toFixed(2)}/mo` : '—' }
        ],
        navigateTo: route,
        navigateLabel: 'Go to Lease Signing'
      };
    }

    // Property page
    const propIdMatch = route.match(/\/landlord\/property\/(\d+)/);
    if (propIdMatch) {
      const propertyId = parseInt(propIdMatch[1]);
      const prop = summaryData.properties?.find((p) => p.id === propertyId);
      const upcoming = summaryData.upcomingLeases?.filter((l) => l.propertyId === propertyId) || [];
      return {
        type: 'property',
        title: prop?.name || 'Property',
        fields: [
          { label: 'Address', value: prop?.address || '—' },
          { label: 'Units', value: prop?.unitCount != null ? `${prop.unitCount} units` : '—' },
          { label: 'Occupancy', value: prop?.occupancyRate != null ? `${prop.occupancyRate.toFixed(1)}%` : '—' },
          ...(upcoming.length > 0
            ? [{ label: 'Upcoming Leases', value: `${upcoming.length} lease${upcoming.length > 1 ? 's' : ''} starting soon` }]
            : [])
        ],
        navigateTo: route,
        navigateLabel: 'View Property'
      };
    }

    // Messages
    if (route?.includes('/landlord/messages')) {
      const convIdMatch = route.match(/conversation=(\d+)/);
      const convId = convIdMatch ? parseInt(convIdMatch[1]) : null;
      const msg = convId ? summaryData.urgentMessages?.find((m) => m.conversationId === convId) : summaryData.urgentMessages?.[0];
      return {
        type: 'message',
        title: msg?.tenantName ? `Message from ${msg.tenantName}` : 'Urgent Message',
        fields: [
          { label: 'Tenant', value: msg?.tenantName || '—' },
          { label: 'Property', value: msg?.propertyName || '—' },
          { label: 'Unit', value: msg?.unitName || '—' },
          ...(msg?.urgentItems?.length > 0
            ? msg.urgentItems.map((ui) => ({
                label: `${ui.type} (${ui.severity})`,
                value: ui.description || '—'
              }))
            : msg?.aiSummary
            ? [{ label: 'Summary', value: msg.aiSummary }]
            : [])
        ],
        navigateTo: route,
        navigateLabel: 'View Message'
      };
    }

    // Unit page
    const unitIdMatch = route.match(/\/landlord\/unit\/(\d+)/);
    if (unitIdMatch) {
      return {
        type: 'generic',
        title: item.title,
        description: item.description,
        navigateTo: route,
        navigateLabel: 'View Unit'
      };
    }

    // Generic page navigation
    return {
      type: 'generic',
      title: item.title,
      description: item.description,
      navigateTo: route,
      navigateLabel: item.action.label || 'Go There'
    };
  }

  if (actionType === 'navigateToSpecificItem') {
    const { dataType, propertyName } = params;
    if (dataType === 'navigateToLease' && propertyName) {
      const lease = summaryData.rentStatus?.overdue?.find(
        (l) => l.propertyName?.toLowerCase().includes(propertyName.toLowerCase())
      ) || summaryData.rentStatus?.dueSoon?.find(
        (l) => l.propertyName?.toLowerCase().includes(propertyName.toLowerCase())
      );
      return {
        type: 'generic',
        title: `Lease — ${propertyName}`,
        fields: lease ? [
          { label: 'Property', value: lease.propertyName || '—' },
          { label: 'Amount', value: lease.amount != null ? `$${lease.amount.toFixed(2)}` : '—' }
        ] : [],
        navigateTo: lease?.leaseId ? `/landlord/leases/${lease.leaseId}` : '/landlord/leases',
        navigateLabel: 'View Lease'
      };
    }
    return {
      type: 'generic',
      title: item.title,
      description: item.description,
      navigateTo: null,
      navigateLabel: 'Go There'
    };
  }

  return null;
}

const NAVIGATION_ACTIONS = new Set([
  'viewMaintenanceRequest',
  'viewApplication',
  'navigateToPage',
  'navigateToSpecificItem'
]);

function getPriorityColor(priority) {
  const p = priority?.toLowerCase();
  if (p === 'high') return 'error';
  if (p === 'medium') return 'warning';
  return 'info';
}


export default function PortfolioSummaryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const theme = useTheme();

  const { data: summaryData, loading: dataLoading, error: dataError, refetch } = useOrganizationSummary();

  const userId = user?.id ?? user?.Id ?? user?.email ?? user?.Email ?? null;
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const scopeKey = makePortfolioScopeKey({ userId, organizationId, organizationLoading });
  const scopeGuardRef = useRef(null);
  const summaryGenerationRef = useRef(0);
  if (!scopeGuardRef.current) scopeGuardRef.current = createPortfolioScopeGuard();
  // Advance during render: a prior-scope completion is stale immediately,
  // without a post-render window before the reset effect runs.
  scopeGuardRef.current.switchScope(scopeKey);

  const [generating, setGenerating] = useState(false);
  const [summaryItems, setSummaryItems] = useState([]);
  const [generationAttempted, setGenerationAttempted] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [stateScopeKey, setStateScopeKey] = useState(scopeKey);

  // Per-item action states: { [itemIndex]: 'idle' | 'loading' | 'completed' | 'failed' }
  const [actionStates, setActionStates] = useState({});

  // Detail modal for review/navigation-type actions
  const [detailModal, setDetailModal] = useState(null);

  // Scope all generated content, flags, action state, and dialogs by the
  // authoritative user + active organization. Old state is hidden during the
  // render before this reset effect executes (see scopeIsVisible below).
  useEffect(() => {
    scopeGuardRef.current.switchScope(scopeKey);
    setStateScopeKey(scopeKey);
    setGenerating(false);
    setSummaryItems([]);
    setGenerationAttempted(false);
    setGenerationError(null);
    setActionStates({});
    setDetailModal(null);
  }, [scopeKey]);

  const generateSummary = useCallback(() => {
    if (!summaryData) return;
    summaryGenerationRef.current += 1;
    setGenerating(true);
    setGenerationError(null);
    // Item positions are not identities. Clear all state tied to the previous
    // generated list before replacing it with the latest authoritative list.
    setSummaryItems([]);
    setActionStates({});
    setDetailModal(null);

    try {
      setSummaryItems(generatePortfolioSummaryItems(summaryData, extractSuggestedActions(summaryData)));
    } catch (err) {
      console.error('Error generating portfolio summary:', err);
      setGenerationError(err.message || 'Failed to generate summary');
    } finally {
      setGenerating(false);
    }
  }, [summaryData]);

  // Regenerate from every authoritative summaryData value. generationAttempted
  // is display state only; gating on it would leave successful refetches stale.
  useEffect(() => {
    if (stateScopeKey === scopeKey && !dataLoading && summaryData) {
      setGenerationAttempted(true);
      generateSummary();
    }
  }, [stateScopeKey, scopeKey, dataLoading, summaryData, generateSummary]);


  // visual reset, but no in-flight action/preview completion can publish after
  // this handler is entered, and a failed refresh leaves no stale actions.
  const handleRefresh = useCallback(() => {
    scopeGuardRef.current.invalidate(scopeKey);
    summaryGenerationRef.current += 1;
    setGenerating(false);
    setSummaryItems([]);
    setGenerationAttempted(false);
    setGenerationError(null);
    setActionStates({});
    setDetailModal(null);
    return refetch();
  }, [scopeKey, refetch]);
  const openDetailModal = useCallback(
    (item) => {
      const modalData = getDetailModalData(item, summaryData);
      if (modalData) {
        setDetailModal({ item, data: modalData });
      } else if (item.action?.params?.route) {
        navigate(item.action.params.route);
      }
    },
    [summaryData, navigate]
  );

  const isLoading = dataLoading || generating;
  const scopeIsVisible = stateScopeKey === scopeKey;
  const visibleSummaryItems = scopeIsVisible ? summaryItems : [];
  const visibleGenerationAttempted = scopeIsVisible && generationAttempted;
  const visibleDetailModal = scopeIsVisible ? detailModal : null;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate('/landlord/dashboard')}
          variant="text"
          size="small"
          sx={{ textTransform: 'none', color: 'primary.main', fontWeight: 600, mb: 1, pl: 0 }}
        >
          Back to Dashboard
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              Portfolio Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Current attention items from your portfolio data
            </Typography>
          </Box>
          {visibleGenerationAttempted && !generating && (
            <Button
              startIcon={<ReloadOutlined />}
              onClick={handleRefresh}
              variant="text"
              size="small"
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Refresh
            </Button>
          )}
        </Box>
      </Box>

      {/* Error states */}
      {dataError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load portfolio data: {dataError}
        </Alert>
      )}
      {generationError && (
        <Alert severity="error" sx={{ mb: 3 }} action={
          <Button size="small" onClick={generateSummary}>Retry</Button>
        }>
          {generationError}
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 3 }}>
          <CircularProgress size={56} thickness={4} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {dataLoading ? 'Loading your portfolio data...' : 'Preparing your portfolio summary...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dataLoading
                ? 'Fetching properties, leases, and maintenance requests'
                : 'Organizing current portfolio items by priority'}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Summary Items Grid */}
      {!isLoading && visibleSummaryItems.length > 0 && (
        <AnimateIn direction="bottom" delay={100} distance={60}>
        <Stack spacing={2}>
          {['High', 'Medium', 'Low'].map((priority) => {
            const group = visibleSummaryItems.filter((item) => item.priority?.toLowerCase() === priority.toLowerCase());
            if (group.length === 0) return null;
            const color = getPriorityColor(priority);
            return (
              <MainCard key={priority} content={false}>
                {/* Priority section header */}
                <Box
                  sx={{
                    px: 3,
                    py: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: (t) => alpha(t.palette[color].main, 0.05),
                    borderLeft: 3,
                    borderLeftColor: `${color}.main`
                  }}
                >
                  <Chip label={priority} color={color} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                  <Typography variant="caption" color="text.secondary">
                    {group.length} item{group.length > 1 ? 's' : ''}
                  </Typography>
                </Box>

                {group.map((item) => {
                  const index = visibleSummaryItems.indexOf(item);
                  const isNavAction = NAVIGATION_ACTIONS.has(item.action?.action);

                  return (
                    <Box key={index}>
                      <Divider />
                      <Box
                        sx={{
                          px: 3,
                          py: 2,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 2,
                          flexWrap: { xs: 'wrap', sm: 'nowrap' }
                        }}
                      >
                        {/* Item number */}
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 28, mt: 0.3, flexShrink: 0 }}>
                          #{index + 1}
                        </Typography>

                        {/* Title + description */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, lineHeight: 1.4 }}>
                            {item.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            {item.description}
                          </Typography>
                        </Box>

                        {/* Action button */}
                        {item.action && isNavAction && (
                          <Box sx={{ flexShrink: 0, width: { xs: '100%', sm: 160 } }}>
                            <Button
                              fullWidth
                              variant="contained"
                              color="primary"
                              size="small"
                              startIcon={<EyeOutlined />}
                              onClick={() => openDetailModal(item)}
                              sx={{ textTransform: 'none', borderRadius: 1.5 }}
                            >
                              {item.action.label || 'Open workflow'}
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </MainCard>
            );
          })}
        </Stack>
        </AnimateIn>
      )}

      {/* Empty state (after generation, no items) */}
      {!isLoading && visibleGenerationAttempted && !generating && visibleSummaryItems.length === 0 && !generationError && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ThunderboltOutlined style={{ fontSize: 48, color: theme.palette.text.disabled }} />
          <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
            No items found
          </Typography>
        </Box>
      )}


      {/* Detail Modal */}
      <Dialog
        open={Boolean(visibleDetailModal)}
        onClose={() => setDetailModal(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {visibleDetailModal && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.4 }}>
                {visibleDetailModal.data.title}
              </Typography>
              {visibleDetailModal.item?.priority && (
                <Chip
                  label={visibleDetailModal.item.priority}
                  color={getPriorityColor(visibleDetailModal.item.priority)}
                  size="small"
                  sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                />
              )}
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ pt: 2 }}>
              {/* Description */}
              {visibleDetailModal.data.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {visibleDetailModal.data.description}
                </Typography>
              )}

              {/* Key fields */}
              {visibleDetailModal.data.fields?.length > 0 && (
                <Stack spacing={1.5}>
                  {visibleDetailModal.data.fields.filter((f) => f.value && f.value !== '—').map((field, i) => (
                    <Box key={i}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {field.label}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.25 }}>
                        {field.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}

            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 2.5, py: 2, gap: 1 }}>
              <Button
                onClick={() => setDetailModal(null)}
                variant="outlined"
                size="small"
                sx={{ textTransform: 'none', borderRadius: 1.5, flex: 1 }}
              >
                Close
              </Button>
              {visibleDetailModal.data.navigateTo && (
                <Button
                  onClick={() => {
                    navigate(visibleDetailModal.data.navigateTo);
                    setDetailModal(null);
                  }}
                  variant="contained"
                  size="small"
                  sx={{ textTransform: 'none', borderRadius: 1.5, flex: 2 }}
                >
                  {visibleDetailModal.data.navigateLabel || 'View'} →
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
