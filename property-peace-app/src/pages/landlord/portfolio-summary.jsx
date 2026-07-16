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
  TextField,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  EyeOutlined,
  ToolOutlined,
  ReloadOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { useSnackbar } from 'notistack';

import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import useOrganizationSummary from 'hooks/useOrganizationSummary';
import { streamChatCompletion, isConfigured } from 'services/azureAIService';
import { SYSTEM_PROMPT, buildSummaryPrompt } from 'services/copilotPrompts';
import { executeAction, approveApplication as approveApplicationAction, sendAIFollowUpAction } from 'services/copilotActions';
import { previewAIFollowUp } from 'api/aiFollowUp';
import useAuth from 'hooks/useAuth';
import { useDrawer } from 'contexts/DrawerContext';

// ─── Pure helper functions ──────────────────────────────────────────────────

function hasTenantEmails(leaseId, data) {
  if (!data?.leases) return false;
  const lease = data.leases.find((l) => l.leaseId === leaseId);
  if (!lease?.tenants?.length) return false;
  return lease.tenants.some((t) => t.email?.trim().length > 0);
}

function hasDataToSummarize(data) {
  if (!data) return false;
  return (
    data.rentStatus?.overdue?.length > 0 ||
    data.rentStatus?.dueSoon?.length > 0 ||
    data.maintenanceRequests?.length > 0 ||
    data.applications?.length > 0 ||
    data.leaseExpirations?.length > 0 ||
    data.importantTasks?.length > 0 ||
    data.urgentMessages?.length > 0 ||
    data.properties?.length > 0
  );
}

