import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CustomerServiceOutlined,
  MessageOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined
} from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { formatRelativeTime } from 'utils/formatters';

const CATEGORIES = [
  { value: 'general', label: 'General', helper: 'Account, billing, or how-to questions' },
  { value: 'bug', label: 'Bug Report', helper: 'Tell us about unexpected product behavior' },
  { value: 'feature', label: 'Feature Request', helper: 'Suggest an improvement or new capability' },
  { value: 'feedback', label: 'Feedback Request', helper: 'Share what is working well or could be better' }
];

const categoryLabel = (value) => CATEGORIES.find((category) => category.value === value)?.label || 'Support';
const capitalizeFirstLetter = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);

function TicketRow({ ticket, selected, onClick }) {
  const lastReplyFromSupport = ticket.lastMessageBy && ticket.lastMessageBy !== ticket.userId;

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={(theme) => ({
        width: '100%',
        border: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderLeft: '3px solid',
        borderLeftColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
        color: 'inherit',
        cursor: 'pointer',
        p: 2,
        textAlign: 'left',
        '&:hover': { bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'action.hover' },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 }
      })}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Avatar
          sx={(theme) => ({
            width: 38,
            height: 38,
            bgcolor: ticket.isResolved ? 'grey.100' : alpha(theme.palette.primary.main, 0.1),
            color: ticket.isResolved ? 'text.secondary' : 'primary.main'
          })}
        >
          <CustomerServiceOutlined />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" noWrap sx={{ flex: 1, fontWeight: ticket.unreadCount ? 750 : 650 }}>
              {capitalizeFirstLetter(ticket.subject)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {formatRelativeTime(ticket.lastActivityAt || ticket.createdAt)}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {ticket.ticketNumber} · {categoryLabel(ticket.subType)}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
            <Chip
              size="small"
              label={ticket.isResolved ? 'Closed' : 'Open'}
              color={ticket.isResolved ? 'default' : 'success'}
              variant={ticket.isResolved ? 'outlined' : 'filled'}
              sx={{ height: 22, borderRadius: 1 }}
            />
            {!ticket.isResolved && lastReplyFromSupport && (
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 650 }}>
                Support replied
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {ticket.unreadCount > 0 && <Chip size="small" color="primary" label={ticket.unreadCount} sx={{ height: 20, minWidth: 20 }} />}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function MessageBubble({ message }) {
  const fromSupport = message.isFromSupport;
  return (
    <Stack direction="row" justifyContent={fromSupport ? 'flex-start' : 'flex-end'}>
      <Box sx={{ maxWidth: { xs: '88%', md: '74%' } }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: 0.5, textAlign: fromSupport ? 'left' : 'right' }}
        >
          {fromSupport ? 'Property Peace Support' : 'You'} · {formatRelativeTime(message.createdAt)}
        </Typography>
        <Paper
          elevation={0}
          sx={(theme) => ({
            px: 2,
            py: 1.5,
            borderRadius: fromSupport ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
            bgcolor: fromSupport ? 'background.paper' : 'primary.main',
            color: fromSupport ? 'text.primary' : 'primary.contrastText',
            border: fromSupport ? `1px solid ${theme.palette.divider}` : 0
          })}
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.65 }}>
            {message.content}
          </Typography>
        </Paper>
      </Box>
    </Stack>
  );
}

