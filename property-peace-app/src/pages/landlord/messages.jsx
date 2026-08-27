import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { formatCurrency } from 'utils/formatters';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';

// Material-UI
import {
  Box,
  Grid,
  Stack,
  Typography,
  TextField,
  IconButton,
  Paper,
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Badge,
  CircularProgress,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  Chip,
  alpha,
  Container,
  Tab,
  Tabs
} from '@mui/material';

// Icons
import SendOutlined from '@ant-design/icons/SendOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import MoreOutlined from '@ant-design/icons/MoreOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import EditOutlined from '@ant-design/icons/EditOutlined';
import WarningOutlined from '@ant-design/icons/WarningOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import SafetyOutlined from '@ant-design/icons/SafetyOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import RobotOutlined from '@ant-design/icons/RobotOutlined';
import ThunderboltOutlined from '@ant-design/icons/ThunderboltOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import ArrowLeftOutlined from '@ant-design/icons/ArrowLeftOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';

// Project imports
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import Avatar from 'components/@extended/Avatar';
import TenantAddDrawer from 'components/drawers/TenantAddDrawer';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { useDrawer } from 'contexts/DrawerContext';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import {
  getConversations,
  setSelectedConversation,
  updateConversation,
  archiveConversation
} from 'store/conversation/conversation.action';
import { CONVERSATION_ACTION_TYPES } from 'store/conversation/conversation.types';
import {
  selectConversations,
  selectSelectedConversation,
  selectConversationLoading,
  selectConversationError
} from 'store/conversation/conversation.selector';
import { getMessages, addMessage, markConversationAsRead, setMessages, deleteMessage } from 'store/message/message.action';
import { selectMessages, selectMessageLoading, selectMessageError, selectCurrentConversationId } from 'store/message/message.selector';
import useSignalRConversations from 'hooks/useSignalRConversations';
import useFetchTenants from 'hooks/useFetchTenants';
import useFetchProperties from 'hooks/useFetchProperties';
import { addConversation } from 'store/conversation/conversation.action';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import { openSnackbar } from 'api/snackbar';
import { formatRelativeTime, formatMessageTime } from 'utils/formatters';
import { conversationAPI } from 'api';
import { getSuppressedMessageIds, analyzeConversation } from 'api/conversation';
import { Button, useTheme, useMediaQuery } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import ConversationTimelinePanel from 'components/conversation/ConversationTimelinePanel';
import ConversationQuickReplies from 'components/conversation/ConversationQuickReplies';
import GroupConversationManager from 'components/conversation/GroupConversationManager';
import { useOrganization } from 'contexts/OrganizationContext';
import { getSendAttempt } from 'utils/clientRequestId';

// ==============================|| MESSAGES PAGE ||============================== //

const AGENT_PURPLE = '#7c3aed';
const SENT_MESSAGE_BLUE = '#1877F2';
const MAX_MESSAGE_LENGTH = 2000;


function formatConversationTimestamp(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);
  if (diffHours < 24) {
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffHours)}h ago`;
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function getDateLabel(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Today';
  if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function copyConversation(conv) {
  if (!conv) return null;
  const copied = { ...conv };
  if (copied.participants && Array.isArray(copied.participants)) {
    copied.participants = copied.participants.map((p) => ({ ...p }));
  }
  if (copied.metadata && typeof copied.metadata === 'object' && !Array.isArray(copied.metadata)) {
    copied.metadata = { ...copied.metadata };
  }
  if (copied.messages && Array.isArray(copied.messages)) {
    copied.messages = copied.messages.map((m) => ({ ...m }));
  }
  return copied;
}

const AVATAR_COLORS = ['#e91e63', '#9c27b0', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800', '#795548', '#607d8b'];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getTenantInitials(tenant) {
  if (!tenant) return '?';
  const first = tenant.firstname?.charAt(0) || '';
  const last = tenant.lastname?.charAt(0) || '';
  return (first + last).toUpperCase() || '?';
}

function getTenantName(tenant) {
  if (!tenant) return 'Unknown';
  return `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || 'Unknown';
}