function extractSuggestedActions(data) {
  const suggested = [];

  // Overdue rent
  if (data?.rentStatus?.overdue?.length > 0) {
    const first = data.rentStatus.overdue[0];
    const tenantNames = first.tenantNames?.join(' and ') || 'Tenants';
    const isSuppressed = data?.suppressedActions?.some(
      (s) => s.actionType === 'sendAIFollowUp_OverdueRent' && s.entityId === first.leaseId
    );
    if (!isSuppressed && hasTenantEmails(first.leaseId, data)) {
      suggested.push({
        action: 'sendAIFollowUp',
        params: {
          actionType: 'sendAIFollowUp_OverdueRent',
          entityId: first.leaseId,
          context: {
            propertyName: first.propertyName,
            unitName: first.unitName,
            tenantNames: first.tenantNames,
            overdueAmount: first.amount,
            daysOverdue: first.daysOverdue
          }
        },
        label: 'Message tenant about rent',
        tooltip: `Send AI follow-up to ${tenantNames} about overdue rent`
      });
    }
  }

  // Rent due soon
  if (data?.rentStatus?.dueSoon?.length > 0) {
    const first = data.rentStatus.dueSoon[0];
    const tenantNames = first.tenantNames?.join(' & ') || 'Tenants';
    if (hasTenantEmails(first.leaseId, data)) {
      suggested.push({
        action: 'sendRentReminder',
        params: { leaseId: first.leaseId },
        label: 'Message tenant about rent',
        tooltip: `Send payment reminder to ${tenantNames}`
      });
    }
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
      const other = unsigned.filter((l) => l.signatureStatus !== 'NotSent');

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
      if (other.length > 0) {
        const first = other[0];
        const isSuppressed = data?.suppressedActions?.some(
          (s) => s.actionType === 'sendAIFollowUp_LeaseSigning' && s.entityId === first.leaseId
        );
        if (!isSuppressed && first.tenants?.some((t) => t.email?.trim().length > 0)) {
          suggested.push({
            action: 'sendAIFollowUp',
            params: {
              actionType: 'sendAIFollowUp_LeaseSigning',
              entityId: first.leaseId,
              context: {
                propertyName: first.propertyName,
                unitName: first.unitName,
                tenantNames: first.tenants?.map((t) => t.tenantName) || [],
                startDate: first.startDate,
                endDate: first.endDate,
                rentAmount: first.rentAmount
              }
            },
            label: 'Message tenant about lease signing',
            tooltip: `Follow up with tenant to sign the lease agreement`
          });
        }
      }
    }
  }

  // Tenants without accounts
  if (data?.leases?.length > 0) {
    for (const lease of data.leases) {
      if (!lease.isActive) continue;
      const noAccount = lease.tenants?.filter((t) => !t.hasAccount) || [];
      if (noAccount.length > 0) {
        const first = noAccount[0];
        const isSuppressed = data?.suppressedActions?.some(
          (s) => s.actionType === 'sendAIFollowUp_TenantAccount' && s.entityId === first.tenantId
        );
        if (!isSuppressed && first.email?.trim().length > 0) {
          suggested.push({
            action: 'sendAIFollowUp',
            params: {
              actionType: 'sendAIFollowUp_TenantAccount',
              entityId: first.tenantId,
              context: { tenantName: first.tenantName, propertyName: lease.propertyName, unitName: lease.unitName }
            },
            label: 'Message tenant about account setup',
            tooltip: `Send AI follow-up to ${first.tenantName} about creating account`
          });
          break;
        }
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
          const isSuppressed = data?.suppressedActions?.some(
            (s) => s.actionType === 'sendAIFollowUp_Deposit' && s.entityId === leaseMatch.leaseId
          );
          if (!isSuppressed && leaseMatch.tenants?.some((t) => t.email?.trim().length > 0)) {
            const tenantNames = leaseMatch.tenants?.map((t) => t.tenantName).join(' and ') || 'Tenants';
            suggested.push({
              action: 'sendAIFollowUp',
              params: {
                actionType: 'sendAIFollowUp_Deposit',
                entityId: leaseMatch.leaseId,
                context: { propertyName: leaseMatch.propertyName, unitName: leaseMatch.unitName, tenantNames }
              },
              label: 'Message tenant about deposit',
              tooltip: `Send AI follow-up to ${tenantNames} about unpaid deposit`
            });
          }
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
    const maintenanceItems = first.urgentItems?.filter(
      (item) =>
        item.type?.toLowerCase() === 'maintenance' ||
        item.type?.toLowerCase() === 'safety' ||
        item.description?.toLowerCase().includes('broken') ||
        item.description?.toLowerCase().includes('repair') ||
        item.description?.toLowerCase().includes('fix') ||
        item.description?.toLowerCase().includes('maintenance')
    ) || [];

    if (maintenanceItems.length > 0) {
      const nameWords = first.tenantName?.split(' ') || [];
      const shortName = nameWords.length > 2 ? nameWords.slice(0, 2).join(' ') : first.tenantName;
      suggested.push({
        action: 'createMaintenanceFromUrgent',
        params: { urgentMessage: first, urgentItem: maintenanceItems[0] },
        label: first.tenantName ? `Create maintenance for ${shortName}` : 'Create maintenance ticket',
        tooltip: `Create maintenance ticket${first.tenantName ? ` for ${first.tenantName}` : ''}`
      });
    } else {
      const nameWords = first.tenantName?.split(' ') || [];
      const shortName = nameWords.length > 2 ? nameWords.slice(0, 2).join(' ') : first.tenantName;
      suggested.push({
        action: 'navigateToPage',
        params: { route: `/landlord/messages?conversation=${first.conversationId}` },
        label: first.tenantName ? `View message from ${shortName}` : 'View urgent message',
        tooltip: `View urgent message${first.tenantName ? ` from ${first.tenantName}` : ''}`
      });
    }
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
      params: { route: '/landlord/applications' },
      label: 'View all applications',
      tooltip: 'View all applications'
    });
  }

  return suggested.slice(0, 8);
}

