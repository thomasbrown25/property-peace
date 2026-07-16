import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosServices from 'utils/axios';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  Chip,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Collapse,
  Tooltip,
  Divider,
  Slide
} from '@mui/material';
import {
  CloseOutlined,
  LeftOutlined,
  RightOutlined,
  ToolOutlined,
  SendOutlined,
  UserAddOutlined,
  EyeOutlined,
  RobotOutlined
} from '@ant-design/icons';

import { updateMaintenance, generateTenantMessage } from 'store/maintenance/maintenance.action';
import { addMessage, getMessages } from 'store/message/message.action';
import { getConversations } from 'store/conversation/conversation.action';
import { selectConversations } from 'store/conversation/conversation.selector';
import { openSnackbar } from 'api/snackbar';
import AssignMaintenanceModal from 'components/modals/AssignMaintenanceModal';

const DISMISSED_KEY = 'dismissed_new_maintenance_panel_ids';
// Show requests created within the last 4 hours
const RECENT_WINDOW_MS = 4 * 60 * 60 * 1000;
const POLL_INTERVAL_MS = 15_000;

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open', color: 'primary' },
  { value: 'InProgress', label: 'In Progress', color: 'warning' },
  { value: 'Pending', label: 'Pending', color: 'warning' },
  { value: 'OnHold', label: 'On Hold', color: 'warning' },
  { value: 'Completed', label: 'Completed', color: 'success' },
  { value: 'Cancelled', label: 'Cancelled', color: 'default' }
];

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low', color: 'success' },
  { value: 'Medium', label: 'Medium', color: 'warning' },
  { value: 'High', label: 'High', color: 'error' }
];

function getDismissedIds() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

function addDismissedId(id) {
  const existing = getDismissedIds();
  if (!existing.includes(id)) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...existing, id]));
  }
}

function isRecent(createdAt) {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < RECENT_WINDOW_MS;
}