function formatTenantSince(tenant) {
  const dateStr = tenant?.leaseStart || tenant?.moveInDate || tenant?.createdAt;
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function formatUnitLabel(unitName) {
  const value = String(unitName || '').trim();
  if (!value) return null;
  return /^unit\b/i.test(value) ? value : `Unit ${value}`;
}

export default function Messages() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const theme = useTheme();
  const drawer = useDrawer();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Redux state
  const conversations = useSelector(selectConversations);
  const selectedConversation = useSelector(selectSelectedConversation);
  const loadingConversations = useSelector(selectConversationLoading);
  const conversationError = useSelector(selectConversationError);
  const messages = useSelector(selectMessages);
  const loadingMessages = useSelector(selectMessageLoading);
  const messageError = useSelector(selectMessageError);
  const currentConversationId = useSelector(selectCurrentConversationId);

  // Local state
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageDrafts, setMessageDrafts] = useState({});
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [suppressedMessageIds, setSuppressedMessageIds] = useState(new Set());
  const [switchingConvo, setSwitchingConvo] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [suggestedReplyDismissed, setSuggestedReplyDismissed] = useState(false);
  const [tenantMenuAnchor, setTenantMenuAnchor] = useState(null);
  const [tenantMenuTenant, setTenantMenuTenant] = useState(null);
  const [tenantEditOpen, setTenantEditOpen] = useState(false);
  const [tenantToEdit, setTenantToEdit] = useState(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const activeLoadConvoId = useRef(null);
  const initialLoadDone = useRef(false);
  const hasBeenLoading = useRef(false);
  const activeTabRef = useRef('all');
  const sendAttemptRef = useRef(null);

  const selectedConversationId = selectedConversation?.id || null;
  const quickReplyOrganizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const quickReplyUserId = user?.id ?? user?.Id ?? null;
  const messageInput = selectedConversationId ? messageDrafts[String(selectedConversationId)] || '' : '';
  const setConversationDraft = useCallback((conversationId, value) => {
    if (!conversationId) return;
    const key = String(conversationId);
    setMessageDrafts((previous) => {
      const nextValue = typeof value === 'function' ? value(previous[key] || '') : value;
      if (!nextValue) {
        const next = { ...previous };
        delete next[key];
        return next;
      }
      return { ...previous, [key]: nextValue };
    });
  }, []);
  const setMessageInput = useCallback(
    (value) => setConversationDraft(selectedConversationId, value),
    [selectedConversationId, setConversationDraft]
  );

  // Reset per-conversation UI state when conversation changes
  useEffect(() => {
    setSuggestedReplyDismissed(false);
  }, [selectedConversation?.id]);

  // Fetch tenants
  const { tenants, refetch: refetchTenants, isLoading: loadingTenants } = useFetchTenants();

  // Fetch properties
  const { properties, isLoading: loadingProperties } = useFetchProperties();

  const { setMessagesLoading } = useDashboardLoading();

  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // SignalR
  const { isConnected, onConversationUpdate, onMessageUpdate, joinConversation, leaveConversation } = useSignalRConversations();

  // Load conversations (uses activeTabRef so SignalR callbacks stay in sync with active tab)
  const loadConversations = useCallback(() => {
    dispatch(getConversations(activeTabRef.current === 'archived'));
  }, [dispatch]);

  const loadSuppressedMessageIds = useCallback(async () => {
    try {
      const response = await getSuppressedMessageIds();
      if (response?.suppressedMessageIds) {
        setSuppressedMessageIds(new Set(response.suppressedMessageIds));
      }
    } catch (error) {
      console.error('Error loading suppressed message IDs:', error);
    }
  }, []);

  const handleSummarize = useCallback(async () => {
    if (!selectedConversation?.id) return;
    if (!messages?.length) {
      openSnackbar({ open: true, message: 'There must be messages in the conversation to summarize.', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    setSummaryLoading(true);
    try {
      await analyzeConversation(selectedConversation.id);
      dispatch(getConversations(activeTabRef.current === 'archived'));
      openSnackbar({ open: true, message: selectedConversation.aiSummary ? 'Summary refreshed' : 'Conversation summarized', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      const errMsg = error?.response?.data?.errors?.message || error?.response?.data?.message || '';
      const isInsufficientMessages = errMsg.toLowerCase().includes('insufficient tenant');
      openSnackbar({
        open: true,
        message: isInsufficientMessages
          ? 'At least 1 tenant message is needed to summarize this conversation.'
          : 'Failed to summarize conversation',
        variant: 'alert',
        alert: { color: isInsufficientMessages ? 'warning' : 'error' }
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedConversation, messages, dispatch]);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      } else if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      }
    });
  }, []);

  const loadMessages = useCallback(
    async (conversationId) => {
      if (currentConversationId === conversationId) {
        setTimeout(() => scrollToBottom(false), 100);
        return;
      }
      activeLoadConvoId.current = conversationId;
      setSwitchingConvo(true);
      dispatch(getMessages(conversationId));
      try {
        await dispatch(markConversationAsRead(conversationId));
        dispatch(getConversations(activeTabRef.current === 'archived'));
      } catch (err) {}
      setTimeout(() => {
        scrollToBottom(false);
        if (activeLoadConvoId.current === conversationId) {
          setSwitchingConvo(false);
        }
      }, 350);
    },
    [dispatch, currentConversationId, scrollToBottom]
  );

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || sendingMessage) return;
    const content = messageInput.trim();
    const conversationId = selectedConversation.id;
    const attempt = getSendAttempt(sendAttemptRef.current, conversationId, content);
    sendAttemptRef.current = attempt;
    const optimisticId = `optimistic-${attempt.clientRequestId}`;
    const userId = user?.Id || user?.id;
    const optimisticMsg = {
      id: optimisticId,
      conversationId,
      content,
      senderId: userId,
      createdAt: new Date().toISOString(),
      isRead: false,
      _optimistic: true
    };
    setOptimisticMessages((prev) => [...prev, optimisticMsg]);
    setConversationDraft(conversationId, '');
    setSendingMessage(true);
    setTimeout(() => scrollToBottom(), 50);
    try {
      const result = await dispatch(addMessage({ conversationId, content, clientRequestId: attempt.clientRequestId }));
      if (result.success) {
        sendAttemptRef.current = null;
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        dispatch(getConversations(activeTabRef.current === 'archived'));
        setTimeout(() => scrollToBottom(), 50);
      } else {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setConversationDraft(conversationId, content);
        openSnackbar({ open: true, message: result.message || 'Message could not be sent. Please try again.', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setConversationDraft(conversationId, content);
      openSnackbar({ open: true, message: err?.message || 'Message could not be sent. Please try again.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSelectConversation = useCallback(
    (conversation) => {
      const conversationId = typeof conversation === 'object' && conversation !== null ? conversation.id : conversation;
      if (!conversationId) return;
      dispatch(setSelectedConversation(conversationId));
      setOptimisticMessages([]);
      setTimeout(() => {
        if (isConnected) joinConversation(conversationId);
        loadMessages(conversationId);
      }, 0);
    },
    [dispatch, loadMessages, isConnected, joinConversation]
  );

  const handleTabChange = useCallback(
    (_, newTab) => {
      setActiveTab(newTab);
      activeTabRef.current = newTab;
      dispatch(setSelectedConversation(null));
      setIsNewConversation(false);
      setSearchQuery('');
      dispatch(getConversations(newTab === 'archived'));
    },
    [dispatch]
  );

  const handleOpenArchiveConfirm = useCallback(() => {
    if (!selectedConversation?.id || selectedConversation.isArchived) return;
    setActionMenuAnchor(null);
    setArchiveConfirmOpen(true);
  }, [selectedConversation]);

  const handleArchive = useCallback(async () => {
    if (!selectedConversation?.id || selectedConversation.isArchived) return;
    setArchiveConfirmOpen(false);
    try {
      const result = await dispatch(archiveConversation(selectedConversation.id, true));
      if (result.success) {
        dispatch(setSelectedConversation(null));
        loadConversations();
        openSnackbar({
          open: true,
          message: 'Conversation archived.',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({
          open: true,
          message: result.message || 'Failed to archive conversation.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      console.error('Error archiving conversation:', err);
      openSnackbar({
        open: true,
        message: err?.message || 'Failed to archive conversation.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  }, [selectedConversation, dispatch, loadConversations]);

  const handleRestore = useCallback(async () => {
    if (!selectedConversation?.id || !selectedConversation.isArchived) return;
    setActionMenuAnchor(null);
    try {
      const result = await dispatch(archiveConversation(selectedConversation.id, false));
      if (result.success) {
        dispatch(setSelectedConversation(null));
        loadConversations();
        openSnackbar({ open: true, message: 'Conversation restored to the inbox.', variant: 'alert', alert: { color: 'success' } });
      } else {
        openSnackbar({ open: true, message: result.message || 'Failed to restore conversation.', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      openSnackbar({ open: true, message: err?.message || 'Failed to restore conversation.', variant: 'alert', alert: { color: 'error' } });
    }
  }, [selectedConversation, dispatch, loadConversations]);

  const filteredConversations = useMemo(() => {
    let convs = conversations;
    if (activeTab === 'archived') {
      convs = conversations.filter((c) => c.isArchived);
    } else if (activeTab === 'unread') {
      convs = conversations.filter((c) => !c.isArchived && c.unreadCount > 0 && (c.lastMessagePreview || c.lastMessageAt));
    } else {
      convs = conversations.filter((c) => !c.isArchived && (c.lastMessagePreview || c.lastMessageAt));
    }
    if (!searchQuery) return convs;
    const query = searchQuery.toLowerCase();
    return convs.filter(
      (conv) =>
        conv.title?.toLowerCase().includes(query) ||
        conv.lastMessagePreview?.toLowerCase().includes(query) ||
        conv.tenantName?.toLowerCase().includes(query) ||
        conv.propertyName?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery, activeTab]);

  const totalActiveCount = useMemo(
    () => conversations.filter((c) => !c.isArchived && (c.lastMessagePreview || c.lastMessageAt)).length,
    [conversations]
  );
  const unreadTabCount = useMemo(() => conversations.filter((c) => !c.isArchived && c.unreadCount > 0).length, [conversations]);
  const archivedTabCount = useMemo(() => conversations.filter((c) => c.isArchived).length, [conversations]);
  const showConversationListSpinner = loadingConversations && !initialLoadDone.current && filteredConversations.length === 0;

  const activeConversation = useMemo(() => {
    if (!selectedConversation) return null;
    if (typeof selectedConversation === 'object') return selectedConversation;
    return conversations.find((conversation) => String(conversation.id) === String(selectedConversation)) || null;
  }, [selectedConversation, conversations]);

  const activeTenant = useMemo(() => {
    const tenantId = activeConversation?.tenantId || activeConversation?.TenantId;
    if (!tenantId) return null;
    return tenants?.find((tenant) => String(tenant.id) === String(tenantId)) || null;
  }, [activeConversation, tenants]);

  const activePropertyId = activeConversation?.propertyId || activeConversation?.PropertyId || activeTenant?.propertyId || activeTenant?.PropertyId || null;

  const activeProperty = useMemo(() => {
    if (!activePropertyId) return null;
    return properties?.find((property) => String(property.id) === String(activePropertyId)) || null;
  }, [activePropertyId, properties]);

  // Match the tenant's actual unit
  const activeUnitFromProperty = useMemo(() => {
    if (!activeProperty) return null;
    const units = activeProperty.units || activeProperty.Units || [];
    const tenantUnitId = activeTenant?.unitId || activeTenant?.UnitId || activeConversation?.unitId || activeConversation?.UnitId;
    const tenantUnitName = activeTenant?.unitName || activeTenant?.UnitName || activeConversation?.unitName || activeConversation?.UnitName;
    const tenantLeaseId = activeTenant?.leaseId || activeTenant?.LeaseId || activeConversation?.leaseId || activeConversation?.LeaseId;

    let unit = tenantUnitId
      ? units.find((candidate) => String(candidate.id || candidate.Id) === String(tenantUnitId))
      : null;
    if (!unit && tenantLeaseId) {
      unit = units.find((candidate) => {
        const lease = candidate.lease || candidate.Lease;
        return lease && String(lease.id || lease.Id) === String(tenantLeaseId);
      });
    }
    if (!unit && tenantUnitName) {
      const normalizedUnitName = String(tenantUnitName).trim().toLowerCase();
      unit = units.find((candidate) => String(candidate.name || candidate.Name || '').trim().toLowerCase() === normalizedUnitName);
    }
    return unit || (units.length === 1 ? units[0] : null);
  }, [activeProperty, activeTenant, activeConversation]);

  const activeLeaseFromProperty = activeUnitFromProperty?.lease || activeUnitFromProperty?.Lease || null;
  const activeLeaseStatus = activeTenant?.leaseStatus || activeTenant?.status || activeConversation?.leaseStatus || (activeLeaseFromProperty ? 'Active lease' : 'No active lease');
  const isActiveLeaseStatus = ['active', 'active lease'].includes(String(activeLeaseStatus).trim().toLowerCase());

  const activeLeaseDates = [
    activeTenant?.leaseStartDate || activeTenant?.LeaseStartDate || activeLeaseFromProperty?.startDate || activeLeaseFromProperty?.StartDate,
    activeTenant?.leaseEndDate || activeTenant?.LeaseEndDate || activeLeaseFromProperty?.endDate || activeLeaseFromProperty?.EndDate
  ].filter(Boolean);
  const activeMonthlyRent = activeTenant?.rentAmount || activeTenant?.RentAmount || activeLeaseFromProperty?.rentAmount || activeLeaseFromProperty?.RentAmount || activeConversation?.monthlyRent || null;
  const activeLeaseId = activeTenant?.leaseId || activeTenant?.LeaseId || activeConversation?.leaseId || activeConversation?.LeaseId || activeLeaseFromProperty?.id || activeLeaseFromProperty?.Id || null;
  const activeUnitName = activeTenant?.unitName || activeTenant?.UnitName || activeUnitFromProperty?.name || activeUnitFromProperty?.Name;
  const activePropertyLine = [
    activeProperty?.name?.trim() || activeProperty?.streetAddress?.trim() || activeTenant?.propertyName || activeConversation?.propertyName,
    formatUnitLabel(activeUnitName)
  ].filter(Boolean).join(' · ');

  const visibleMessages = useMemo(
    () => [
      ...messages,
      ...optimisticMessages.filter((message) => String(message.conversationId) === String(activeConversation?.id))
    ],
    [messages, optimisticMessages, activeConversation?.id]
  );

  const filteredTenants = useMemo(() => {
    if (!tenants || !Array.isArray(tenants)) return [];
    if (!tenantSearchQuery.trim()) return tenants;
    const query = tenantSearchQuery.toLowerCase();
    return tenants.filter((tenant) => {
      const fullName = `${tenant.firstname || ''} ${tenant.lastname || ''}`.toLowerCase();
      const email = (tenant.email || '').toLowerCase();
      const propertyName = (tenant.propertyName || '').toLowerCase();
      const unitName = (tenant.unitName || '').toLowerCase();
      return fullName.includes(query) || email.includes(query) || propertyName.includes(query) || unitName.includes(query);
    });
  }, [tenants, tenantSearchQuery]);

  const handleOpenTenantMenu = useCallback((event, tenant) => {
    event.preventDefault();
    event.stopPropagation();
    setTenantMenuAnchor(event.currentTarget);
    setTenantMenuTenant(tenant);
  }, []);

  const handleCloseTenantMenu = useCallback(() => {
    setTenantMenuAnchor(null);
    setTenantMenuTenant(null);
  }, []);

  const handleEditTenantFromMenu = useCallback(() => {
    if (!tenantMenuTenant) return;
    setTenantToEdit(tenantMenuTenant);
    setTenantEditOpen(true);
    handleCloseTenantMenu();
  }, [handleCloseTenantMenu, tenantMenuTenant]);

  const handleCloseTenantEdit = useCallback(() => {
    setTenantEditOpen(false);
    setTenantToEdit(null);
  }, []);

  const handleTenantEditSuccess = useCallback(async () => {
    await refetchTenants?.();
  }, [refetchTenants]);

  const handleSelectTenant = useCallback(
    async (tenant) => {
      if (!tenant) return;
      const tenantUserId = tenant.userId || tenant.UserId || null;
      const tenantEmail = tenant.email?.trim();
      if (!tenantUserId && !tenantEmail) {
        openSnackbar({
          open: true,
          message: 'Add an email address before messaging this tenant.',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
      try {
        const existingConversation = conversations.find((conv) => {
          if (conv.isArchived) return false;
          if (String(conv.tenantId) === String(tenant.id)) return true;
          if (tenantUserId && conv.participants?.some((p) => String(p.userId) === String(tenantUserId))) return true;
          return tenantEmail && conv.tenantEmail?.trim()?.toLowerCase() === tenantEmail.toLowerCase();
        });
        if (existingConversation) {
          setIsNewConversation(false);
          setTenantSearchQuery('');
          handleSelectConversation(existingConversation);
          return;
        }
        const property = properties?.find((p) => p.id === tenant.propertyId);
        const propertyName = property?.name?.trim() || property?.streetAddress?.trim() || tenant.propertyName || 'Property';
        const isMultiUnit = tenant.propertyType?.toLowerCase() !== 'singlefamily';
        const conversationTitle = isMultiUnit && tenant.unitName ? `${propertyName} - ${tenant.unitName}` : propertyName;
        const conversationData = {
          Title: conversationTitle,
          TenantId: tenant.id,
          PropertyId: tenant.propertyId || null,
          LeaseId: tenant.leaseId || null,
          ParticipantUserIds: tenantUserId ? [tenantUserId] : [],
          IsGroupChat: false
        };
        const result = await dispatch(addConversation(conversationData));
        if (result.success && result.data) {
          const newConversation = result.data;
          if (newConversation?.id) {
            setIsNewConversation(false);
            setTenantSearchQuery('');
            setTimeout(() => {
              handleSelectConversation(newConversation.id);
              dispatch(getConversations(false));
            }, 50);
          } else {
            setIsNewConversation(false);
            setTenantSearchQuery('');
            openSnackbar({ open: true, message: 'Conversation created but could not be opened. Please refresh.', variant: 'alert', alert: { color: 'warning' } });
          }
        } else {
          setIsNewConversation(false);
          setTenantSearchQuery('');
          openSnackbar({ open: true, message: `Failed to create conversation: ${result.message || 'Unknown error'}`, variant: 'alert', alert: { color: 'error' } });
        }
      } catch (err) {
        console.error('Error creating conversation:', err);
        openSnackbar({ open: true, message: `Error creating conversation: ${err.message || 'Unknown error'}`, variant: 'alert', alert: { color: 'error' } });
      }
    },
    [dispatch, conversations, handleSelectConversation, properties]
  );

  const [searchParams] = useSearchParams();
  const conversationIdParam = searchParams.get('conversationId');

  useEffect(() => {
    loadConversations();
    loadSuppressedMessageIds();
  }, [loadConversations, loadSuppressedMessageIds]);

  useEffect(() => {
    if (conversationIdParam && conversations.length > 0) {
      const conversationId = parseInt(conversationIdParam, 10);
      if (!isNaN(conversationId)) {
        const conversation = conversations.find((c) => c.id === conversationId);
        if (conversation) {
          handleSelectConversation(conversationId);
          navigate('/landlord/messages', { replace: true });
        }
      }
    }
  }, [conversationIdParam, conversations, handleSelectConversation, navigate]);

  useEffect(() => {
    if (!isConnected) return;
    const unsubscribe = onConversationUpdate(() => {
      loadConversations();
    });
    return unsubscribe;
  }, [isConnected, onConversationUpdate, loadConversations]);

  useEffect(() => {
    if (!isConnected || !selectedConversation?.id) return;
    const unsubscribe = onMessageUpdate((message) => {
      if (message?.conversationId === selectedConversation.id) {
        const messageExists = messages.some((msg) => msg.id === message.id);
        if (!messageExists) {
          if (currentConversationId !== selectedConversation.id) {
            dispatch({ type: 'message/GET_MESSAGES_SUCCESS', payload: { messages, conversationId: selectedConversation.id } });
          }
          dispatch({ type: 'message/ADD_MESSAGE_SUCCESS', payload: message });
          setTimeout(() => scrollToBottom(), 100);
        }
        loadConversations();
      }
    });
    return unsubscribe;
  }, [isConnected, onMessageUpdate, selectedConversation?.id, messages, dispatch, loadConversations]);

  useEffect(() => {
    return () => {
      if (selectedConversation?.id && isConnected) {
        leaveConversation(selectedConversation.id);
      }
    };
  }, [selectedConversation?.id, isConnected, leaveConversation]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (selectedConversation?.id && !switchingConvo) {
      scrollToBottom();
    }
  }, [messages.length, selectedConversation?.id, switchingConvo, scrollToBottom]);

  const generateUrgentItemId = useCallback((item) => {
    const content = `${item.type || 'urgent'}|${item.description || ''}|${item.severity || ''}|${item.messageExcerpt || ''}`;
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 16);
  }, []);

  const urgentItems = useMemo(() => {
    if (!selectedConversation?.urgentItemsJson) return [];
    try {
      const items = typeof selectedConversation.urgentItemsJson === 'string'
        ? JSON.parse(selectedConversation.urgentItemsJson)
        : selectedConversation.urgentItemsJson;
      return (items || []).map((item) => {
        if (item.Id && !item.id) return { ...item, id: item.Id };
        if (!item.id && !item.Id) return { ...item, id: generateUrgentItemId(item) };
        return item;
      });
    } catch (e) {
      return [];
    }
  }, [selectedConversation?.urgentItemsJson, generateUrgentItemId]);

  const getUrgentItemForMessage = useCallback(
    (message) => {
      if (!message?.content || urgentItems.length === 0) return null;
      const messageContent = message.content.toLowerCase().trim();
      const matchedItem = urgentItems.find((item) => {
        if (!item.messageExcerpt) {
          const urgentKeywords = ['leak', 'leaking', 'broken', 'broke', 'fell off', 'not working', 'stopped working', 'needs fixing', 'needs repair', 'urgent', 'emergency', 'help', 'damaged', 'issue', 'problem', 'burst', 'pipe', 'sink', 'water', 'heater', 'heating', 'cooling', 'ac', 'need help', 'pipe burst', 'bad leak'];
          return urgentKeywords.some((kw) => messageContent.includes(kw));
        }
        const excerpt = item.messageExcerpt.toLowerCase().trim();
        const excerptWords = excerpt.split(/\s+/).filter((w) => w.length > 3);
        const messageWords = messageContent.split(/\s+/).filter((w) => w.length > 3);
        if (excerptWords.length > 0) {
          const matchingWords = excerptWords.filter((w) => messageWords.includes(w));
          if (matchingWords.length >= 2 || messageContent.includes(excerpt) || excerpt.includes(messageContent)) return true;
        }
        return messageContent.includes(excerpt) || excerpt.includes(messageContent);
      });
      if (matchedItem?.Id && !matchedItem.id) return { ...matchedItem, id: matchedItem.Id };
      if (matchedItem && !matchedItem.id && !matchedItem.Id) return { ...matchedItem, id: generateUrgentItemId(matchedItem) };
      return matchedItem;
    },
    [urgentItems, generateUrgentItemId]
  );

  const error = conversationError || messageError;

  const isMessagesPageLoading = useMemo(
    () => loadingConversations || loadingMessages || loadingTenants || loadingProperties,
    [loadingConversations, loadingMessages, loadingTenants, loadingProperties]
  );

  useEffect(() => {
    setMessagesLoading(isMessagesPageLoading);
  }, [isMessagesPageLoading, setMessagesLoading]);

  useEffect(() => {
    const loading = loadingConversations || loadingTenants || loadingProperties;
    if (loading) hasBeenLoading.current = true;
    else if (hasBeenLoading.current) initialLoadDone.current = true;
  }, [loadingConversations, loadingTenants, loadingProperties]);

  const isLoading = loadingConversations || loadingTenants || loadingProperties;
  const isDarkMode = theme.palette.mode === 'dark';
  const messagesDivider = isDarkMode ? alpha(theme.palette.primary.main, 0.18) : alpha(theme.palette.divider, 0.72);
  const messagesSoftDivider = isDarkMode ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.divider, 0.58);
  const messagesCardBorder = isDarkMode ? alpha(theme.palette.primary.main, 0.2) : alpha(theme.palette.divider, 0.72);
  const messagesDashedBorder = isDarkMode ? alpha(theme.palette.primary.main, 0.24) : alpha(theme.palette.divider, 0.85);
  const messagesPanelShadow = isDarkMode ? `0 18px 42px ${alpha('#020617', 0.36)}` : 'none';
  const messagesCardShadow = isDarkMode ? `0 10px 26px ${alpha('#020617', 0.26)}` : 'none';
  const messagesTabHoverBg = isDarkMode ? alpha(theme.palette.primary.main, 0.14) : alpha(theme.palette.primary.main, 0.06);
  const messagesTabHoverColor = isDarkMode ? theme.palette.primary.light : theme.palette.primary.main;
  const messagesTabSelectedBg = isDarkMode ? alpha(theme.palette.primary.main, 0.18) : alpha(theme.palette.primary.main, 0.08);
  const messagesTabSelectedShadow = isDarkMode ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 20px ${alpha('#020617', 0.18)}` : 'none';

  if (isLoading && !initialLoadDone.current) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // ======= RENDER HELPERS =======

  const renderConversationItem = (conversation) => {
    const tenant = conversation?.tenantId ? tenants?.find((t) => t.id === conversation.tenantId) : null;
    const tenantName = tenant ? getTenantName(tenant) : conversation.tenantName || conversation.title || 'Unknown';
    const initials = tenant ? getTenantInitials(tenant) : tenantName.charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(tenantName);
    const propertyId = conversation?.propertyId || tenant?.propertyId;
    const property = propertyId ? properties?.find((p) => p.id === propertyId || p.id === Number(propertyId) || String(p.id) === String(propertyId)) : null;
    const propertyDisplay = property?.name?.trim() || property?.streetAddress?.trim() || tenant?.propertyName || conversation?.propertyName || '';
    const unitDisplay = formatUnitLabel(tenant?.unitName);
    const locationLine = [propertyDisplay, unitDisplay].filter(Boolean).join(' · ');
    const isSelected = selectedConversation?.id === conversation.id;
    const hasUnread = conversation.unreadCount > 0;

    return (
      <ListItem
        key={conversation.id}
        disablePadding
        sx={(t) => ({
          bgcolor: isSelected ? alpha(t.palette.primary.main, 0.05) : hasUnread ? alpha(t.palette.primary.main, 0.025) : 'transparent',
          borderBottom: `1px solid ${messagesSoftDivider}`,
          borderLeft: hasUnread || isSelected ? 3 : 0,
          borderBottomColor: messagesSoftDivider,
          borderLeftColor: hasUnread || isSelected ? 'primary.main' : 'transparent',
          transition: 'background-color 0.15s ease',
          '& .MuiListItemButton-root:hover': { bgcolor: 'transparent' },
          '&:hover': { bgcolor: isSelected ? alpha(t.palette.primary.main, 0.07) : alpha(t.palette.primary.main, 0.035) },
          '&:last-of-type': { borderBottom: 0 }
        })}
      >
        <ListItemButton
          onClick={() => {
            setIsNewConversation(false);
            handleSelectConversation(conversation);
          }}
          sx={{ py: 1.35, px: 2, alignItems: 'flex-start', borderRadius: 0 }}
        >
          <ListItemAvatar sx={{ mt: 0.5, minWidth: 48 }}>
            <Badge badgeContent={hasUnread ? conversation.unreadCount : 0} color="error" max={99} showZero={false}>
              <Avatar sx={{ width: 38, height: 38, bgcolor: avatarColor, color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                {initials}
              </Avatar>
            </Badge>
          </ListItemAvatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="subtitle2" noWrap fontWeight={hasUnread ? 700 : 500} sx={{ flex: 1 }}>
                {tenantName}
              </Typography>
              <Typography variant="caption" color={hasUnread ? 'primary.main' : 'text.secondary'} fontWeight={hasUnread ? 600 : 400} sx={{ flexShrink: 0, fontSize: '0.7rem' }}>
                {formatConversationTimestamp(conversation.lastMessageAt)}
              </Typography>
            </Stack>
            {locationLine && (
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.4 }}>
                {locationLine}
              </Typography>
            )}
            <Typography
              variant="body2"
              noWrap
              color={hasUnread ? 'text.primary' : 'text.secondary'}
              fontWeight={hasUnread ? 500 : 400}
              sx={{ fontSize: '0.8rem', mt: 0.25, lineHeight: 1.4 }}
            >
              {conversation.lastMessagePreview || 'No messages yet'}
            </Typography>
            {conversation.hasUrgentItems && (
              <Chip label="Urgent" color="error" size="small" sx={{ mt: 0.5, height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
            )}
          </Box>
        </ListItemButton>
      </ListItem>
    );
  };


  const snapshotActionButtonSx = {
    justifyContent: 'flex-start',
    textTransform: 'none',
    borderRadius: 1.25,
    fontWeight: 600,
    fontSize: '0.8rem',
    py: 0.75,
    borderColor: isDarkMode ? messagesCardBorder : alpha(theme.palette.divider, 0.9),
    color: 'text.primary',
    '& .MuiButton-startIcon': { color: 'text.secondary' },
    '&:hover': {
      borderColor: 'primary.main',
      bgcolor: alpha(theme.palette.primary.main, 0.04)
    }
  };

  const renderSnapshotQuickActions = () => {
    if (!activeConversation) return null;

    const handleEditActiveTenant = () => {
      if (!activeTenant) return;
      setTenantToEdit(activeTenant);
      setTenantEditOpen(true);
    };

    return (
      <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}` : messagesCardShadow }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Quick actions
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          <Button variant="outlined" size="small" fullWidth startIcon={<DollarOutlined style={{ fontSize: 13 }} />} onClick={() => drawer.openPaymentAddDrawer()} sx={snapshotActionButtonSx}>
            Record payment
          </Button>
          {activeTenant && (
            <Button variant="outlined" size="small" fullWidth startIcon={<EditOutlined style={{ fontSize: 13 }} />} onClick={handleEditActiveTenant} sx={snapshotActionButtonSx}>
              Edit tenant
            </Button>
          )}
          {activeLeaseId && (
            <Button variant="outlined" size="small" fullWidth startIcon={<FileTextOutlined style={{ fontSize: 13 }} />} onClick={() => navigate(`/landlord/leases/${activeLeaseId}`)} sx={snapshotActionButtonSx}>
              View lease
            </Button>
          )}
          {activePropertyId && (
            <Button variant="outlined" size="small" fullWidth startIcon={<HomeOutlined style={{ fontSize: 13 }} />} onClick={() => navigate(`/landlord/property/${activePropertyId}`)} sx={snapshotActionButtonSx}>
              View property
            </Button>
          )}
          <Button variant="outlined" size="small" fullWidth startIcon={<ToolOutlined style={{ fontSize: 13 }} />} onClick={() => drawer.openMaintenanceAddDrawer()} sx={snapshotActionButtonSx}>
            Maintenance request
          </Button>
        </Stack>
      </Box>
    );
  };

  // ======= MAIN RENDER =======

  return (
    <Box>
      <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Messages' }
          ]}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ mb: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h3" fontWeight={750}>
                Messages
              </Typography>
              {unreadTabCount > 0 && (
                <Chip size="small" color="primary" label={`${unreadTabCount} unread`} sx={{ height: 24, fontWeight: 700 }} />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' } }}>
              One inbox for tenant conversations, urgent updates, and follow-up
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <GroupConversationManager
              organizationId={quickReplyOrganizationId}
              conversation={selectedConversation}
              currentUserId={quickReplyUserId}
              onChanged={async (conversationId) => {
                await dispatch(getConversations(false));
                if (conversationId) setTimeout(() => handleSelectConversation(conversationId), 0);
              }}
              onLeft={async () => {
                dispatch(setSelectedConversation(null));
                await dispatch(getConversations(false));
              }}
            />
            <Button
            variant="contained"
            startIcon={<PlusOutlined />}
            onClick={() => {
              setIsNewConversation(true);
              setTenantSearchQuery('');
              dispatch(setSelectedConversation(null));
            }}
            sx={{ textTransform: 'none', borderRadius: 2, flexShrink: 0, boxShadow: 'none', minHeight: 40, px: { xs: 1.5, sm: 2 } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>New message</Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>New</Box>
          </Button>
          </Stack>
        </Stack>
      </Box>

      <MainCard
        content={false}
        sx={{
          p: 0,
          overflow: 'hidden',
          borderRadius: 1.25,
          border: `1px solid ${messagesCardBorder}`,
          boxShadow: messagesPanelShadow,
          bgcolor: 'background.paper',
          ':hover': { boxShadow: messagesPanelShadow }
        }}
      >
        <Grid
          container
          sx={{
            height: { xs: 'calc(100dvh - 188px)', sm: 'calc(100dvh - 220px)', md: 'calc(100vh - 300px)' },
            minHeight: { xs: 520, md: 600 },
            maxHeight: { md: 920 },
            overflow: 'hidden'
          }}
        >

          {/* ── Conversations Sidebar ── */}
          <Grid
            size={{ xs: 12, md: 4, lg: 3 }}
            sx={{
              minWidth: 0,
              borderRight: `1px solid ${messagesDivider}`,
              display: isMobile && (selectedConversation || isNewConversation) ? 'none' : 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper'
            }}
          >
            <Box sx={{ px: 2, pt: 1.75, pb: 1.25 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="subtitle1" fontWeight={750}>Inbox</Typography>
                  <Typography variant="caption" color="text.secondary">{isConnected ? 'Live updates on' : 'Connecting…'}</Typography>
                </Box>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: isConnected ? 'success.main' : 'warning.main', boxShadow: `0 0 0 4px ${alpha(isConnected ? theme.palette.success.main : theme.palette.warning.main, 0.12)}` }} />
              </Stack>
            </Box>

            {/* Tab strip */}
            <Box sx={{ borderBottom: `1px solid ${messagesDivider}`, px: 1 }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{
                  minHeight: 44,
                  px: 0.25,
                  '& .MuiTab-root': {
                    minHeight: 44,
                    mx: 0.25,
                    my: 0.5,
                    py: 0,
                    minWidth: 0,
                    borderRadius: 1,
                    textTransform: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: isDarkMode ? 'text.secondary' : 'text.primary',
                    transition: 'background-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
                    '&:hover': {
                      bgcolor: messagesTabHoverBg,
                      color: messagesTabHoverColor,
                      boxShadow: isDarkMode ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}` : 'none'
                    },
                    '&.Mui-selected': {
                      bgcolor: messagesTabSelectedBg,
                      color: isDarkMode ? theme.palette.primary.light : theme.palette.primary.main,
                      fontWeight: 700,
                      boxShadow: messagesTabSelectedShadow
                    },
                    '&.Mui-focusVisible': {
                      bgcolor: messagesTabHoverBg,
                      boxShadow: `inset 0 0 0 2px ${alpha(theme.palette.primary.main, isDarkMode ? 0.34 : 0.22)}`
                    }
                  },
                  '& .MuiTabs-indicator': { height: 2, borderRadius: 2 }
                }}
              >
                <Tab
                  value="all"
                  label={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <span>All</span>
                      {totalActiveCount > 0 && (
                        <Box component="span" sx={{ color: 'inherit', fontSize: '0.8rem', fontWeight: 700, lineHeight: 1 }}>
                          {totalActiveCount}
                        </Box>
                      )}
                    </Stack>
                  }
                />
                <Tab
                  value="unread"
                  label={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <span>Unread</span>
                      {unreadTabCount > 0 && (
                        <Box sx={{ bgcolor: activeTab === 'unread' ? 'primary.main' : 'error.main', color: '#fff', borderRadius: 10, px: 0.75, fontSize: '0.65rem', fontWeight: 700, lineHeight: '18px', minWidth: 18, textAlign: 'center' }}>
                          {unreadTabCount}
                        </Box>
                      )}
                    </Stack>
                  }
                />
                <Tab
                  value="archived"
                  label={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <span>Archived</span>
                      {archivedTabCount > 0 && (
                        <Box sx={{ bgcolor: activeTab === 'archived' ? 'primary.main' : 'action.selected', color: activeTab === 'archived' ? '#fff' : 'text.secondary', borderRadius: 10, px: 0.75, fontSize: '0.65rem', fontWeight: 700, lineHeight: '18px', minWidth: 18, textAlign: 'center' }}>
                          {archivedTabCount}
                        </Box>
                      )}
                    </Stack>
                  }
                />
              </Tabs>
            </Box>

            {/* Search */}
            <Box sx={{ p: 1.25, borderBottom: `1px solid ${messagesDivider}` }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined style={{ fontSize: 14, opacity: 0.55 }} />
                    </InputAdornment>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 34,
                    fontSize: '0.8rem',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                  }
                }}
              />
            </Box>

            {/* Count line */}
            <Box sx={{ px: 2, py: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                {activeTab === 'archived'
                  ? `${archivedTabCount} archived · kept for history`
                  : `${totalActiveCount} conversation${totalActiveCount !== 1 ? 's' : ''}${unreadTabCount > 0 ? ` · ${unreadTabCount} unread` : ''}`}
              </Typography>
            </Box>

            {/* Conversation List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <AnimatePresence>
                {isNewConversation && (
                  <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.4, ease: 'easeInOut' }}>
                    <List sx={{ p: 0 }}>
                      <ListItem disablePadding sx={{ bgcolor: 'action.selected', borderLeft: 3, borderColor: 'primary.main' }}>
                        <ListItemButton disabled>
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: 'primary.main', color: '#fff', width: 38, height: 38 }}>
                              <PlusOutlined />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={<Typography variant="subtitle2" fontWeight={600}>New message</Typography>}
                            secondary={<Typography variant="caption" color="text.secondary">Select a tenant to start</Typography>}
                          />
                        </ListItemButton>
                      </ListItem>
                    </List>
                  </motion.div>
                )}
              </AnimatePresence>

              {showConversationListSpinner ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
              ) : filteredConversations.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  {searchQuery ? (
                    <Stack spacing={1.25} alignItems="center">
                      <SearchOutlined style={{ fontSize: 36, color: theme.palette.text.disabled }} />
                      <Typography variant="subtitle2" fontWeight={700}>No matching conversations</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 260 }}>
                        No results for “{searchQuery}” in {activeTab === 'all' ? 'your inbox' : activeTab}.
                      </Typography>
                      <Button size="small" variant="text" onClick={() => setSearchQuery('')} sx={{ textTransform: 'none' }}>
                        Clear search
                      </Button>
                    </Stack>
                  ) : activeTab === 'archived' ? (
                    <Stack spacing={1} alignItems="center">
                      <InboxOutlined style={{ fontSize: 40, color: theme.palette.text.disabled }} />
                      <Typography variant="subtitle2" fontWeight={700}>No archived conversations</Typography>
                      <Typography variant="body2" color="text.secondary">Archived tenant threads will appear here.</Typography>
                    </Stack>
                  ) : activeTab === 'unread' ? (
                    <Stack spacing={1} alignItems="center">
                      <CheckOutlined style={{ fontSize: 40, color: theme.palette.success.main }} />
                      <Typography variant="subtitle2" fontWeight={700}>You’re all caught up</Typography>
                      <Typography variant="body2" color="text.secondary">There are no unread tenant messages.</Typography>
                    </Stack>
                  ) : !tenants || tenants.length === 0 ? (
                    <Stack spacing={2} alignItems="center">
                      <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 700 }}>You don’t have any tenants yet</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                        Add your first tenant to start secure conversations and keep property context together.
                      </Typography>
                      <Button variant="contained" onClick={() => drawer.openTenantAddDrawer()}>Add tenant</Button>
                    </Stack>
                  ) : (
                    <Stack spacing={1.25} alignItems="center">
                      <MessageOutlined style={{ fontSize: 40, color: theme.palette.text.disabled }} />
                      <Typography variant="subtitle2" fontWeight={700}>No conversations yet</Typography>
                      <Typography variant="body2" color="text.secondary">Choose a tenant and send the first message.</Typography>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PlusOutlined />}
                        onClick={() => {
                          setIsNewConversation(true);
                          setTenantSearchQuery('');
                          dispatch(setSelectedConversation(null));
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        Start a message
                      </Button>
                    </Stack>
                  )}
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {filteredConversations.map((conversation) => renderConversationItem(conversation))}
                </List>
              )}
            </Box>
          </Grid>

          {/* ── Chat Area ── */}
          <Grid
            size={{ xs: 12, md: 8, lg: 6 }}
            sx={{
              display: isMobile && !selectedConversation && !isNewConversation ? 'none' : 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isNewConversation ? 'new' : selectedConversation?.id ?? 'empty'}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
              >

                {/* ── New Conversation Panel ── */}
                {isNewConversation ? (
                  <>
                    <Box sx={{ p: 2.25, borderBottom: `1px solid ${messagesDivider}`, bgcolor: 'background.paper' }}>
                      <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                        <Box>
                          <Typography variant="h6" fontWeight={700}>New message</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            Choose a tenant to start a conversation. Tenants with email can receive replies by email even before they create an account.
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => { setIsNewConversation(false); setTenantSearchQuery(''); }} sx={{ mt: -0.5 }}>
                          <CloseOutlined />
                        </IconButton>
                      </Stack>
                    </Box>
                    <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${messagesDivider}`, bgcolor: alpha(theme.palette.background.default, 0.55) }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Search by name, email, property, or unit..."
                        value={tenantSearchQuery}
                        onChange={(e) => setTenantSearchQuery(e.target.value)}
                        autoFocus
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined style={{ fontSize: 16, opacity: 0.65 }} /></InputAdornment> }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            bgcolor: 'background.paper',
                            height: 38,
                            fontSize: '0.85rem',
                            borderRadius: 1.5
                          }
                        }}
                      />
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25, flexWrap: 'wrap', rowGap: 0.75 }}>
                        <Chip
                          size="small"
                          label={`${filteredTenants.length} tenant${filteredTenants.length === 1 ? '' : 's'}`}
                          sx={{ height: 22, fontSize: '0.7rem', bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main', fontWeight: 700 }}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${filteredTenants.filter((tenant) => tenant.userId).length} in-app`}
                          sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'background.paper' }}
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${filteredTenants.filter((tenant) => !tenant.userId && tenant.email).length} email only`}
                          sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'background.paper' }}
                        />
                      </Stack>
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'auto', p: 2.25, bgcolor: alpha(theme.palette.background.default, 0.35) }}>
                      {loadingTenants ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
                      ) : filteredTenants.length === 0 ? (
                        <Box
                          sx={{
                            p: 4,
                            textAlign: 'center',
                            border: `1px dashed ${messagesDashedBorder}`,
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                            boxShadow: messagesCardShadow
                          }}
                        >
                          <UserOutlined style={{ fontSize: 42, color: theme.palette.text.disabled, marginBottom: 8 }} />
                          <Typography variant="subtitle2" fontWeight={700}>{tenantSearchQuery ? 'No tenants found' : 'No tenants available'}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {tenantSearchQuery ? 'Try searching by name, email, property, or unit.' : 'Add tenants first, then start a message here.'}
                          </Typography>
                        </Box>
                      ) : (
                        <Stack spacing={1.25}>
                          {filteredTenants.map((tenant) => {
                            const name = getTenantName(tenant);
                            const avatarColor = getAvatarColor(name);
                            const hasAccount = Boolean(tenant.userId || tenant.UserId);
                            const hasEmail = Boolean(tenant.email);
                            const contactLabel = hasAccount ? 'In-app' : hasEmail ? 'Email only' : 'No email';
                            const contactColor = hasAccount ? 'success' : hasEmail ? 'warning' : 'default';
                            const propertyLine = [tenant.propertyName, formatUnitLabel(tenant.unitName)].filter(Boolean).join(' · ');
                            return (
                              <Box
                                key={tenant.id}
                                component="div"
                                role={hasAccount || hasEmail ? 'button' : undefined}
                                tabIndex={hasAccount || hasEmail ? 0 : -1}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (hasAccount || hasEmail) handleSelectTenant(tenant);
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Enter' || e.key === ' ') && (hasAccount || hasEmail)) {
                                    e.preventDefault();
                                    handleSelectTenant(tenant);
                                  }
                                }}
                                sx={{
                                  width: '100%',
                                  textAlign: 'left',
                                  p: 1.5,
                                  border: `1px solid ${messagesCardBorder}`,
                                  borderRadius: 2,
                                  bgcolor: 'background.paper',
                                  boxShadow: messagesCardShadow,
                                  cursor: hasAccount || hasEmail ? 'pointer' : 'default',
                                  opacity: !hasAccount && !hasEmail ? 0.72 : 1,
                                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                                  '&:hover': {
                                    borderColor: hasAccount || hasEmail ? 'primary.main' : messagesCardBorder,
                                    boxShadow: hasAccount || hasEmail ? `0 10px 24px ${alpha(theme.palette.primary.main, isDarkMode ? 0.16 : 0.08)}` : messagesCardShadow,
                                    transform: hasAccount || hasEmail ? 'translateY(-1px)' : 'none'
                                  },
                                  '&:focus-visible': {
                                    outline: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                                    outlineOffset: 2
                                  }
                                }}
                              >
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <Avatar sx={{ bgcolor: avatarColor, color: '#fff', width: 42, height: 42, fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}>
                                    {getTenantInitials(tenant)}
                                  </Avatar>
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, mb: 0.25 }}>
                                      <Typography variant="body2" fontWeight={700} noWrap sx={{ minWidth: 0 }}>
                                        {name || 'Unnamed Tenant'}
                                      </Typography>
                                      <Chip
                                        size="small"
                                        color={contactColor}
                                        variant={hasAccount ? 'filled' : 'outlined'}
                                        label={contactLabel}
                                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}
                                      />
                                    </Stack>
                                    <Typography variant="caption" color={hasEmail ? 'text.secondary' : 'error.main'} noWrap sx={{ display: 'block' }}>
                                      {tenant.email || 'Missing email address'}
                                    </Typography>
                                    {propertyLine && (
                                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                                        {propertyLine}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Tooltip title="Tenant actions">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => handleOpenTenantMenu(e, tenant)}
                                      sx={{ flexShrink: 0, color: 'text.secondary' }}
                                    >
                                      <MoreOutlined style={{ fontSize: 18 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Box>
                            );
                          })}
                        </Stack>
                      )}
                      <Menu
                        anchorEl={tenantMenuAnchor}
                        open={Boolean(tenantMenuAnchor)}
                        onClose={handleCloseTenantMenu}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                      >
                        <MenuItem onClick={handleEditTenantFromMenu}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <EditOutlined style={{ fontSize: 15 }} />
                            <Typography variant="body2">Edit tenant</Typography>
                          </Stack>
                        </MenuItem>
                      </Menu>
                    </Box>
                  </>

                ) : selectedConversation ? (
                  <>
                    {/* ── Chat Header ── */}
                    <Box sx={{ px: { xs: 1.25, sm: 2 }, py: { xs: 1.25, sm: 2 }, borderBottom: `1px solid ${messagesDivider}`, flexShrink: 0, bgcolor: 'background.paper' }}>

                      {/* Tenant name row + action buttons */}
                      {(() => {
                        const tenant = selectedConversation?.tenantId ? tenants?.find((t) => t.id === selectedConversation.tenantId) : null;
                        const tenantName = tenant ? getTenantName(tenant) : selectedConversation.tenantName || selectedConversation.title || 'Unknown';
                        const initials = tenant ? getTenantInitials(tenant) : tenantName.charAt(0).toUpperCase();
                        const avatarColor = getAvatarColor(tenantName);
                        const propertyId = selectedConversation?.propertyId || tenant?.propertyId;
                        const property = propertyId ? properties?.find((p) => p.id === propertyId || p.id === Number(propertyId) || String(p.id) === String(propertyId)) : null;
                        const streetAddress = property?.streetAddress?.trim() || property?.name?.trim() || tenant?.propertyName || selectedConversation?.propertyName || '';
                        const unitName = tenant?.unitName || '';
                        const tenantSince = formatTenantSince(tenant);
                        const locationParts = [streetAddress, unitName ? `Unit ${unitName}` : null, tenantSince ? `Tenant since ${tenantSince}` : null].filter(Boolean);

                        return (
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                            <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} alignItems="center" sx={{ minWidth: 0 }}>
                              {isMobile && (
                                <Tooltip title="Back to inbox">
                                  <IconButton aria-label="Back to inbox" onClick={() => dispatch(setSelectedConversation(null))} sx={{ ml: -0.5, flexShrink: 0 }}>
                                    <ArrowLeftOutlined />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Avatar sx={{ bgcolor: avatarColor, color: '#fff', width: 42, height: 42, fontSize: '0.9rem', fontWeight: 600, flexShrink: 0 }}>
                                {initials}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                  <Typography variant="h6" fontWeight={700} noWrap sx={{ maxWidth: { xs: 150, sm: 280 } }}>
                                    {tenantName}
                                  </Typography>
                                  {selectedConversation.hasUrgentItems && (
                                    <Chip label="Urgent" color="error" size="small" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }} />
                                  )}
                                  {selectedConversation.isArchived && (
                                    <Chip label="Archived" variant="outlined" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                                  )}
                                </Stack>
                                {locationParts.length > 0 && (
                                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                                    {locationParts.join(' · ')}
                                  </Typography>
                                )}
                              </Box>
                            </Stack>

                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                              <Tooltip title="Conversation actions">
                                <IconButton size="small" onClick={(e) => setActionMenuAnchor(e.currentTarget)}>
                                  <MoreOutlined />
                                </IconButton>
                              </Tooltip>
                            </Stack>

                            <Menu
                              anchorEl={actionMenuAnchor}
                              open={Boolean(actionMenuAnchor)}
                              onClose={() => setActionMenuAnchor(null)}
                              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            >
                              {!selectedConversation.isArchived ? (
                                <MenuItem onClick={handleOpenArchiveConfirm}>
                                  <InboxOutlined style={{ marginRight: 8 }} />
                                  Archive conversation
                                </MenuItem>
                              ) : (
                                <MenuItem onClick={handleRestore}>
                                  <CheckCircleOutlined style={{ marginRight: 8 }} />
                                  Restore to inbox
                                </MenuItem>
                              )}
                              {(() => {
                                const t = selectedConversation?.tenantId ? tenants?.find((ten) => ten.id === selectedConversation.tenantId) : null;
                                return t ? (
                                  <MenuItem onClick={() => { setActionMenuAnchor(null); navigate(`/landlord/renters/${t.id}`); }}>
                                    <UserOutlined style={{ marginRight: 8 }} />
                                    Open tenant profile
                                  </MenuItem>
                                ) : null;
                              })()}
                              <MenuItem onClick={() => { setActionMenuAnchor(null); handleSummarize(); }} disabled={summaryLoading}>
                                <RobotOutlined style={{ marginRight: 8 }} />
                                {summaryLoading ? 'Summarizing...' : selectedConversation.aiSummary ? 'Refresh AI summary' : 'Generate AI summary'}
                              </MenuItem>
                            </Menu>
                          </Stack>
                        );
                      })()}
                    </Box>

                    <ConversationTimelinePanel
                      conversationId={selectedConversation.id}
                      organizationId={quickReplyOrganizationId}
                      currentUserId={quickReplyUserId}
                    />

                    {/* ── Messages ── */}
                    <Box
                      ref={messagesContainerRef}
                      sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        px: { xs: 1, sm: 2.5 },
                        py: { xs: 1.5, sm: 2.5 },
                        bgcolor: isDarkMode ? alpha(theme.palette.background.default, 0.25) : '#f7f9fc',
                        position: 'relative',
                        zIndex: 0,
                        '&::-webkit-scrollbar': { width: '8px' },
                        '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                        '&::-webkit-scrollbar-thumb': { bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.24) : 'grey.300', borderRadius: '4px' }
                      }}
                    >
                      {switchingConvo && selectedConversation?.id ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', flex: 1 }}>
                          <CircularProgress />
                        </Box>
                      ) : error ? (
                        <Alert severity="error">{error}</Alert>
                      ) : visibleMessages.length === 0 ? (
                        <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ textAlign: 'center', p: 3, minHeight: 220 }}>
                          <MessageOutlined style={{ fontSize: 38, color: theme.palette.text.disabled }} />
                          <Typography variant="subtitle2" fontWeight={700}>Start the conversation</Typography>
                          <Typography variant="body2" color="text.secondary">Send a message below to begin this tenant thread.</Typography>
                        </Stack>
                      ) : (
                        <Stack spacing={0} sx={{ overflow: 'visible', position: 'relative' }}>
                          {visibleMessages.map((message, index) => {
                            const userId = user?.Id || user?.id;
                            const isOwnMessage = String(message.senderId) === String(userId);
                            const isAgentMessage = !isOwnMessage && message.senderName?.toLowerCase().includes('agent');
                            const isHovered = hoveredMessageId === message.id;
                            const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
                            const isConsecutive = previousMessage && String(previousMessage.senderId) === String(message.senderId) &&
                              new Date(message.createdAt).toDateString() === new Date(previousMessage.createdAt).toDateString();
                            const showAvatar = !isConsecutive && !isOwnMessage;
                            const showSenderName = !isConsecutive && !isOwnMessage;
                            const showTime = !isConsecutive;
                            const showDateSeparator = !previousMessage ||
                              new Date(message.createdAt).toDateString() !== new Date(previousMessage.createdAt).toDateString();
                            const isMessageSuppressed = suppressedMessageIds.has(message.id);
                            const isUrgent = message.isUrgent && !isOwnMessage && !isMessageSuppressed;
                            const severityColor = 'error';

                            return (
                              <Fragment key={message.id}>
                                {showDateSeparator && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', my: 2, px: 1 }}>
                                    <Box sx={{ flex: 1, height: '1px', bgcolor: messagesSoftDivider }} />
                                    <Typography variant="caption" color="text.secondary" sx={{ mx: 2, whiteSpace: 'nowrap', fontWeight: 500 }}>
                                      {getDateLabel(message.createdAt)}
                                    </Typography>
                                    <Box sx={{ flex: 1, height: '1px', bgcolor: messagesSoftDivider }} />
                                  </Box>
                                )}
                                <Box
                                  onMouseEnter={() => setHoveredMessageId(message.id)}
                                  onMouseLeave={() => setHoveredMessageId(null)}
                                  sx={{
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
                                    alignItems: 'flex-start',
                                    mt: isConsecutive ? 0.25 : 1.5,
                                    px: 1,
                                    opacity: message._optimistic ? 0.6 : 1,
                                    transition: 'opacity 0.2s ease'
                                  }}
                                >
                                  {!isOwnMessage && (
                                    <Box sx={{ width: 40, height: 40, flexShrink: 0, mr: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: showAvatar ? 0 : 0.5 }}>
                                      {showAvatar ? (
                                        <Avatar
                                          sx={{ width: 40, height: 40, bgcolor: isAgentMessage ? AGENT_PURPLE : 'primary.main', color: '#fff' }}
                                          src={message.senderProfileImageUrl || message.SenderProfileImageUrl || undefined}
                                          alt={message.senderName || 'User'}
                                        >
                                          {!(message.senderProfileImageUrl || message.SenderProfileImageUrl) && (
                                            isAgentMessage
                                              ? <RobotOutlined style={{ fontSize: 18 }} />
                                              : (message.senderName?.charAt(0)?.toUpperCase() || '?')
                                          )}
                                        </Avatar>
                                      ) : null}
                                    </Box>
                                  )}

                                  <Box sx={{ position: 'relative', width: 'fit-content', maxWidth: { xs: isOwnMessage ? '86%' : 'calc(88% - 42px)', sm: isOwnMessage ? '74%' : 'calc(76% - 50px)' }, display: 'flex', flexDirection: 'column', alignItems: isOwnMessage ? 'flex-end' : 'flex-start' }}>
                                    {/* Sender name + time */}
                                    {showSenderName && (
                                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, px: 0.5 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 500, color: isAgentMessage ? AGENT_PURPLE : 'text.primary' }}>
                                          {message.senderName || 'Unknown'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>
                                          {formatMessageTime(message.createdAt)}
                                        </Typography>
                                        {message.isEdited && <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic' }}>(edited)</Typography>}
                                      </Stack>
                                    )}
                                    {showTime && isOwnMessage && !showSenderName && (
                                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, px: 0.5 }}>
                                        <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>
                                          {formatMessageTime(message.createdAt)}
                                        </Typography>
                                        {message.isEdited && <Typography variant="caption" sx={{ opacity: 0.6, fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic' }}>(edited)</Typography>}
                                      </Stack>
                                    )}

                                    {isUrgent ? (
                                      <Box
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 3,
                                          border: (t) => `1px solid ${alpha(t.palette[severityColor]?.main || t.palette.error.main, 0.3)}`,
                                          bgcolor: (t) => alpha(t.palette[severityColor]?.main || t.palette.error.main, 0.05),
                                          width: '100%',
                                          maxWidth: '100%',
                                          position: 'relative'
                                        }}
                                      >
                                        <Tooltip title="Clear urgency for this message">
                                          <IconButton
                                            size="small"
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              if (selectedConversation?.id && message?.id) {
                                                try {
                                                  const response = await conversationAPI.clearUrgentItems(selectedConversation.id, '', message.id);
                                                  if (response?.success && response?.data) {
                                                    dispatch({ type: CONVERSATION_ACTION_TYPES.UPDATE_CONVERSATION_SUCCESS, payload: response.data });
                                                    await dispatch(getConversations(activeTabRef.current === 'archived'));
                                                    if (selectedConversation?.id) await dispatch(getMessages(selectedConversation.id));
                                                    await loadSuppressedMessageIds();
                                                    openSnackbar({ open: true, message: 'Urgency cleared for this message', variant: 'alert', alert: { color: 'success' } });
                                                  }
                                                } catch (error) {
                                                  openSnackbar({ open: true, message: `Error clearing urgency: ${error.message || 'Unknown error'}`, variant: 'alert', alert: { color: 'error' } });
                                                }
                                              }
                                            }}
                                            sx={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'error.light' } }}
                                          >
                                            <CloseOutlined style={{ fontSize: 12 }} />
                                          </IconButton>
                                        </Tooltip>
                                        <Box sx={{ flex: 1, minWidth: 0, pr: 3 }}>
                                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                                            <Chip label="URGENT" size="small" color={severityColor} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                                          </Stack>
                                          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5, color: 'text.primary' }}>Urgent message requires attention</Typography>
                                          <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mb: 0.5 }}>"{message.content}"</Typography>
                                          {selectedConversation?.title && (
                                            <Typography variant="caption" color="text.secondary">
                                              {selectedConversation.title}{selectedConversation.propertyName && ` • ${selectedConversation.propertyName}`}
                                            </Typography>
                                          )}
                                        </Box>
                                      </Box>
                                    ) : (
                                      <Paper
                                        elevation={0}
                                        sx={{
                                          p: 1.25,
                                          px: 1.5,
                                          width: 'fit-content',
                                          maxWidth: '100%',
                                          bgcolor: isOwnMessage
                                            ? (t) => (t.palette.mode === 'dark' ? SENT_MESSAGE_BLUE : t.palette.primary.main)
                                            : (t) => t.palette.mode === 'dark' ? alpha(t.palette.primary.main, 0.08) : 'grey.100',
                                          color: isOwnMessage ? '#fff' : 'text.primary',
                                          borderRadius: 3,
                                          borderTopLeftRadius: isConsecutive ? 2 : (isOwnMessage ? 3 : 0),
                                          borderTopRightRadius: isConsecutive ? 2 : (isOwnMessage ? 0 : 3),
                                          borderBottomLeftRadius: 3,
                                          borderBottomRightRadius: 3,
                                          boxShadow: isOwnMessage
                                            ? (t) => t.palette.mode === 'dark' ? `0 8px 18px ${alpha(SENT_MESSAGE_BLUE, 0.2)}` : 'none'
                                            : (t) => t.palette.mode === 'dark' ? `0 8px 20px ${alpha('#020617', 0.22)}` : 'none',
                                          border: isOwnMessage
                                            ? (t) => t.palette.mode === 'dark' ? `1px solid ${alpha(t.palette.primary.light || t.palette.primary.main, 0.22)}` : 'none'
                                            : (t) => `1px solid ${t.palette.mode === 'dark' ? alpha(t.palette.primary.main, 0.16) : alpha('#000', 0.06)}`
                                        }}
                                      >
                                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: isOwnMessage ? '#fff' : 'inherit' }}>
                                          {message.content}
                                        </Typography>
                                      </Paper>
                                    )}
                                  </Box>
                                </Box>
                              </Fragment>
                            );
                          })}

                          {/* Suggested reply */}
                          {selectedConversation.suggestedReply && !suggestedReplyDismissed && (
                            <Box sx={{ mt: 2, px: 1 }}>
                              <Box
                                sx={{
                                  p: 1.25,
                                  borderRadius: 1.5,
                                  bgcolor: alpha(AGENT_PURPLE, 0.06),
                                  border: `1px solid ${alpha(AGENT_PURPLE, 0.18)}`
                                }}
                              >
                                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                  <Stack direction="row" spacing={0.75} alignItems="center">
                                    <ThunderboltOutlined style={{ fontSize: 13, color: AGENT_PURPLE }} />
                                    <Typography variant="caption" fontWeight={700} sx={{ color: AGENT_PURPLE, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.68rem' }}>
                                      Suggested reply · You can edit
                                    </Typography>
                                  </Stack>
                                  <IconButton size="small" onClick={() => setSuggestedReplyDismissed(true)} sx={{ width: 20, height: 20 }}>
                                    <CloseOutlined style={{ fontSize: 11, color: AGENT_PURPLE }} />
                                  </IconButton>
                                </Stack>
                                <Paper elevation={0} sx={{ p: 1.25, px: 1.5, bgcolor: (t) => (t.palette.mode === 'dark' ? SENT_MESSAGE_BLUE : t.palette.primary.main), borderRadius: 3, borderTopRightRadius: 0, maxWidth: '85%', ml: 'auto', boxShadow: (t) => t.palette.mode === 'dark' ? `0 8px 18px ${alpha(SENT_MESSAGE_BLUE, 0.2)}` : 'none', border: (t) => t.palette.mode === 'dark' ? `1px solid ${alpha(t.palette.primary.light || t.palette.primary.main, 0.22)}` : 'none' }}>
                                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, color: '#fff' }}>
                                    {selectedConversation.suggestedReply}
                                  </Typography>
                                </Paper>
                                <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                                  <Button size="small" variant="text" onClick={() => setSuggestedReplyDismissed(true)} sx={{ textTransform: 'none', fontSize: '0.78rem', color: 'text.secondary' }}>
                                    Dismiss
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => {
                                      setMessageInput(selectedConversation.suggestedReply);
                                      setSuggestedReplyDismissed(true);
                                    }}
                                    sx={{ textTransform: 'none', fontSize: '0.78rem', borderRadius: 2, bgcolor: AGENT_PURPLE, '&:hover': { bgcolor: alpha(AGENT_PURPLE, 0.85) } }}
                                  >
                                    Use reply
                                  </Button>
                                </Stack>
                              </Box>
                            </Box>
                          )}

                          <div ref={messagesEndRef} />
                        </Stack>
                      )}
                    </Box>

                    {/* ── Message Composer ── */}
                    <Box
                      sx={{
                        px: { xs: 1.25, sm: 2 },
                        pt: 1.25,
                        pb: { xs: 'max(12px, env(safe-area-inset-bottom))', sm: 1.5 },
                        borderTop: `1px solid ${messagesDivider}`,
                        bgcolor: 'background.paper',
                        flexShrink: 0
                      }}
                    >
                      {selectedConversation.isArchived ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <InboxOutlined style={{ color: theme.palette.text.secondary }} />
                            <Typography variant="body2" color="text.secondary">
                              This conversation is archived and read-only.
                            </Typography>
                          </Stack>
                          <Button size="small" variant="outlined" onClick={handleRestore} sx={{ textTransform: 'none', borderRadius: 2 }}>
                            Restore to inbox
                          </Button>
                        </Stack>
                      ) : (
                        <>
                          <ConversationQuickReplies
                            conversation={activeConversation}
                            organizationId={quickReplyOrganizationId}
                            userId={quickReplyUserId}
                            hidden={Boolean(messageInput)}
                            onSelect={setMessageInput}
                          />
                          <Paper
                            elevation={0}
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-end',
                              borderRadius: 2.5,
                              border: `1px solid ${messagesCardBorder}`,
                              bgcolor: 'background.paper',
                              boxShadow: messagesCardShadow,
                              pl: 1.5,
                              pr: 0.75,
                              py: 0.6,
                              transition: 'border-color 150ms ease, box-shadow 150ms ease',
                              '&:focus-within': {
                                borderColor: 'primary.main',
                                boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`
                              }
                            }}
                          >
                            <TextField
                              fullWidth
                              multiline
                              minRows={1}
                              maxRows={5}
                              placeholder="Write a message…"
                              value={messageInput}
                              onChange={(e) => setMessageInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !isMobile && !e.nativeEvent.isComposing) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              disabled={sendingMessage}
                              variant="standard"
                              inputProps={{ maxLength: MAX_MESSAGE_LENGTH, 'aria-label': 'Message' }}
                              InputProps={{
                                disableUnderline: true,
                                sx: { fontSize: '0.9375rem', py: 0.55, '& .MuiInputBase-input': { py: 0.35, lineHeight: 1.5 } }
                              }}
                              sx={{ flex: 1, '& .MuiInputBase-root': { border: 'none' } }}
                            />
                            <Tooltip title="Send message">
                              <span>
                                <IconButton
                                  onClick={handleSendMessage}
                                  disabled={!messageInput.trim() || sendingMessage}
                                  aria-label="Send message"
                                  sx={{
                                    ml: 0.75,
                                    width: 40,
                                    height: 40,
                                    bgcolor: 'primary.main',
                                    color: '#fff',
                                    '&:hover': { bgcolor: 'primary.dark' },
                                    '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' }
                                  }}
                                >
                                  {sendingMessage ? <CircularProgress size={19} color="inherit" /> : <SendOutlined style={{ fontSize: 18 }} />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Paper>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.65, px: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                              Enter to send · Shift + Enter for a new line
                            </Typography>
                            <Typography variant="caption" color={messageInput.length > MAX_MESSAGE_LENGTH * 0.9 ? 'warning.main' : 'text.secondary'} sx={{ ml: 'auto' }}>
                              {messageInput.length}/{MAX_MESSAGE_LENGTH}
                            </Typography>
                          </Stack>
                        </>
                      )}
                    </Box>

                  </>

                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, bgcolor: isDarkMode ? 'background.paper' : '#f7f9fc' }}>
                    <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center', maxWidth: 360 }}>
                      <Avatar sx={{ width: 64, height: 64, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                        <MessageOutlined style={{ fontSize: 28 }} />
                      </Avatar>
                      <Typography variant="h5" fontWeight={700}>Your landlord inbox</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Select a conversation to review its history and tenant context, or start a new message.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<PlusOutlined />}
                        onClick={() => {
                          setIsNewConversation(true);
                          setTenantSearchQuery('');
                        }}
                        sx={{ mt: 0.5, textTransform: 'none' }}
                      >
                        New message
                      </Button>
                    </Stack>
                  </Box>
                )}
              </motion.div>
            </AnimatePresence>
          </Grid>

          {/* ── Conversation Snapshot ── */}
          <Grid
            size={{ xs: 12, lg: 3 }}
            sx={{
              display: { xs: 'none', lg: 'flex' },
              flexDirection: 'column',
              borderLeft: `1px solid ${messagesDivider}`,
              bgcolor: alpha(theme.palette.background.default, 0.28)
            }}
          >
            <Box sx={{ p: 2, borderBottom: `1px solid ${messagesDivider}`, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" fontWeight={700}>Tenant snapshot</Typography>
              <Typography variant="caption" color="text.secondary">
                Updates as you select conversations
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {activeConversation ? (
                <Stack spacing={1.5}>
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}` : messagesCardShadow }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ width: 38, height: 38, bgcolor: getAvatarColor(activeTenant ? getTenantName(activeTenant) : activeConversation.tenantName || activeConversation.title || 'Tenant'), color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                        {activeTenant ? getTenantInitials(activeTenant) : (activeConversation.tenantName || activeConversation.title || '?').charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {activeTenant ? getTenantName(activeTenant) : activeConversation.tenantName || 'Tenant'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {activeTenant?.email || activeConversation.tenantEmail || 'No email on file'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}` : messagesCardShadow }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Property / unit
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>
                      {activePropertyLine || activeConversation.title || 'Not linked'}
                    </Typography>
                  </Box>

                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}` : messagesCardShadow }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Lease status
                      </Typography>
                      <Chip size="small" label={activeLeaseStatus} color={isActiveLeaseStatus ? 'success' : 'default'} sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }} />
                    </Stack>
                    <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="caption" color="text.secondary">Rent</Typography>
                        <Typography variant="caption" fontWeight={700}>
                          {activeMonthlyRent ? `${formatCurrency(activeMonthlyRent)}/mo` : '—'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="caption" color="text.secondary">Lease dates</Typography>
                        <Typography variant="caption" fontWeight={700} textAlign="right">
                          {activeLeaseDates.length
                            ? activeLeaseDates.map((date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })).join(' – ')
                            : '—'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  {renderSnapshotQuickActions()}

                  {activeConversation.aiSummary && (
                    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(AGENT_PURPLE, 0.045), border: `1px solid ${alpha(AGENT_PURPLE, isDarkMode ? 0.5 : 0.22)}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(AGENT_PURPLE, 0.18)}, 0 4px 16px ${alpha(AGENT_PURPLE, 0.18)}` : 'none' }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                        <RobotOutlined style={{ fontSize: 13, color: AGENT_PURPLE }} />
                        <Typography variant="caption" fontWeight={700} sx={{ color: AGENT_PURPLE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          AI summary
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
                        {activeConversation.aiSummary}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              ) : (
                <Box sx={{ p: 2, border: `1px dashed ${messagesDashedBorder}`, borderRadius: 1, bgcolor: 'background.paper', textAlign: 'center' }}>
                  <Typography variant="body2" fontWeight={700}>No conversation selected</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Select a conversation to see tenant, property, and lease context here.
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>

        <ConfirmationDialog
          open={archiveConfirmOpen}
          onClose={() => setArchiveConfirmOpen(false)}
          onConfirm={handleArchive}
          title="Archive conversation?"
          message="This will move the conversation out of your active inbox. You can restore it later from Archived."
          confirmText="Archive"
          cancelText="Cancel"
          confirmColor="primary"
        />

        <TenantEditDrawer
          tenant={tenantToEdit}
          open={tenantEditOpen}
          onClose={handleCloseTenantEdit}
          onUpdateSuccess={handleTenantEditSuccess}
        />

        <TenantAddDrawer />

        <LandlordMaintenanceDrawer />
      </MainCard>

      {/* ── Tenant Snapshot (mobile/tablet) ── */}
      <MainCard
        content={false}
        sx={{
          display: { xs: selectedConversation ? 'block' : 'none', lg: 'none' },
          mt: 2,
          mb: { xs: 10, sm: 2 },
          overflow: 'hidden',
          borderRadius: 1.25,
          border: `1px solid ${messagesCardBorder}`,
          boxShadow: messagesPanelShadow,
          bgcolor: 'background.paper',
          ':hover': { boxShadow: messagesPanelShadow }
        }}
      >
        <Box
          sx={{
            bgcolor: alpha(theme.palette.background.default, 0.28),
            p: 2
          }}
        >
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>Tenant snapshot</Typography>
            <Typography variant="caption" color="text.secondary">
              Context for the selected conversation
            </Typography>
          </Box>
          {activeConversation ? (
            <>
              <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}` : messagesCardShadow }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ width: 38, height: 38, bgcolor: getAvatarColor(activeTenant ? getTenantName(activeTenant) : activeConversation.tenantName || activeConversation.title || 'Tenant'), color: '#fff', fontSize: '0.8rem', fontWeight: 700 }}>
                    {activeTenant ? getTenantInitials(activeTenant) : (activeConversation.tenantName || activeConversation.title || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
        {activeTenant ? getTenantName(activeTenant) : activeConversation.tenantName || 'Tenant'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
        {activeTenant?.email || activeConversation.tenantEmail || 'No email on file'}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}` : messagesCardShadow }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Property / unit
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ mt: 0.75 }}>
                  {activePropertyLine || activeConversation.title || 'Not linked'}
                </Typography>
              </Box>

              <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.paper', border: `1px solid ${isDarkMode ? alpha(theme.palette.primary.main, 0.45) : messagesCardBorder}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 4px 16px ${alpha(theme.palette.primary.main, 0.18)}` : messagesCardShadow }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Lease status
                  </Typography>
                  <Chip size="small" label={activeLeaseStatus} color={isActiveLeaseStatus ? 'success' : 'default'} sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }} />
                </Stack>
                <Stack spacing={0.75} sx={{ mt: 1.25 }}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="caption" color="text.secondary">Rent</Typography>
                    <Typography variant="caption" fontWeight={700}>
        {activeMonthlyRent ? `${formatCurrency(activeMonthlyRent)}/mo` : '—'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="caption" color="text.secondary">Lease dates</Typography>
                    <Typography variant="caption" fontWeight={700} textAlign="right">
        {activeLeaseDates.length
          ? activeLeaseDates.map((date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })).join(' – ')
          : '—'}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

              {renderSnapshotQuickActions()}

              {activeConversation.aiSummary && (
                <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: alpha(AGENT_PURPLE, 0.045), border: `1px solid ${alpha(AGENT_PURPLE, isDarkMode ? 0.5 : 0.22)}`, boxShadow: isDarkMode ? `0 0 0 1px ${alpha(AGENT_PURPLE, 0.18)}, 0 4px 16px ${alpha(AGENT_PURPLE, 0.18)}` : 'none' }}>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
                    <RobotOutlined style={{ fontSize: 13, color: AGENT_PURPLE }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: AGENT_PURPLE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        AI summary
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
                    {activeConversation.aiSummary}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ p: 2, border: `1px dashed ${messagesDashedBorder}`, borderRadius: 1, bgcolor: 'background.paper', textAlign: 'center' }}>
              <Typography variant="body2" fontWeight={700}>No conversation selected</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Select a conversation to see tenant, property, and lease context here.
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
      </MainCard>

    </Box>
  );
}