function parseSummaryItems(aiResponse, summaryData) {
  const items = [];

  const itemPattern = /(\d+)\.\s*([^(]+?)\s*\(([^)]+)\):\s*(.+?)(?=\d+\.|$)/gs;
  let match;
  while ((match = itemPattern.exec(aiResponse)) !== null) {
    const [, number, title, priority, description] = match;
    items.push({ number: parseInt(number), title: title.trim(), priority: priority.trim(), description: description.trim() });
  }

  if (items.length === 0) {
    const lines = aiResponse.split('\n');
    let currentItem = null;
    lines.forEach((line) => {
      const priorityMatch = line.match(/\(([^)]+)\)/);
      if (priorityMatch && ['high', 'medium', 'low'].includes(priorityMatch[1].toLowerCase())) {
        if (currentItem) items.push(currentItem);
        currentItem = {
          number: items.length + 1,
          title: line.split('(')[0].replace(/^\d+\.\s*/, '').trim(),
          priority: priorityMatch[1].trim(),
          description: line.split('):')[1]?.trim() || ''
        };
      } else if (currentItem && line.trim()) {
        currentItem.description += ' ' + line.trim();
      }
    });
    if (currentItem) items.push(currentItem);
  }

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  items.sort((a, b) => {
    const diff = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    return diff !== 0 ? diff : a.number - b.number;
  });

  const suggestedActions = extractSuggestedActions(summaryData);
  items.forEach((item, index) => {
    const matchingAction = suggestedActions.find((action) => {
      const lbl = action.label.toLowerCase();
      const txt = (item.title + ' ' + item.description).toLowerCase();
      if (txt.includes('maintenance') && lbl.includes('maintenance')) return true;
      if (txt.includes('rent') && lbl.includes('rent')) return true;
      if (txt.includes('application') && lbl.includes('application')) return true;
      if (txt.includes('lease') && lbl.includes('lease')) {
        const noOneSigned = txt.includes('created but no one has signed');
        const pending = txt.includes('signature pending') || txt.includes('sent for signature') || txt.includes('not yet signed') || txt.includes('pending signature');
        const isFollowUp = lbl.includes('follow up') && (lbl.includes('sign') || lbl.includes('lease'));
        const isSignLease = lbl.includes('sign lease');
        if (noOneSigned && isSignLease) return true;
        if (pending && isFollowUp) return true;
        if ((txt.includes('not sent') || txt.includes('send lease for signature')) && isSignLease) return true;
        return isSignLease || isFollowUp;
      }
      if (txt.includes('deposit')) {
        if ((txt.includes('tenant details') || txt.includes('details are missing') || txt.includes('missing')) && lbl.includes('tenant')) return true;
        if (lbl.includes('deposit')) return true;
      }
      if (txt.includes('message') && lbl.includes('message')) return true;
      return false;
    });
    item.action = matchingAction || suggestedActions[index] || null;
  });

  return items;
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
      navigateTo: `/landlord/applications?applicationId=${params.applicationId}`,
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

const API_ACTIONS = new Set([
  'sendAIFollowUp',
  'sendRentReminder',
  'sendPaymentReminder',
  'approveApplication',
  'sendLeaseRenewalNotice',
  'resendInvite'
]);