export default function NewMaintenancePanel() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const conversations = useSelector(selectConversations);

  const [visibleRequests, setVisibleRequests] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  const [statusUpdating, setStatusUpdating] = useState({});
  const [priorityUpdating, setPriorityUpdating] = useState({});
  const [messageText, setMessageText] = useState({});
  const [generatingMessage, setGeneratingMessage] = useState({});
  const [sendingMessage, setSendingMessage] = useState({});
  const [messageExpanded, setMessageExpanded] = useState({});
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  // Fetch directly — bypasses Redux shared state so other components
  // pre-loading the same slice can't interfere with "new" detection
  const fetchAndUpdate = useCallback(async () => {
    try {
      const response = await axiosServices.get('/api/maintenance-request/organization/current');
      if (!response.data?.success) return;

      const all = response.data.data || [];
      const dismissedIds = getDismissedIds();

      const fresh = all.filter(
        (m) =>
          (m.status === 'Open' || m.status === 0) &&
          isRecent(m.createdAt) &&
          !dismissedIds.includes(m.id)
      );

      if (fresh.length > 0) {
        setVisibleRequests(fresh);
        setCurrentIndex(0);
        setDismissed(false);
        setPanelOpen(true);
      } else {
        setVisibleRequests([]);
        setPanelOpen(false);
      }
    } catch {
      // silently ignore poll errors
    }
  }, []);

  useEffect(() => {
    fetchAndUpdate();
    dispatch(getConversations());

    const id = setInterval(fetchAndUpdate, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [dispatch, fetchAndUpdate]);

  const current = visibleRequests[currentIndex] || null;

  const handleDismissAll = () => {
    visibleRequests.forEach((m) => addDismissedId(m.id));
    setVisibleRequests([]);
    setPanelOpen(false);
  };

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(visibleRequests.length - 1, i + 1));

  const slideOutAndRemove = useCallback((id) => {
    addDismissedId(id);
    setVisibleRequests((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (next.length === 0) {
        setPanelOpen(false);
      } else {
        setCurrentIndex((i) => Math.min(i, next.length - 1));
      }
      return next;
    });
  }, []);

  const handleStatusChange = async (maintenance, newStatus) => {
    setStatusUpdating((s) => ({ ...s, [maintenance.id]: true }));
    try {
      await dispatch(updateMaintenance({
        id: maintenance.id,
        title: maintenance.title,
        unitName: maintenance.unitName || '',
        priority: maintenance.priority,
        status: newStatus,
        description: maintenance.description || '',
        categoryId: maintenance.categoryId || 0,
        imageUrl: '',
        completedAt: newStatus === 'Completed' ? new Date().toISOString() : null,
        vendorId: maintenance.vendorId || null
      }));
      if (newStatus === 'Completed' || newStatus === 'Cancelled') {
        slideOutAndRemove(maintenance.id);
      }
    } finally {
      setStatusUpdating((s) => ({ ...s, [maintenance.id]: false }));
    }
  };

  const handlePriorityChange = async (maintenance, newPriority) => {
    setPriorityUpdating((s) => ({ ...s, [maintenance.id]: true }));
    try {
      await dispatch(updateMaintenance({
        id: maintenance.id,
        title: maintenance.title,
        unitName: maintenance.unitName || '',
        priority: newPriority,
        status: maintenance.status,
        description: maintenance.description || '',
        categoryId: maintenance.categoryId || 0,
        imageUrl: '',
        completedAt: maintenance.completedAt || null,
        vendorId: maintenance.vendorId || null
      }));
    } finally {
      setPriorityUpdating((s) => ({ ...s, [maintenance.id]: false }));
    }
  };

  const handleGenerateMessage = async (maintenance) => {
    setGeneratingMessage((s) => ({ ...s, [maintenance.id]: true }));
    try {
      const result = await dispatch(generateTenantMessage(maintenance.id));
      if (result?.success) {
        setMessageText((s) => ({ ...s, [maintenance.id]: result.data?.message || '' }));
        setMessageExpanded((s) => ({ ...s, [maintenance.id]: true }));
      }
    } finally {
      setGeneratingMessage((s) => ({ ...s, [maintenance.id]: false }));
    }
  };

  const findConversationForMaintenance = useCallback((maintenance) => {
    if (!conversations) return null;
    return conversations.find((c) => c.propertyId === maintenance.propertyId) || null;
  }, [conversations]);

  const hasTenantConversation = useCallback(
    (maintenance) => !!findConversationForMaintenance(maintenance),
    [findConversationForMaintenance]
  );

  const handleSendMessage = async (maintenance) => {
    const text = messageText[maintenance.id];
    if (!text?.trim()) return;

    const conversation = findConversationForMaintenance(maintenance);
    if (!conversation) {
      openSnackbar({
        open: true,
        message: 'No existing conversation found for this tenant.',
        variant: 'alert',
        alert: { color: 'warning', variant: 'filled' },
        close: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 4000
      });
      return;
    }

    setSendingMessage((s) => ({ ...s, [maintenance.id]: true }));
    try {
      await dispatch(addMessage({ conversationId: conversation.id, content: text.trim() }));
      await dispatch(getMessages(conversation.id));
      openSnackbar({
        open: true,
        message: 'Message sent to tenant',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        close: true,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 4000
      });
      setMessageText((s) => ({ ...s, [maintenance.id]: '' }));
      setMessageExpanded((s) => ({ ...s, [maintenance.id]: false }));
    } finally {
      setSendingMessage((s) => ({ ...s, [maintenance.id]: false }));
    }
  };

  if (!current) return null;

  const priorityOption = PRIORITY_OPTIONS.find(
    (p) => p.value === current.priority || p.value.toLowerCase() === String(current.priority).toLowerCase()
  );
  const isMessageExpanded = messageExpanded[current.id] || false;
  const currentMessageText = messageText[current.id] || '';
  const canSend = hasTenantConversation(current);

  return (
    <>
      <Slide direction="up" in={panelOpen} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1400,
            width: 340,
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1.25,
              bgcolor: 'warning.lighter',
              borderBottom: '1px solid',
              borderColor: 'warning.light',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box sx={{ color: 'warning.dark', display: 'flex', alignItems: 'center' }}>
              <ToolOutlined style={{ fontSize: 14 }} />
            </Box>
            <Typography
              variant="caption"
              fontWeight={700}
              color="warning.dark"
              sx={{ letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 }}
            >
              New Request{visibleRequests.length > 1 ? `s (${visibleRequests.length})` : ''}
            </Typography>

            {visibleRequests.length > 1 && (
              <Stack direction="row" spacing={0.5} alignItems="center">
                <IconButton size="small" onClick={handlePrev} disabled={currentIndex === 0} sx={{ p: 0.5 }}>
                  <LeftOutlined style={{ fontSize: 12 }} />
                </IconButton>
                <Typography variant="caption" color="text.secondary">
                  {currentIndex + 1}/{visibleRequests.length}
                </Typography>
                <IconButton size="small" onClick={handleNext} disabled={currentIndex === visibleRequests.length - 1} sx={{ p: 0.5 }}>
                  <RightOutlined style={{ fontSize: 12 }} />
                </IconButton>
              </Stack>
            )}

            <Tooltip title="Dismiss all (won't clear notifications)">
              <IconButton size="small" onClick={handleDismissAll} sx={{ p: 0.5, ml: 0.5 }}>
                <CloseOutlined style={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Body */}
          <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
            <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 0.5 }}>
              <Chip
                label={priorityOption?.label || current.priority}
                color={priorityOption?.color || 'default'}
                size="small"
                sx={{ fontWeight: 700, fontSize: 11 }}
              />
              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.4 }}>
                {current.title}
              </Typography>
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {[current.propertyName, current.unitName].filter(Boolean).join(' · ')}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Status
                </Typography>
                <Select
                  size="small"
                  fullWidth
                  value={current.status || 'Open'}
                  onChange={(e) => handleStatusChange(current, e.target.value)}
                  disabled={!!statusUpdating[current.id]}
                  sx={{ fontSize: 12 }}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 12 }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Priority
                </Typography>
                <Select
                  size="small"
                  fullWidth
                  value={current.priority || 'Medium'}
                  onChange={(e) => handlePriorityChange(current, e.target.value)}
                  disabled={!!priorityUpdating[current.id]}
                  sx={{ fontSize: 12 }}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 12 }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Stack>

            <Divider sx={{ mb: 1.5 }} />

            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<UserAddOutlined />}
                onClick={() => setAssignModalOpen(true)}
                sx={{ flex: 1, fontSize: 12 }}
              >
                {current.assignedToType && current.assignedToType !== 'Unassigned' ? 'Reassign' : 'Assign'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EyeOutlined />}
                onClick={() => navigate(`/landlord/maintenance/${current.id}`)}
                sx={{ flex: 1, fontSize: 12 }}
              >
                View
              </Button>
            </Stack>

            <Collapse in={!isMessageExpanded}>
              <Tooltip title={!canSend ? 'No tenant conversation found for this property' : ''}>
                <span>
                  <Button
                    size="small"
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={
                      generatingMessage[current.id]
                        ? <CircularProgress size={12} color="inherit" />
                        : <RobotOutlined />
                    }
                    onClick={() => handleGenerateMessage(current)}
                    disabled={!canSend || !!generatingMessage[current.id]}
                    sx={{ fontSize: 12 }}
                  >
                    {generatingMessage[current.id] ? 'Drafting...' : 'Draft tenant message'}
                  </Button>
                </span>
              </Tooltip>
            </Collapse>

            <Collapse in={isMessageExpanded}>
              <Stack spacing={1}>
                <TextField
                  multiline
                  rows={3}
                  size="small"
                  fullWidth
                  value={currentMessageText}
                  onChange={(e) => setMessageText((s) => ({ ...s, [current.id]: e.target.value }))}
                  placeholder="Edit message before sending..."
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: 12 } }}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={() => setMessageExpanded((s) => ({ ...s, [current.id]: false }))}
                    sx={{ flex: 1, fontSize: 12 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={
                      sendingMessage[current.id]
                        ? <CircularProgress size={12} color="inherit" />
                        : <SendOutlined />
                    }
                    onClick={() => handleSendMessage(current)}
                    disabled={!currentMessageText.trim() || !!sendingMessage[current.id]}
                    sx={{ flex: 1, fontSize: 12 }}
                  >
                    Send
                  </Button>
                </Stack>
              </Stack>
            </Collapse>
          </Box>
        </Box>
      </Slide>

      <AssignMaintenanceModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        maintenance={current}
        onSuccess={() => dispatch(getCurrentMaintenancesByOrganization())}
      />
    </>
  );
}
