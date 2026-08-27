import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  alpha,
  IconButton,
  InputAdornment,
  Tooltip,
  useTheme,
  useMediaQuery,
  OutlinedInput
} from '@mui/material';
import SafetyCertificateOutlined from '@ant-design/icons/SafetyCertificateOutlined';
import SendOutlined from '@ant-design/icons/SendOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import EditOutlined from '@ant-design/icons/EditOutlined';
import LinkOutlined from '@ant-design/icons/LinkOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import useEntitlement from 'hooks/useEntitlement';
import { LEASE_SHIELD_MANAGE_FEATURE, LEASE_SHIELD_READ_FEATURE } from 'utils/entitlements';
import remarkGfm from 'remark-gfm';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import {
  getConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation as deleteConversationApi,
  sendMessage as sendMessageApi,
  sendMessageNewConversation,
  STATE_NAME_TO_CODE,
  STATE_CODE_TO_NAME
} from 'api/leaseShield';
import { openSnackbar } from 'api/snackbar';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

// Mock UI panels used in the upgrade gate stepper
function LeaseShieldMock1() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>LeaseShield</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', background: '#eff6ff', color: '#1877F2', borderRadius: 12, border: '1px solid #bfdbfe', fontWeight: 600 }}>California</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', gap: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Ask a landlord-tenant question</div>
        <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 220 }}>Evictions, deposits, lease terms, notices — in plain English</div>
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ flex: 1, fontSize: 11, color: '#475569' }}>What is the eviction process in California?</span>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaseShieldMock2() {
  return (
    <div style={{ fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>LeaseShield</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', background: '#eff6ff', color: '#1877F2', borderRadius: 12, border: '1px solid #bfdbfe', fontWeight: 600 }}>California</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ alignSelf: 'flex-end', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 10, padding: '8px 12px', maxWidth: '80%', fontSize: 11, color: '#1e3a5f', fontWeight: 500 }}>
          What is the eviction process in California?
        </div>
        <div style={{ alignSelf: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', maxWidth: '88%' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>LeaseShield</span>
            <span style={{ background: '#eff6ff', color: '#1877F2', padding: '1px 6px', borderRadius: 8, border: '1px solid #bfdbfe' }}>CA</span>
          </div>
          <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.55 }}>
            In California, a landlord must first serve written notice — typically a <strong>3-day notice to pay or quit</strong> for unpaid rent. If the tenant doesn't comply, the landlord may file an <em>unlawful detainer</em> action in Superior Court.
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 8px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#41a541" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#41a541' }}>CA CCP § 1161 — Official Source</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaseShieldMock3() {
  const items = [
    { label: 'Notice to pay or quit', value: '3 days' },
    { label: 'Security deposit max', value: '2× rent' },
    { label: 'Deposit return deadline', value: '21 days' },
    { label: 'Entry notice required', value: '24 hours' },
  ];
  return (
    <div style={{ fontFamily: '"Inter", sans-serif', display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>LeaseShield</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['CA', 'TX', 'NY', 'FL'].map((s, i) => (
            <span key={s} style={{ fontSize: 10, padding: '2px 6px', background: i === 0 ? '#1e3a5f' : '#f1f5f9', color: i === 0 ? 'white' : '#64748b', borderRadius: 8, fontWeight: 600 }}>{s}</span>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>California Quick Reference</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 11, color: '#475569' }}>{item.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1e3a5f', background: '#eff6ff', padding: '2px 8px', borderRadius: 6 }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#41a541', fontWeight: 600 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#41a541" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          Sourced from California Civil Code
        </div>
      </div>
    </div>
  );
}

const UPGRADE_STEPS = [
  {
    label: 'Ask any question',
    desc: 'Ask landlord-tenant legal questions in plain English — evictions, deposits, notices, habitability, and more.',
  },
  {
    label: 'Official sourced answers',
    desc: 'Every response cites official government statutes. No blogs, no guesswork — real legal sources only.',
  },
  {
    label: 'All 50 states covered',
    desc: 'Laws vary by state. Select yours and get jurisdiction-specific guidance wherever your properties are.',
  },
];

// Starter questions shown in empty conversation view
const STARTER_QUESTIONS = [
  'What is the eviction process in [state]?',
  'How much can I charge for a security deposit in [state]?',
  'How much notice do I need to give a tenant before entering the property in [state]?',
  'What are the required disclosures for a residential lease in [state]?'
];

function formatConvTimestamp(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LeaseShield() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [stateRequiredError, setStateRequiredError] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameConvId, setRenameConvId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [startedNewConversation, setStartedNewConversation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState(0);
  const [upgradeProgress, setUpgradeProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const selected = selectedDetail && selectedDetail.id === selectedId ? selectedDetail : null;
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('lg'));
  const readEntitlement = useEntitlement(LEASE_SHIELD_READ_FEATURE);
  const manageEntitlement = useEntitlement(LEASE_SHIELD_MANAGE_FEATURE);
  const canRead = readEntitlement.presentation.kind === 'allowed';
  const canManage = manageEntitlement.presentation.kind === 'allowed';
  const isTenantPortal = location.pathname.startsWith('/tenant/');
  const dashboardPath = isTenantPortal ? '/tenant/dashboard' : '/landlord/dashboard';
  const breadcrumbItems = [
    { label: 'Dashboard', path: dashboardPath },
    { label: 'LeaseShield' }
  ];
  const subscriptionPlansUrl = isTenantPortal ? '/tenant/subscription' : '/landlord/settings?tab=subscription';

  // Current conversation's state (read-only when a convo is active)
  const activeConvState = selected
    ? (() => {
        const messages = selected?.messages || [];
        const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.state);
        const code = lastAssistant?.state || selected?.state;
        return code ? (STATE_CODE_TO_NAME[code] || code) : '';
      })()
    : selectedState;

  const filteredConversations = sidebarSearch.trim()
    ? conversations.filter((c) =>
        (c.title || '').toLowerCase().includes(sidebarSearch.toLowerCase())
      )
    : conversations;

  useEffect(() => {
    if (!canRead) {
      setLoadingConversations(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingConversations(true);
      try {
        const res = await getConversations();
        if (cancelled) return;
        if (res?.success && Array.isArray(res?.data)) {
          setConversations(res.data);
        }
      } catch (_err) {
        // Free plan returns 403; page shows upgrade prompt inline
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canRead]);

  useEffect(() => {
    if (!canRead || !selectedId) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    getConversation(selectedId)
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res?.data) {
          const data = res.data;
          setSelectedDetail(data);
          const messages = data?.messages || [];
          const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && m.state);
          const stateCode = lastAssistant?.state || data?.state;
          const stateName = stateCode ? (STATE_CODE_TO_NAME[stateCode] || stateCode) : '';
          setSelectedState(stateName);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => { cancelled = true; };
  }, [canRead, selectedId]);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      } else if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      }
    });
  }, []);

  useEffect(() => {
    if (selectedId && selected) {
      const t = setTimeout(() => scrollToBottom(false), 50);
      return () => clearTimeout(t);
    }
  }, [selectedId, selected, scrollToBottom]);

  useEffect(() => {
    if (optimisticUserMessage && sending) {
      const t = setTimeout(() => scrollToBottom(true), 80);
      return () => clearTimeout(t);
    }
  }, [optimisticUserMessage, sending, scrollToBottom]);

  useEffect(() => {
    if (canRead || readEntitlement.presentation.kind !== 'upgrade') return;
    const TICK = 50;
    const TOTAL = 4000;
    const id = setInterval(() => {
      setUpgradeProgress(p => {
        const next = p + (TICK / TOTAL) * 100;
        if (next >= 100) {
          setUpgradeStep(s => (s + 1) % UPGRADE_STEPS.length);
          return 0;
        }
        return next;
      });
    }, TICK);
    return () => clearInterval(id);
  }, [canRead, readEntitlement.presentation.kind]);

  const entitlementIsLoading = readEntitlement.isLoading || readEntitlement.presentation.kind === 'loading';
  if (entitlementIsLoading || loadingConversations) {
    return (
      <MainCard>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      </MainCard>
    );
  }

  const createNewConversation = async () => {
    if (!canManage) return;
    const stateCode = selectedState ? (STATE_NAME_TO_CODE[selectedState] || selectedState) : '';
    if (!stateCode) {
      setStateRequiredError(true);
      return;
    }
    setStateRequiredError(false);
    setCreatingConversation(true);
    try {
      const res = await createConversation({ state: stateCode, title: 'New conversation' });
      if (!res?.success || !res?.data) {
        openSnackbar({ open: true, message: res?.message || 'Failed to create conversation', variant: 'alert', alert: { color: 'error' } });
        return;
      }
      const conv = res.data;
      const listItem = { id: conv.id, title: conv.title, state: conv.state, updatedAt: conv.updatedAt };
      setConversations((prev) => [listItem, ...prev]);
      setSelectedId(conv.id);
      setSelectedDetail(conv);
      setMessageInput('');
      setStartedNewConversation(true);
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to create conversation',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleSelectConversation = (conv) => {
    setSelectedId(conv.id);
    setMessageInput('');
  };

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation();
    if (!canManage) return;
    try {
      const res = await deleteConversationApi(id);
      if (res?.success) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
          setSelectedDetail(null);
        }
      } else {
        openSnackbar({ open: true, message: res?.message || 'Failed to delete', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      openSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to delete conversation', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const getConversationTitle = (conv) => conv?.title || 'New conversation';

  const handleOpenRename = (e, conv) => {
    e.stopPropagation();
    setRenameConvId(conv.id);
    setRenameValue(conv.title || 'New conversation');
    setRenameDialogOpen(true);
  };

  const handleRenameSave = async () => {
    if (!canManage) return;
    if (renameConvId == null || !renameValue.trim()) return;
    try {
      const res = await updateConversation(renameConvId, { title: renameValue.trim() });
      if (res?.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === renameConvId ? { ...c, title: renameValue.trim() } : c))
        );
        if (selectedDetail?.id === renameConvId) {
          setSelectedDetail((d) => (d ? { ...d, title: renameValue.trim() } : d));
        }
        setRenameDialogOpen(false);
        setRenameConvId(null);
        setRenameValue('');
      } else {
        openSnackbar({ open: true, message: res?.message || 'Failed to rename', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      openSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to rename', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const handleRenameClose = () => {
    setRenameDialogOpen(false);
    setRenameConvId(null);
    setRenameValue('');
  };

  const handleSend = async (overrideText) => {
    if (!canManage) return;
    const text = (overrideText ?? messageInput).trim();
    if (!text || sending) return;

    if (!selectedState) {
      setStateRequiredError(true);
      return;
    }

    const stateCode = STATE_NAME_TO_CODE[selectedState] || selectedState;
    if (!stateCode) {
      setStateRequiredError(true);
      return;
    }

    setStateRequiredError(false);
    if (!selectedId) setStartedNewConversation(true); // keep input bar visible during send
    setSending(true);
    setMessageInput('');
    setOptimisticUserMessage({ content: text });

    try {
      const payload = { content: text, state: stateCode };
      const res = selectedId
        ? await sendMessageApi(selectedId, payload)
        : await sendMessageNewConversation(payload);

      if (!res?.success || !res?.data) {
        openSnackbar({ open: true, message: res?.message || 'Failed to send message', variant: 'alert', alert: { color: 'error' } });
        setMessageInput(text);
        setOptimisticUserMessage(null);
        setSending(false);
        return;
      }

      const conv = res.data;
      setSelectedDetail(conv);
      setSelectedId(conv.id);
      setOptimisticUserMessage(null);
      const listItem = { id: conv.id, title: conv.title, state: conv.state, updatedAt: conv.updatedAt };
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = listItem;
          return next;
        }
        return [listItem, ...prev];
      });
      scrollToBottom(false);
    } catch (err) {
      openSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to send message', variant: 'alert', alert: { color: 'error' } });
      setMessageInput(overrideText ?? '');
      setOptimisticUserMessage(null);
    } finally {
      setSending(false);
    }
  };

  const hasSidebar = (conversations.length > 0 || startedNewConversation) && !isSmallScreen;

  if (!canRead && readEntitlement.presentation.kind !== 'upgrade') {
    const deniedCopy = {
      'setup': ['Finish organization setup', 'Complete setup before using LeaseShield.'],
      'unauthorized': ['LeaseShield is not authorized', 'Ask an organization owner or manager to review your access.'],
      'unavailable': ['LeaseShield is unavailable', 'Access could not be confirmed, so this feature remains locked.']
    };
    const [title, message] = deniedCopy[readEntitlement.presentation.kind] || deniedCopy.unavailable;
    return (
      <MainCard>
        <Stack spacing={2} alignItems="center" sx={{ py: 8, textAlign: 'center' }}>
          <SafetyCertificateOutlined style={{ fontSize: 36 }} />
          <Typography variant="h4">{title}</Typography>
          <Typography color="text.secondary">{message}</Typography>
          {readEntitlement.presentation.kind === 'unavailable' && (
            <Button variant="outlined" onClick={readEntitlement.refresh}>Retry</Button>
          )}
        </Stack>
      </MainCard>
    );
  }

  // Upgrade presentation is driven only by the centralized entitlement decision.
  if (!canRead) {
    const mockPanels = [LeaseShieldMock1, LeaseShieldMock2, LeaseShieldMock3];
    const ActiveMock = mockPanels[upgradeStep];
    return (
      <Box>
        <PageBreadcrumbs items={breadcrumbItems} />
        {/* Header banner */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            borderRadius: 2,
            p: { xs: 3, md: 4 },
            mb: 3
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <SafetyCertificateOutlined style={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'white', mb: 0.75 }}>LeaseShield</Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                AI-powered legal guidance for landlord-tenant questions from official government sources
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Marketing gate card */}
        <MainCard sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>

            {/* Left: copy + step tabs + CTA */}
            <Box sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="overline" color="primary" fontWeight={700} sx={{ letterSpacing: 1 }}>
                  Premium Feature
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, mb: 1.5, lineHeight: 1.25 }}>
                  Know your rights.<br />Know the law.
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  LeaseShield is an AI legal assistant that answers your landlord-tenant questions using only official government statutes — so you always have a defensible, sourced answer.
                </Typography>
              </Box>

              {/* Animated step tabs */}
              <Stack spacing={1.5}>
                {UPGRADE_STEPS.map((s, i) => (
                  <Box
                    key={i}
                    onClick={() => { setUpgradeStep(i); setUpgradeProgress(0); }}
                    sx={{
                      p: 2, borderRadius: 2, cursor: 'pointer', position: 'relative', overflow: 'hidden',
                      border: 1,
                      borderColor: i === upgradeStep ? 'primary.main' : 'divider',
                      bgcolor: i === upgradeStep ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} color={i === upgradeStep ? 'primary.main' : 'text.primary'} gutterBottom>
                      {s.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                      {s.desc}
                    </Typography>
                    {/* Progress bar at bottom of active tab */}
                    {i === upgradeStep && (
                      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, bgcolor: alpha(theme.palette.primary.main, 0.15) }}>
                        <Box sx={{ height: '100%', bgcolor: 'primary.main', width: `${upgradeProgress}%`, transition: 'none' }} />
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>

              {/* CTA */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  onClick={() => navigate(subscriptionPlansUrl)}
                  sx={{ fontWeight: 700, textTransform: 'none', px: 4 }}
                >
                  Upgrade to Premium
                </Button>
                <Button variant="outlined" size="large" onClick={() => navigate(dashboardPath)} sx={{ textTransform: 'none' }}>
                  Back to Dashboard
                </Button>
              </Stack>
            </Box>

            {/* Right: animated browser-frame mock */}
            <Box
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: { xs: 3, md: 4 },
                borderLeft: { md: 1 },
                borderTop: { xs: 1, md: 0 },
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  maxWidth: 400,
                  borderRadius: 2,
                  overflow: 'hidden',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                {/* Browser chrome */}
                <Box sx={{ bgcolor: '#1a2035', px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Stack direction="row" spacing={0.75}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff5f57' }} />
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#febc2e' }} />
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#28c840' }} />
                  </Stack>
                  <Box sx={{ flex: 1, bgcolor: '#252d42', borderRadius: 1, px: 1.5, py: 0.75 }}>
                    <Typography sx={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                      app.brownstone-hub.com/lease-shield
                    </Typography>
                  </Box>
                </Box>
                {/* Animated mock UI */}
                <Box
                  key={upgradeStep}
                  sx={{
                    height: 280,
                    bgcolor: 'white',
                    animation: 'lsGateIn 0.35s ease-out',
                    '@keyframes lsGateIn': {
                      from: { opacity: 0, transform: 'translateY(8px)' },
                      to: { opacity: 1, transform: 'translateY(0)' },
                    },
                  }}
                >
                  <ActiveMock />
                </Box>
              </Box>
            </Box>

          </Box>
        </MainCard>
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs items={breadcrumbItems} />
      <Box sx={{ mb: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.5 }} flexWrap="wrap">
              <Typography variant="h3" fontWeight={700}>
                LeaseShield
              </Typography>
              {selected && activeConvState && (
                <Chip label={activeConvState} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem', borderRadius: 1 }} />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
              Ask landlord-tenant questions and get sourced, state-specific guidance from official government materials.
            </Typography>
          </Box>
          <Chip
            label="Informational guidance · not legal advice"
            size="small"
            variant="outlined"
            sx={{ borderRadius: 1, bgcolor: 'background.paper', color: 'text.secondary' }}
          />
        </Stack>
      </Box>

      <MainCard
        content={false}
        sx={{
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' }
        }}
      >

      {/* ── Small screen: conversation select under header ── */}
      {(conversations.length > 0 || startedNewConversation) && isSmallScreen && (
        <Box sx={{ px: 2, pt: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
              <Select
                value={selectedId ?? ''}
                displayEmpty
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) { const conv = conversations.find((c) => c.id === id); if (conv) handleSelectConversation(conv); }
                }}
                renderValue={(v) => {
                  if (!v) return 'Select conversation';
                  const c = conversations.find((x) => x.id === v);
                  return c ? getConversationTitle(c) : 'Select conversation';
                }}
              >
                <MenuItem value=""><em>Select conversation</em></MenuItem>
                {conversations.map((conv) => (
                  <MenuItem key={conv.id} value={conv.id}>
                    {getConversationTitle(conv)}
                    {conv.updatedAt && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        ({formatConvTimestamp(conv.updatedAt)})
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton size="small" color="primary" onClick={createNewConversation} disabled={creatingConversation} aria-label="New conversation" sx={{ flexShrink: 0 }}>
              {creatingConversation ? <CircularProgress size={18} color="inherit" /> : <PlusOutlined />}
            </IconButton>
          </Stack>
        </Box>
      )}

      <Grid container sx={{ height: 'calc(100vh - 315px)', minHeight: 460, overflow: 'hidden', pt: 0 }}>

        {/* ── Sidebar ── */}
        {hasSidebar && (
          <Grid size={{ xs: 12, md: 4 }} sx={{ borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', height: '100%', bgcolor: alpha(theme.palette.background.default, 0.25) }}>
            {/* Sidebar header */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" fontWeight={700}>Conversations</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={creatingConversation ? <CircularProgress size={14} color="inherit" /> : <PlusOutlined />}
                  disabled={creatingConversation}
                  onClick={createNewConversation}
                  sx={{ textTransform: 'none', px: 1.5, height: 32, fontSize: '0.78rem', borderRadius: 1 }}
                >
                  New Chat
                </Button>
              </Stack>
              {/* Search */}
              <OutlinedInput
                size="small"
                fullWidth
                placeholder="Search conversations…"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                startAdornment={<InputAdornment position="start"><SearchOutlined style={{ fontSize: 13, opacity: 0.45 }} /></InputAdornment>}
                sx={{ mt: 1.5, height: 34, bgcolor: 'background.paper', borderRadius: 1, '& .MuiOutlinedInput-input': { py: 0.75, fontSize: '0.8rem' } }}
              />
            </Box>

            {/* Conversation list */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <List sx={{ p: 0 }}>
                {filteredConversations.length === 0 ? (
                  <ListItem disablePadding>
                    <ListItemText
                      primary={sidebarSearch ? 'No conversations match.' : 'No conversations yet.'}
                      primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                      sx={{ py: 2, px: 2 }}
                    />
                  </ListItem>
                ) : (
                  filteredConversations.map((conv) => (
                    <ListItem
                      key={conv.id}
                      disablePadding
                      sx={{
                        bgcolor: selectedId === conv.id ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider',
                        borderLeft: selectedId === conv.id ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                        '&:hover': { bgcolor: selectedId === conv.id ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.035) },
                        '&:hover .conv-actions': { opacity: 1 },
                        '.conv-actions': { opacity: 0, transition: 'opacity 0.15s' }
                      }}
                      secondaryAction={
                        <Stack direction="row" spacing={0} alignItems="center" className="conv-actions">
                          <IconButton size="small" onClick={(e) => handleOpenRename(e, conv)} aria-label="Rename" sx={{ opacity: 0.6 }}>
                            <EditOutlined style={{ fontSize: 13 }} />
                          </IconButton>
                          <IconButton size="small" onClick={(e) => handleDeleteConversation(e, conv.id)} aria-label="Delete" sx={{ opacity: 0.6 }}>
                            <DeleteOutlined style={{ fontSize: 13 }} />
                          </IconButton>
                        </Stack>
                      }
                    >
                      <ListItemButton onClick={() => handleSelectConversation(conv)} sx={{ pr: 7 }}>
                        <ListItemText
                          primary={getConversationTitle(conv)}
                          primaryTypographyProps={{ noWrap: true, variant: 'body2', fontWeight: selectedId === conv.id ? 600 : 400 }}
                          secondary={formatConvTimestamp(conv.updatedAt)}
                          secondaryTypographyProps={{ variant: 'caption', color: 'text.disabled' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))
                )}
              </List>
            </Box>
          </Grid>
        )}

        {/* ── Main chat area ── */}
        <Grid
          size={{ xs: 12, md: hasSidebar ? 8 : 12 }}
          sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
        >
          {!selected ? (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'auto' }}>
              {conversations.length === 0 && !startedNewConversation ? (
                /* First visit */
                <>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3, borderRadius: 2, borderColor: 'divider',
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                      mb: 2, maxWidth: 880, mx: 'auto', width: '100%'
                    }}
                  >
                    <Stack direction="column" spacing={2} alignItems="center" sx={{ mb: 2, textAlign: 'center' }}>
                      <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <SafetyCertificateOutlined style={{ fontSize: 26 }} />
                      </Box>
                      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                        <Typography variant="h3" gutterBottom fontWeight={600}>LeaseShield</Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 1, fontSize: '1.125rem', lineHeight: 1.6 }}>
                          Get guidance on landlord-tenant legal questions through a conversational AI that uses
                          only official government and legal sources—so you get the most up-to-date information
                          on evictions, security deposits, lease terms, notices, habitability, and other
                          rental law topics. Always consider consulting a licensed attorney for your specific situation.
                        </Typography>
                        <Typography variant="caption" component="div" sx={{ color: 'text.secondary', opacity: 0.85, mt: 5, fontSize: '0.7rem', lineHeight: 1.4 }}>
                          Disclaimer: LeaseShield is for general informational purposes only and does not
                          constitute legal advice. Laws vary by jurisdiction and change over time. For advice
                          specific to your situation, please consult a qualified attorney in your area.
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                  {!canManage ? (
                    <>
                      <Paper
                        variant="outlined"
                        sx={{ p: 2, mb: 2, maxWidth: 880, mx: 'auto', width: '100%', bgcolor: (t) => alpha(t.palette.primary.main, 0.08), borderColor: 'primary.main', borderRadius: 2 }}
                      >
                        <Stack direction="column" alignItems="center" spacing={1.5}>
                          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} flexWrap="wrap">
                            <SafetyCertificateOutlined style={{ color: 'var(--mui-palette-primary-main)', fontSize: 20 }} />
                            <Typography variant="body2" fontWeight={600} color="primary.main">LeaseShield is a Premium feature.</Typography>
                            <Typography variant="body2" color="text.secondary">Upgrade your subscription to use LeaseShield and get lease and state law answers from government sources only.</Typography>
                          </Stack>
                        </Stack>
                      </Paper>
                      <Button
                        variant="contained"
                        size="medium"
                        onClick={() => setUpgradeModalOpen(true)}
                        sx={{ mx: 'auto', textTransform: 'none', fontWeight: 600, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
                      >
                        Upgrade
                      </Button>
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 3, mb: 2, gap: 2 }}>
                      <FormControl size="small" sx={{ minWidth: 220 }} error={stateRequiredError} required>
                        <Select
                          value={selectedState}
                          displayEmpty
                          onChange={(e) => { setSelectedState(e.target.value); setStateRequiredError(false); }}
                          renderValue={(v) => v || 'Select a state'}
                          sx={{ bgcolor: 'background.paper' }}
                        >
                          <MenuItem value=""><em>Select a state</em></MenuItem>
                          {US_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                        {stateRequiredError && <FormHelperText>Please select a state to start a conversation.</FormHelperText>}
                      </FormControl>
                      <Button
                        variant="contained"
                        size="large"
                        onClick={createNewConversation}
                        disabled={creatingConversation}
                        startIcon={creatingConversation ? <CircularProgress size={18} color="inherit" /> : null}
                        sx={{ textTransform: 'none', fontWeight: 600, px: 3, py: 1.5 }}
                      >
                        {creatingConversation ? 'Starting…' : 'Start Conversation'}
                      </Button>
                    </Box>
                  )}
                </>
              ) : (
                /* Returning user — no conversation selected */
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 3, gap: 3 }}>
                  <Stack alignItems="center" spacing={1.5} sx={{ textAlign: 'center', maxWidth: 520 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <SafetyCertificateOutlined style={{ fontSize: 22 }} />
                    </Box>
                    <Typography variant="h6" fontWeight={600}>
                      {selectedState ? `Ask a ${selectedState} landlord-tenant question` : 'Ask a landlord-tenant question'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      LeaseShield answers using only official government statutes—covering evictions, security deposits, lease terms, notices, and more.{!selectedState && ' Select a state below to get started.'}
                    </Typography>
                  </Stack>
                  <Stack spacing={1} sx={{ width: '100%', maxWidth: 520 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Common questions
                    </Typography>
                    {STARTER_QUESTIONS.map((q) => {
                      const label = selectedState ? q.replace('[state]', selectedState) : q.replace('[state]', 'your state');
                      return (
                        <Button
                          key={q}
                          variant="outlined"
                          size="small"
                          onClick={() => selectedState && handleSend(q.replace('[state]', selectedState))}
                          disabled={sending || !selectedState}
                          sx={{
                            textTransform: 'none', justifyContent: 'flex-start',
                            textAlign: 'left', borderRadius: 1.5,
                            borderColor: (t) => alpha(t.palette.primary.main, 0.3),
                            fontSize: '0.825rem',
                            '&:hover': { borderColor: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.05) },
                            '&.Mui-disabled': { borderColor: (t) => alpha(t.palette.primary.main, 0.15), color: 'text.disabled' }
                          }}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </Box>
          ) : (
            /* Messages */
            <Box
              ref={messagesContainerRef}
              sx={{ flex: '1 1 0', minHeight: 0, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              {loadingDetail ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <>
                  {[
                    ...(selected?.messages || []),
                    ...(optimisticUserMessage ? [{ id: 'optimistic-user', role: 'user', content: optimisticUserMessage.content }] : [])
                  ].map((msg, idx) => (
                    <Box key={msg.id ?? idx} sx={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2, borderRadius: 2,
                          bgcolor: msg.role === 'user' ? (t) => alpha(t.palette.primary.main, 0.12) : 'background.paper',
                          borderColor: 'divider'
                        }}
                      >
                        {msg.role === 'user' ? (
                          <>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>You</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Typography>
                          </>
                        ) : (
                          <>
                            {/* Left-aligned assistant header */}
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" fontWeight={700}>LeaseShield</Typography>
                              {msg.state && (
                                <Chip label={STATE_CODE_TO_NAME[msg.state] || msg.state} size="small" color="primary" sx={{ height: 18, fontSize: '0.68rem' }} />
                              )}
                              {msg.sourceUrl && (
                                <Tooltip title="View source" placement="top">
                                  <IconButton
                                    size="small"
                                    onClick={() => window.open(msg.sourceUrl, '_blank', 'noopener,noreferrer')}
                                    sx={{ p: 0.25, color: 'text.secondary' }}
                                  >
                                    <LinkOutlined style={{ fontSize: 14 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                            <Typography
                              component="div"
                              variant="body2"
                              sx={{
                                whiteSpace: 'pre-wrap',
                                '& p': { margin: 0, lineHeight: 1.5 },
                                '& p:last-child': { marginBottom: 0 },
                                '& p:empty': { display: 'none', margin: 0, minHeight: 0, lineHeight: 0 },
                                '& strong': { fontWeight: 700 },
                                '& h1': { margin: '0.5em 0 0.35em 0', fontSize: '1.15em', fontWeight: 700, lineHeight: 1.3 },
                                '& h2': { margin: '0.85em 0 0.35em 0', fontSize: '1.05em', fontWeight: 700, lineHeight: 1.3 },
                                '& h3, & h4, & h5, & h6': { margin: '0.6em 0 0.25em 0', fontSize: '1em', fontWeight: 600, lineHeight: 1.4 },
                                '& > *:first-child': { marginTop: 0 },
                                '& > *:last-child': { marginBottom: 0 },
                                '& > * + ol': { marginTop: 0 },
                                '& > ol + *': { marginTop: 0 },
                                '& ol': { margin: 0, paddingLeft: 0, listStyle: 'none', counterReset: 'lease-shield-list' },
                                '& ol li': { marginBottom: '0.15em', display: 'flex', alignItems: 'flex-start', gap: '0', counterIncrement: 'lease-shield-list' },
                                '& ol li::before': { content: "counter(lease-shield-list) '. '", fontWeight: 600, flexShrink: 0 },
                                '& ol li p': { margin: 0, display: 'inline', flex: 1 },
                                '& > * + ul': { marginTop: 0, paddingTop: 0 },
                                '& > ul + *': { marginTop: 0 },
                                '& p + ul, & h1 + ul, & h3 + ul, & h4 + ul, & h5 + ul, & h6 + ul': { marginTop: '-0.45em', paddingTop: 0 },
                                '& h2 + ul': { marginTop: '0.15em', paddingTop: 0 },
                                '& ul': { margin: 0, paddingLeft: 0, paddingTop: 0, paddingBottom: 0, lineHeight: 1.4, listStyle: 'none' },
                                '& ul li': { marginTop: 0, marginBottom: '0.2em', padding: 0, lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: '0.35em' },
                                '& ul li::before': { content: '"• "', flexShrink: 0, fontWeight: 700 },
                                '& ul li > *': { flex: 1, minWidth: 0 },
                                '& ul li:first-of-type': { marginTop: 0 },
                                '& ul li p': { margin: 0, display: 'inline' },
                                '& p:has(+ ul), & h1:has(+ ul), & h2:has(+ ul), & h3:has(+ ul), & h4:has(+ ul), & h5:has(+ ul), & h6:has(+ ul)': { marginBottom: 0, lineHeight: 1.2 },
                                '& p:has(+ ul) strong': { display: 'inline' }
                              }}
                            >
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ''}</ReactMarkdown>
                            </Typography>
                          </>
                        )}
                      </Paper>
                    </Box>
                  ))}
                  {sending && (
                    <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CircularProgress size={18} thickness={4} />
                        <Typography variant="caption" color="text.secondary">LeaseShield is thinking…</Typography>
                      </Paper>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </Box>
          )}

          {/* Disclaimer above input (large screens) */}
          {!isSmallScreen && (conversations.length > 0 || startedNewConversation || selected) && (
            <Paper variant="outlined" sx={{ flexShrink: 0, mx: 2, mb: 1, p: 1.5, borderRadius: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SafetyCertificateOutlined style={{ fontSize: 18 }} />
                <Typography variant="caption" color="text.secondary">Ask landlord-tenant legal questions. Not legal advice—consult a qualified attorney for your situation.</Typography>
              </Stack>
            </Paper>
          )}

          {/* ── Input bar — hidden only on first-visit landing (no conversations yet) */}
          {(conversations.length > 0 || startedNewConversation || selected) && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
              {/* State selector: full-width above input on mobile, inline on desktop */}
              {isSmallScreen && (
                <FormControl fullWidth error={stateRequiredError} required={!selected} size="small" sx={{ mb: 1 }}>
                  <Select
                    value={selectedState}
                    displayEmpty
                    disabled={!!selected}
                    onChange={(e) => { setSelectedState(e.target.value); setStateRequiredError(false); }}
                    renderValue={(v) => v || 'Select a state'}
                    sx={{ bgcolor: 'background.paper', borderRadius: 2 }}
                  >
                    <MenuItem value=""><em>Select a state</em></MenuItem>
                    {US_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                  {stateRequiredError && <FormHelperText>Required</FormHelperText>}
                </FormControl>
              )}
              <Stack direction="row" spacing={1} alignItems="flex-end">
                {/* State selector inline — desktop only */}
                {!isSmallScreen && (
                  <FormControl error={stateRequiredError} required={!selected} sx={{ minWidth: 150, flexShrink: 0 }}>
                    <Select
                      value={selectedState}
                      displayEmpty
                      disabled={!!selected}
                      onChange={(e) => { setSelectedState(e.target.value); setStateRequiredError(false); }}
                      renderValue={(v) => v || 'State'}
                      sx={{ bgcolor: 'background.paper', borderRadius: 2, '& .MuiSelect-select': { py: '8px' } }}
                    >
                      <MenuItem value=""><em>Select a state</em></MenuItem>
                      {US_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                    {stateRequiredError && <FormHelperText>Required</FormHelperText>}
                  </FormControl>
                )}
                <TextField
                  fullWidth
                  multiline
                  maxRows={4}
                  placeholder="Ask a landlord-tenant legal question..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  disabled={sending}
                  sx={{
                    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light' },
                    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.light', borderWidth: '1px' }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end" sx={{ alignSelf: 'center', mr: 0.5 }}>
                        <IconButton color="primary" onClick={() => handleSend()} disabled={!messageInput.trim() || sending} aria-label="Send">
                          <SendOutlined />
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: { borderRadius: 2, bgcolor: 'background.paper', py: 0.5, '& input, & textarea': { fontSize: '0.9375rem', py: 0.25 } }
                  }}
                />
              </Stack>
              {/* Disclaimer below input on small screens */}
              {isSmallScreen && (conversations.length > 0 || startedNewConversation || selected) && (
                <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, borderRadius: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
                  <Typography variant="caption" color="text.secondary">
                    For informational purposes only. Consult a qualified attorney for your situation.
                  </Typography>
                </Paper>
              )}
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onClose={handleRenameClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>Rename conversation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Title" value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRenameSave()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleRenameClose} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleRenameSave} variant="contained" disabled={!renameValue.trim()} sx={{ textTransform: 'none' }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Upgrade dialog */}
      <Dialog open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>LeaseShield is a Premium feature</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Upgrade to Premium to use LeaseShield and get lease and state law answers from government sources only.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUpgradeModalOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => { setUpgradeModalOpen(false); navigate(subscriptionPlansUrl); }}
            sx={{ textTransform: 'none', bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
          >
            Upgrade
          </Button>
        </DialogActions>
      </Dialog>
    </MainCard>
    </Box>
  );
}