function getPriorityColor(priority) {
  const p = priority?.toLowerCase();
  if (p === 'high') return 'error';
  if (p === 'medium') return 'warning';
  return 'info';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PortfolioSummaryPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const drawer = useDrawer();
  const theme = useTheme();

  const { data: summaryData, loading: dataLoading, error: dataError, refetch } = useOrganizationSummary();
  const configured = isConfigured();

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [summaryItems, setSummaryItems] = useState([]);
  const [generationAttempted, setGenerationAttempted] = useState(false);
  const [generationError, setGenerationError] = useState(null);

  // Per-item action states: { [itemIndex]: 'idle' | 'loading' | 'completed' | 'failed' }
  const [actionStates, setActionStates] = useState({});

  // Detail modal for navigation-type actions
  const [detailModal, setDetailModal] = useState(null);
  // Approve action state within detail modal
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveState, setApproveState] = useState(null); // null | 'completed' | 'failed'

  // Follow-up preview modal
  const [followUpModal, setFollowUpModal] = useState(null);
  // null | { item, itemIndex, loading, inAppMessage, emailSubject, emailBody, sending, error }

  const generateSummary = useCallback(async () => {
    if (!summaryData || !configured) return;
    setGenerating(true);
    setStreamText('');
    setSummaryItems([]);
    setGenerationError(null);
    setActionStates({});

    if (!hasDataToSummarize(summaryData)) {
      setSummaryItems([
        {
          number: 1,
          title: 'All Clear!',
          priority: 'Low',
          description: 'You have no overdue payments, pending maintenance requests, or applications requiring attention at this time.',
          action: null
        }
      ]);
      setGenerating(false);
      return;
    }

    try {
      const landlordName = user?.firstname || user?.Firstname || null;
      const userPrompt = buildSummaryPrompt(summaryData, landlordName);
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ];

      let fullResponse = '';
      await streamChatCompletion(
        messages,
        (chunk, accumulated) => {
          if (!mountedRef.current) return;
          fullResponse = accumulated;
          setStreamText(accumulated);
        },
        { temperature: 0.7, maxTokens: 1000 }
      );

      if (!mountedRef.current) return;
      const items = parseSummaryItems(fullResponse, summaryData);
      if (items.length === 0) {
        setSummaryItems([
          {
            number: 1,
            title: 'Portfolio Summary',
            priority: 'Medium',
            description: fullResponse,
            action: null
          }
        ]);
      } else {
        setSummaryItems(items);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('Error generating portfolio summary:', err);
      setGenerationError(err.message || 'Failed to generate summary');
    } finally {
      if (!mountedRef.current) return;
      setGenerating(false);
      setStreamText('');
    }
  }, [summaryData, user, configured]);

  // Auto-start once summaryData is available
  useEffect(() => {
    if (!dataLoading && summaryData && !generationAttempted) {
      setGenerationAttempted(true);
      generateSummary();
    }
  }, [dataLoading, summaryData, generationAttempted, generateSummary]);

  const handleApiAction = useCallback(
    async (item, itemIndex) => {
      setActionStates((prev) => ({ ...prev, [itemIndex]: 'loading' }));
      try {
        const result = await executeAction(item.action, navigate, summaryData, drawer.openMaintenanceAddDrawer, refetch);

        // createMaintenanceFromUrgent opens the drawer — treat as success
        if (result.success && result.data?.action === 'openMaintenanceDrawer') {
          setActionStates((prev) => ({ ...prev, [itemIndex]: 'idle' }));
          return;
        }

        if (result.success) {
          setActionStates((prev) => ({ ...prev, [itemIndex]: 'completed' }));
          setTimeout(() => refetch(), 1500);
        } else {
          setActionStates((prev) => ({ ...prev, [itemIndex]: 'failed' }));
          enqueueSnackbar(result.message || 'Action failed', { variant: 'error', autoHideDuration: 3000 });
        }
      } catch (err) {
        setActionStates((prev) => ({ ...prev, [itemIndex]: 'failed' }));
        enqueueSnackbar('Failed to execute action', { variant: 'error', autoHideDuration: 3000 });
      }
    },
    [navigate, summaryData, drawer, refetch, enqueueSnackbar]
  );

  const handleDrawerAction = useCallback(
    async (item, itemIndex) => {
      setActionStates((prev) => ({ ...prev, [itemIndex]: 'loading' }));
      try {
        await executeAction(item.action, navigate, summaryData, drawer.openMaintenanceAddDrawer, refetch);
      } finally {
        setActionStates((prev) => ({ ...prev, [itemIndex]: 'idle' }));
      }
    },
    [navigate, summaryData, drawer, refetch]
  );

  const openDetailModal = useCallback(
    (item) => {
      const modalData = getDetailModalData(item, summaryData);
      if (modalData) {
        setDetailModal({ item, data: modalData });
        setApproveState(null);
        setApproveLoading(false);
      } else {
        // Fallback: navigate directly if we can't build modal data
        if (item.action?.params?.route) {
          navigate(item.action.params.route);
        }
      }
    },
    [summaryData, navigate]
  );

  const handleApproveInModal = useCallback(async () => {
    if (!detailModal?.data?.applicationId) return;
    setApproveLoading(true);
    try {
      const result = await approveApplicationAction(detailModal.data.applicationId);
      if (result.success) {
        setApproveState('completed');
        enqueueSnackbar('Application approved successfully', { variant: 'success', autoHideDuration: 3000 });
        setTimeout(() => refetch(), 1000);
      } else {
        setApproveState('failed');
        enqueueSnackbar(result.message || 'Failed to approve application', { variant: 'error', autoHideDuration: 3000 });
      }
    } catch {
      setApproveState('failed');
      enqueueSnackbar('Failed to approve application', { variant: 'error', autoHideDuration: 3000 });
    } finally {
      setApproveLoading(false);
    }
  }, [detailModal, refetch, enqueueSnackbar]);

  // Restore completed follow-up states from localStorage (3-day window)
  useEffect(() => {
    if (summaryItems.length === 0) return;
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const restoredStates = {};
    summaryItems.forEach((item, index) => {
      const { action: actionType, params } = item.action || {};
      if (actionType === 'sendAIFollowUp' && params?.actionType && params?.entityId) {
        const key = `portfolioFollowup_${params.actionType}_${params.entityId}`;
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const { sentAt } = JSON.parse(stored);
            if (Date.now() - new Date(sentAt).getTime() < THREE_DAYS_MS) {
              restoredStates[index] = 'completed';
            } else {
              localStorage.removeItem(key);
            }
          }
        } catch {
          localStorage.removeItem(`portfolioFollowup_${params.actionType}_${params.entityId}`);
        }
      }
    });
    if (Object.keys(restoredStates).length > 0) {
      setActionStates((prev) => ({ ...prev, ...restoredStates }));
    }
  }, [summaryItems]);

  const openFollowUpModal = useCallback(async (item, itemIndex) => {
    setFollowUpModal({ item, itemIndex, loading: true, inAppMessage: '', emailSubject: '', emailBody: '', sending: false, error: null });
    try {
      const { params } = item.action;
      const result = await previewAIFollowUp(params.actionType, params.entityId, params.context ?? null);
      if (result?.data) {
        setFollowUpModal((prev) => prev ? ({
          ...prev,
          loading: false,
          inAppMessage: result.data.inAppMessage || '',
          emailSubject: result.data.emailSubject || '',
          emailBody: result.data.emailBody || ''
        }) : null);
      } else {
        setFollowUpModal((prev) => prev ? ({ ...prev, loading: false, error: 'Failed to generate preview' }) : null);
      }
    } catch {
      setFollowUpModal((prev) => prev ? ({ ...prev, loading: false, error: 'Failed to generate preview' }) : null);
    }
  }, []);

  const handleFollowUpSend = useCallback(async () => {
    if (!followUpModal) return;
    const { item, itemIndex, inAppMessage, emailSubject, emailBody } = followUpModal;
    setFollowUpModal((prev) => prev ? ({ ...prev, sending: true, error: null }) : null);
    try {
      const result = await sendAIFollowUpAction(
        item.action.params.actionType,
        item.action.params.entityId,
        item.action.params.context ?? null,
        { inAppMessage, emailSubject, emailBody }
      );
      if (result.success) {
        const key = `portfolioFollowup_${item.action.params.actionType}_${item.action.params.entityId}`;
        localStorage.setItem(key, JSON.stringify({ sentAt: new Date().toISOString() }));
        setActionStates((prev) => ({ ...prev, [itemIndex]: 'completed' }));
        setFollowUpModal(null);
        enqueueSnackbar('Follow-up sent successfully', { variant: 'success', autoHideDuration: 3000 });
        setTimeout(() => refetch(), 1500);
      } else {
        setFollowUpModal((prev) => prev ? ({ ...prev, sending: false, error: result.message || 'Failed to send' }) : null);
      }
    } catch {
      setFollowUpModal((prev) => prev ? ({ ...prev, sending: false, error: 'Failed to send follow-up' }) : null);
    }
  }, [followUpModal, refetch, enqueueSnackbar]);

  if (!configured) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">AI Copilot is not configured. Please set Azure OpenAI environment variables.</Alert>
      </Box>
    );
  }

  const isLoading = dataLoading || generating;

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
              AI-generated insights for your portfolio
            </Typography>
          </Box>
          {generationAttempted && !generating && (
            <Button
              startIcon={<ReloadOutlined />}
              onClick={() => setGenerationAttempted(false)}
              variant="text"
              size="small"
              sx={{ textTransform: 'none', color: 'text.secondary' }}
            >
              Regenerate
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
              {dataLoading ? 'Loading your portfolio data...' : 'Analyzing your portfolio...'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {dataLoading
                ? 'Fetching properties, leases, and maintenance requests'
                : 'Our AI agent is reviewing everything and generating insights'}
            </Typography>
            {streamText && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontStyle: 'italic', maxWidth: 400 }}>
                {streamText.slice(-120)}...
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Summary Items Grid */}
      {!isLoading && summaryItems.length > 0 && (
        <AnimateIn direction="bottom" delay={100} distance={60}>
        <Stack spacing={2}>
          {['High', 'Medium', 'Low'].map((priority) => {
            const group = summaryItems.filter((item) => item.priority?.toLowerCase() === priority.toLowerCase());
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
                  const index = summaryItems.indexOf(item);
                  const actionState = actionStates[index] || 'idle';
                  const actionType = item.action?.action;
                  const isNavAction = NAVIGATION_ACTIONS.has(actionType);
                  const isApiAction = API_ACTIONS.has(actionType);
                  const isDrawerAction = actionType === 'createMaintenanceFromUrgent';

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
                        {item.action && (
                          <Box sx={{ flexShrink: 0, width: { xs: '100%', sm: 160 } }}>
                            {isApiAction && (() => {
                              const isFollowUp = actionType === 'sendAIFollowUp';
                              const completedLabel = isFollowUp ? 'Follow-up sent' : 'Completed';
                              return (
                                <Button
                                  fullWidth
                                  variant="contained"
                                  color={actionState === 'failed' ? 'error' : actionState === 'completed' ? 'success' : 'primary'}
                                  size="small"
                                  disabled={actionState === 'loading' || actionState === 'completed'}
                                  onClick={() => isFollowUp ? openFollowUpModal(item, index) : handleApiAction(item, index)}
                                  startIcon={
                                    actionState === 'loading' ? <LoadingOutlined spin /> :
                                    actionState === 'completed' ? <CheckCircleOutlined /> :
                                    actionState === 'failed' ? <CloseCircleOutlined /> :
                                    isFollowUp ? <MessageOutlined /> : null
                                  }
                                  sx={{ textTransform: 'none', borderRadius: 1.5 }}
                                >
                                  {actionState === 'loading' ? 'Working...' :
                                   actionState === 'completed' ? completedLabel :
                                   actionState === 'failed' ? 'Failed — Retry' :
                                   isFollowUp ? 'Message tenant' : item.action.label}
                                </Button>
                              );
                            })()}
                            {isNavAction && (
                              <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="small"
                                startIcon={<EyeOutlined />}
                                onClick={() => openDetailModal(item)}
                                sx={{ textTransform: 'none', borderRadius: 1.5 }}
                              >
                                View Details
                              </Button>
                            )}
                            {isDrawerAction && (
                              <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="small"
                                disabled={actionState === 'loading'}
                                startIcon={actionState === 'loading' ? <LoadingOutlined spin /> : <ToolOutlined />}
                                onClick={() => handleDrawerAction(item, index)}
                                sx={{ textTransform: 'none', borderRadius: 1.5 }}
                              >
                                {actionState === 'loading' ? 'Opening...' : item.action.label}
                              </Button>
                            )}
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
      {!isLoading && generationAttempted && !generating && summaryItems.length === 0 && !generationError && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ThunderboltOutlined style={{ fontSize: 48, color: theme.palette.text.disabled }} />
          <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
            No items found
          </Typography>
        </Box>
      )}

      {/* Follow-up Preview Modal */}
      <Dialog
        open={Boolean(followUpModal)}
        onClose={() => !followUpModal?.sending && setFollowUpModal(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {followUpModal && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                Preview & Send Follow-up
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Review and edit before sending
              </Typography>
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ pt: 2.5, pb: 1 }}>
              {followUpModal.loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
                  <CircularProgress size={36} />
                  <Typography variant="body2" color="text.secondary">
                    Generating message preview...
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={2.5}>
                  {followUpModal.error && (
                    <Alert severity="error">{followUpModal.error}</Alert>
                  )}

                  {/* In-app message */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                      In-App Message
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      maxRows={6}
                      value={followUpModal.inAppMessage}
                      onChange={(e) => setFollowUpModal((prev) => prev ? ({ ...prev, inAppMessage: e.target.value }) : null)}
                      disabled={followUpModal.sending}
                      size="small"
                    />
                  </Box>

                  <Divider />

                  {/* Email */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                      Email
                    </Typography>
                    <Stack spacing={1.5}>
                      <TextField
                        fullWidth
                        label="Subject"
                        value={followUpModal.emailSubject}
                        onChange={(e) => setFollowUpModal((prev) => prev ? ({ ...prev, emailSubject: e.target.value }) : null)}
                        disabled={followUpModal.sending}
                        size="small"
                      />
                      <TextField
                        fullWidth
                        label="Body"
                        multiline
                        minRows={4}
                        maxRows={8}
                        value={followUpModal.emailBody}
                        onChange={(e) => setFollowUpModal((prev) => prev ? ({ ...prev, emailBody: e.target.value }) : null)}
                        disabled={followUpModal.sending}
                        size="small"
                      />
                    </Stack>
                  </Box>
                </Stack>
              )}
            </DialogContent>

            <Divider />

            <DialogActions sx={{ px: 2.5, py: 2, gap: 1 }}>
              <Button
                onClick={() => setFollowUpModal(null)}
                variant="outlined"
                size="small"
                disabled={followUpModal.sending}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFollowUpSend}
                variant="contained"
                color="primary"
                size="small"
                disabled={followUpModal.loading || followUpModal.sending || !followUpModal.inAppMessage}
                startIcon={followUpModal.sending ? <LoadingOutlined spin /> : <MessageOutlined />}
                sx={{ textTransform: 'none', borderRadius: 1.5, flex: 1 }}
              >
                {followUpModal.sending ? 'Sending...' : 'Send Message'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Detail Modal */}
      <Dialog
        open={Boolean(detailModal)}
        onClose={() => setDetailModal(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        {detailModal && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.4 }}>
                {detailModal.data.title}
              </Typography>
              {detailModal.item?.priority && (
                <Chip
                  label={detailModal.item.priority}
                  color={getPriorityColor(detailModal.item.priority)}
                  size="small"
                  sx={{ mt: 0.5, fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                />
              )}
            </DialogTitle>

            <Divider />

            <DialogContent sx={{ pt: 2 }}>
              {/* Description */}
              {detailModal.data.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {detailModal.data.description}
                </Typography>
              )}

              {/* Key fields */}
              {detailModal.data.fields?.length > 0 && (
                <Stack spacing={1.5}>
                  {detailModal.data.fields.filter((f) => f.value && f.value !== '—').map((field, i) => (
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

              {/* Inline approve for applications */}
              {detailModal.data.type === 'application' && !approveState && (
                <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}` }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="success"
                    size="small"
                    disabled={approveLoading}
                    startIcon={approveLoading ? <LoadingOutlined spin /> : <CheckCircleOutlined />}
                    onClick={handleApproveInModal}
                    sx={{ textTransform: 'none', borderRadius: 1.5 }}
                  >
                    {approveLoading ? 'Approving...' : 'Approve Application'}
                  </Button>
                </Box>
              )}
              {approveState === 'completed' && (
                <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircleOutlined />}>
                  Application approved successfully
                </Alert>
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
              {detailModal.data.navigateTo && (
                <Button
                  onClick={() => {
                    navigate(detailModal.data.navigateTo);
                    setDetailModal(null);
                  }}
                  variant="contained"
                  size="small"
                  sx={{ textTransform: 'none', borderRadius: 1.5, flex: 2 }}
                >
                  {detailModal.data.navigateLabel || 'View'} →
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