export default function SupportTicketCenter() {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTicketId = searchParams.get('ticket');
  const threadEndRef = useRef(null);

  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(requestedTicketId ? Number(requestedTicketId) : null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: 'general', subject: '', message: '' });

  const loadTickets = useCallback(async ({ keepSelection = true } = {}) => {
    setLoading(true);
    try {
      const response = await axiosServices.get('/api/support/tickets');
      const items = response.data?.data || [];
      setTickets(items);
      setSelectedId((current) => {
        if (keepSelection && current && items.some((item) => item.id === current)) return current;
        if (requestedTicketId && items.some((item) => item.id === Number(requestedTicketId))) return Number(requestedTicketId);
        return mobile ? null : items[0]?.id || null;
      });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Could not load your support tickets.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setLoading(false);
    }
  }, [mobile, requestedTicketId]);

  const loadTicket = useCallback(async (id) => {
    if (!id) {
      setTicket(null);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await axiosServices.get(`/api/support/tickets/${id}`);
      setTicket(response.data?.data || null);
      setTickets((current) => current.map((item) => (item.id === id ? { ...item, unreadCount: 0 } : item)));
    } catch (error) {
      setTicket(null);
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Could not open this support ticket.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadTicket(selectedId);
    if (selectedId) {
      const next = new URLSearchParams(searchParams);
      next.set('ticket', selectedId);
      setSearchParams(next, { replace: true });
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ticket?.messages?.length]);

  const openCount = useMemo(() => tickets.filter((item) => !item.isResolved).length, [tickets]);

  const handleCreate = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      openSnackbar({ open: true, message: 'Add a subject and message before creating the ticket.', variant: 'alert', alert: { color: 'error' } });
      return;
    }
    setCreating(true);
    try {
      const response = await axiosServices.post('/api/support/submit-request', {
        type: form.type,
        subject: form.subject.trim(),
        message: form.message.trim()
      });
      const created = response.data?.data;
      setForm({ type: 'general', subject: '', message: '' });
      setCreateOpen(false);
      await loadTickets({ keepSelection: false });
      if (created?.id) setSelectedId(created.id);
      openSnackbar({ open: true, message: `${created?.ticketNumber || 'Your ticket'} was created.`, variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Could not create your support ticket.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async () => {
    const content = reply.trim();
    if (!content || !selectedId) return;
    setReplying(true);
    try {
      await axiosServices.post(`/api/support/tickets/${selectedId}/reply`, { message: content });
      setReply('');
      await Promise.all([loadTicket(selectedId), loadTickets()]);
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Could not send your reply.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setReplying(false);
    }
  };

  const handleStatus = async () => {
    if (!ticket) return;
    setStatusUpdating(true);
    try {
      await axiosServices.put(`/api/support/tickets/${ticket.id}/status`, { isResolved: !ticket.isResolved });
      await Promise.all([loadTicket(ticket.id), loadTickets()]);
      openSnackbar({ open: true, message: ticket.isResolved ? 'Ticket reopened.' : 'Ticket closed.', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Could not update the ticket.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setStatusUpdating(false);
    }
  };

  const showList = !mobile || !selectedId;
  const showDetail = !mobile || Boolean(selectedId);

  return (
    <Stack spacing={2.5}>
      <Paper
        variant="outlined"
        sx={(currentTheme) => ({
          p: { xs: 2.25, md: 3 },
          borderRadius: 2,
          borderColor: alpha(currentTheme.palette.primary.main, 0.18),
          bgcolor: alpha(currentTheme.palette.primary.main, 0.035)
        })}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 750 }}>Your support tickets</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Keep every question and reply together in one place. {openCount} ticket{openCount === 1 ? '' : 's'} currently open.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => setCreateOpen(true)} sx={{ flexShrink: 0 }}>
            New support ticket
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', minHeight: 560 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '360px minmax(0, 1fr)' }, minHeight: 560 }}>
          {showList && (
            <Box sx={{ borderRight: { md: 1 }, borderColor: 'divider', minWidth: 0 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>Tickets</Typography>
                  <Typography variant="caption" color="text.secondary">{tickets.length} total</Typography>
                </Box>
                <Tooltip title="Refresh tickets">
                  <IconButton size="small" onClick={() => loadTickets()} disabled={loading} aria-label="Refresh tickets">
                    <ReloadOutlined />
                  </IconButton>
                </Tooltip>
              </Stack>
              {loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }}><CircularProgress size={28} /></Stack>
              ) : tickets.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 420, px: 4, textAlign: 'center' }}>
                  <Avatar sx={{ width: 54, height: 54, bgcolor: 'primary.lighter', color: 'primary.main', mb: 2 }}><MessageOutlined /></Avatar>
                  <Typography variant="h6">No tickets yet</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2.5 }}>
                    Start a conversation with support whenever you need help.
                  </Typography>
                  <Button variant="outlined" startIcon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Create your first ticket</Button>
                </Stack>
              ) : (
                <Box sx={{ maxHeight: 650, overflowY: 'auto' }}>
                  {tickets.map((item) => (
                    <TicketRow key={item.id} ticket={item} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} />
                  ))}
                </Box>
              )}
            </Box>
          )}

          {showDetail && (
            <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {!selectedId ? (
                <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, minHeight: 500, px: 4, textAlign: 'center' }}>
                  <CustomerServiceOutlined style={{ fontSize: 34, color: theme.palette.text.disabled }} />
                  <Typography variant="h6" sx={{ mt: 2 }}>Select a ticket</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Choose a ticket to see its conversation.</Typography>
                </Stack>
              ) : detailLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, minHeight: 500 }}><CircularProgress size={30} /></Stack>
              ) : ticket ? (
                <>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      {mobile && (
                        <IconButton size="small" onClick={() => { setSelectedId(null); setTicket(null); }} aria-label="Back to tickets"><ArrowLeftOutlined /></IconButton>
                      )}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
                          <Typography variant="h6" sx={{ fontWeight: 750 }}>{capitalizeFirstLetter(ticket.subject)}</Typography>
                          <Stack direction="row" spacing={0.75}>
                            <Chip size="small" label={categoryLabel(ticket.subType)} variant="outlined" />
                            <Chip size="small" label={ticket.isResolved ? 'Closed' : 'Open'} color={ticket.isResolved ? 'default' : 'success'} />
                          </Stack>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {ticket.ticketNumber} · Created {formatRelativeTime(ticket.createdAt)}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ flex: 1, minHeight: 330, maxHeight: 500, overflowY: 'auto', bgcolor: 'grey.50', p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2.25}>
                      {(ticket.messages || []).map((message) => <MessageBubble key={message.id} message={message} />)}
                      <div ref={threadEndRef} />
                    </Stack>
                  </Box>

                  <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                    {ticket.isResolved && (
                      <Alert severity="info" sx={{ mb: 1.5 }}>This ticket is closed. Sending a reply will reopen it automatically.</Alert>
                    )}
                    <TextField
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Reply to Property Peace Support…"
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={6}
                      inputProps={{ maxLength: 5000 }}
                      onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') handleReply();
                      }}
                    />
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.25 }}>
                      <Button
                        size="small"
                        color={ticket.isResolved ? 'primary' : 'inherit'}
                        startIcon={ticket.isResolved ? <ReloadOutlined /> : <CheckCircleOutlined />}
                        onClick={handleStatus}
                        disabled={statusUpdating}
                      >
                        {ticket.isResolved ? 'Reopen ticket' : 'Close ticket'}
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={replying ? <CircularProgress size={15} color="inherit" /> : <SendOutlined />}
                        disabled={replying || !reply.trim()}
                        onClick={handleReply}
                      >
                        Send reply
                      </Button>
                    </Stack>
                  </Box>
                </>
              ) : null}
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 750 }}>New support ticket</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>We will keep all follow-up replies in this conversation.</Typography>
            </Box>
            <IconButton onClick={() => setCreateOpen(false)} disabled={creating} aria-label="Close"><CloseCircleOutlined /></IconButton>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 0.5 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>What can we help with?</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                {CATEGORIES.map((category) => {
                  const selected = form.type === category.value;
                  return (
                    <Paper
                      key={category.value}
                      component="button"
                      type="button"
                      variant="outlined"
                      onClick={() => setForm((current) => ({ ...current, type: category.value }))}
                      sx={(currentTheme) => ({
                        p: 1.5,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: selected ? alpha(currentTheme.palette.primary.main, 0.055) : 'background.paper',
                        color: 'inherit',
                        '&:hover': { borderColor: 'primary.main' }
                      })}
                    >
                      <Typography variant="subtitle2" color={selected ? 'primary.main' : 'text.primary'}>{category.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{category.helper}</Typography>
                    </Paper>
                  );
                })}
              </Box>
            </Box>
            <TextField
              label="Subject"
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              fullWidth
              required
              inputProps={{ maxLength: 500 }}
              placeholder="A short summary of what you need"
            />
            <TextField
              label="Message"
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              fullWidth
              required
              multiline
              rows={6}
              inputProps={{ maxLength: 5000 }}
              placeholder="Share the details our support team should know…"
              helperText={`${form.message.length}/5,000`}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating || !form.subject.trim() || !form.message.trim()}
            startIcon={creating ? <CircularProgress size={15} color="inherit" /> : <PlusOutlined />}
          >
            Create ticket
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
