import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import DownOutlined from '@ant-design/icons/DownOutlined';
import HistoryOutlined from '@ant-design/icons/HistoryOutlined';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';

import {
  getConversationTimeline,
  getTimelineUnread,
  listFollowUps,
  createFollowUp,
  completeFollowUp,
  markTimelineRead,
  searchConversationTimeline
} from 'api/conversationTimeline';
import {
  getTimelineEntryPresentation,
  buildFollowUpRequest,
  mergeTimelinePages,
  normalizeFollowUps,
  selectReadThroughSequence
} from 'utils/conversationTimeline';
import { createClientRequestId } from 'utils/clientRequestId';

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'inApp', label: 'In-app' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' }
];

function formatActivityTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function TimelineEntry({ entry, canCreateFollowUp, onCreateFollowUp }) {
  const item = getTimelineEntryPresentation(entry);
  if (!item) return null;
  return (
    <Box
      role="listitem"
      sx={{
        position: 'relative',
        width: '100%',
        minWidth: 0,
        pl: 3,
        pb: 2,
        '&:last-of-type': { pb: 0 },
        '&:last-of-type .timeline-connector': { display: 'none' }
      }}
    >
      <Box
        className="timeline-connector"
        aria-hidden="true"
        sx={{ position: 'absolute', left: 5, top: 8, bottom: -8, width: '1px', bgcolor: 'divider' }}
      />
      <Box
        aria-hidden="true"
        sx={{ position: 'absolute', left: 1, top: 4, width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main' }}
      />
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
        <Typography variant="subtitle2" fontWeight={700}>{item.kindLabel}</Typography>
        {item.channelLabel && <Chip size="small" variant="outlined" label={item.channelLabel} sx={{ height: 21 }} />}
        {item.direction && <Chip size="small" label={item.direction === 'inbound' ? 'Received' : 'Sent'} sx={{ height: 21, textTransform: 'capitalize' }} />}
        <Typography variant="caption" color="text.secondary">{formatActivityTime(item.occurredAt)}</Typography>
      </Stack>
      <Typography variant="body2" sx={{ mt: 0.5, minWidth: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{item.summary}</Typography>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
        {item.context && (
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={item.context.label}
            title={`${item.context.kind} context`}
            sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
          />
        )}
        {item.deliveries.map((delivery, index) => (
          <Chip
            key={`${delivery.label}-${index}`}
            size="small"
            color={delivery.tone === 'default' ? undefined : delivery.tone}
            variant="outlined"
            label={delivery.detail ? `${delivery.label} · ${delivery.detail}` : delivery.label}
            sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
          />
        ))}
        {item.visibilityLabel === 'Staff only' && <Chip size="small" color="warning" variant="outlined" label="Staff only" />}
        {canCreateFollowUp && item.context && (
          <Button size="small" startIcon={<PlusOutlined />} onClick={() => onCreateFollowUp(entry)}>Create follow-up</Button>
        )}
      </Stack>
    </Box>
  );
}

export default function ConversationTimelinePanel({
  conversationId = null,
  contextKind = null,
  contextId = null,
  organizationId = null,
  currentUserId = null,
  title = 'Communication activity',
  defaultExpanded = false
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [followUps, setFollowUps] = useState([]);
  const [followUpEntry, setFollowUpEntry] = useState(null);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDue, setFollowUpDue] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpError, setFollowUpError] = useState('');
  const [completingId, setCompletingId] = useState(null);
  const requestId = useRef(0);
  const followUpKey = useRef(null);
  const canManageFollowUps = Number(organizationId) > 0 && Number(currentUserId) > 0 && Number(conversationId) > 0;
  const loadMoreLabel = contextKind === 'maintenance' ? 'Load more history' : 'Load more activity';

  const loadFollowUps = useCallback(async () => {
    if (!canManageFollowUps) return;
    setFollowUpLoading(true); setFollowUpError('');
    try {
      const payload = await listFollowUps(Number(organizationId), Number(conversationId));
      setFollowUps(normalizeFollowUps(payload, { organizationId, conversationId }));
    } catch (requestError) {
      const status = requestError?.response?.status;
      setFollowUpError(status === 401 ? 'Sign in again to view follow-up tasks.' : status === 403
        ? 'You are not authorized to manage follow-up tasks.' : 'Open follow-up tasks could not be loaded.');
    } finally { setFollowUpLoading(false); }
  }, [canManageFollowUps, conversationId, organizationId]);

  const load = useCallback(async ({ cursor = null, append = false, search = '', selectedChannel = '' } = {}) => {
    const validConversationId = Number.isSafeInteger(Number(conversationId)) && Number(conversationId) > 0;
    const validContextId = Number.isSafeInteger(Number(contextId)) && Number(contextId) > 0;
    if (!validConversationId && !(contextKind && validContextId)) return;
    const currentRequest = ++requestId.current;
    append ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const searchTake = 100;
      const searchSkip = append && Number.isSafeInteger(Number(cursor)) ? Number(cursor) : 0;
      const isContextSearch = Boolean(search || selectedChannel || (contextKind && validContextId));
      const page = isContextSearch
        ? await searchConversationTimeline({
            query: search,
            conversationId: validConversationId ? Number(conversationId) : undefined,
            contextKind: contextKind || undefined,
            contextId: validContextId ? Number(contextId) : undefined,
            channel: selectedChannel || undefined,
            skip: searchSkip,
            take: searchTake
          })
        : await getConversationTimeline(Number(conversationId), { afterSequence: cursor, take: 50 });
      if (currentRequest !== requestId.current) return;
      if (!page) throw new Error('Timeline response did not match the expected contract.');
      setItems((current) => append ? mergeTimelinePages(current, page.items) : page.items);
      setNextCursor(isContextSearch
        ? (page.items.length === searchTake ? searchSkip + searchTake : null)
        : page.nextCursor);
    } catch (_) {
      if (currentRequest === requestId.current) setError(`${title} could not be loaded. Try again.`);
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [contextId, contextKind, conversationId, title]);

  useEffect(() => {
    requestId.current += 1;
    setItems([]);
    setNextCursor(null);
    setQuery('');
    setChannel('');
    setUnreadCount(0);
    setError('');
    if (!conversationId) return;
    getTimelineUnread(Number(conversationId)).then((state) => setUnreadCount(state?.unreadCount || 0)).catch(() => {});
  }, [contextId, contextKind, conversationId, expanded, load]);

  useEffect(() => {
    if (!expanded || (!conversationId && !(contextKind && contextId))) return undefined;
    const timer = window.setTimeout(() => load({ search: query.trim(), selectedChannel: channel }), 350);
    return () => window.clearTimeout(timer);
  }, [channel, contextId, contextKind, conversationId, expanded, load, query]);

  const readThrough = useMemo(() => selectReadThroughSequence(items), [items]);
  useEffect(() => {
    if (!expanded || !readThrough || !conversationId) return;
    markTimelineRead(Number(conversationId), readThrough)
      .then((state) => setUnreadCount(state?.unreadCount || 0))
      .catch(() => {}); // A failed watermark must never hide readable activity.
  }, [conversationId, expanded, readThrough]);

  useEffect(() => {
    setFollowUps([]); setFollowUpEntry(null); setFollowUpError(''); followUpKey.current = null;
    if (expanded && canManageFollowUps) loadFollowUps();
  }, [canManageFollowUps, conversationId, expanded, loadFollowUps]);

  const beginFollowUp = (entry) => {
    setFollowUpEntry(entry);
    setFollowUpTitle(`Follow up: ${entry.summary}`.slice(0, 200));
    const due = new Date(Date.now() + 24 * 60 * 60 * 1000);
    due.setMinutes(due.getMinutes() - due.getTimezoneOffset());
    setFollowUpDue(due.toISOString().slice(0, 16));
    setFollowUpError('');
    followUpKey.current = createClientRequestId();
  };

  const saveFollowUp = async () => {
    const request = buildFollowUpRequest({ organizationId, conversationId, entry: followUpEntry,
      assigneeUserId: currentUserId, title: followUpTitle, dueAtUtc: followUpDue, idempotencyKey: followUpKey.current });
    if (!request) { setFollowUpError('Enter a title and valid due date for a contextual timeline entry.'); return; }
    setFollowUpLoading(true); setFollowUpError('');
    try {
      await createFollowUp(request);
      setFollowUpEntry(null); followUpKey.current = null;
      await loadFollowUps();
    } catch (requestError) {
      setFollowUpError(requestError?.response?.status === 409
        ? 'This follow-up changed or was already created. Refresh the tasks before trying again.'
        : requestError?.response?.data?.message || 'The follow-up could not be created.');
    } finally { setFollowUpLoading(false); }
  };

  const finishFollowUp = async (task) => {
    setCompletingId(task.id); setFollowUpError('');
    try {
      await completeFollowUp(task.id, task.rowVersion);
      await loadFollowUps();
    } catch (requestError) {
      setFollowUpError(requestError?.response?.status === 409
        ? 'This task was changed by someone else. The open-task list has been refreshed.'
        : requestError?.response?.data?.message || 'The follow-up could not be completed.');
      if (requestError?.response?.status === 409) await loadFollowUps();
    } finally { setCompletingId(null); }
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, next) => setExpanded(next)}
      disableGutters
      elevation={0}
      sx={{ width: '100%', minWidth: 0, flexShrink: 0, overflow: 'hidden', borderBottom: 1, borderColor: 'divider', '&::before': { display: 'none' } }}
    >
      <AccordionSummary
        expandIcon={<DownOutlined />}
        aria-controls="communication-timeline-content"
        id="communication-timeline-heading"
        sx={{
          minHeight: 48,
          px: { xs: 1.5, sm: 2 },
          flexDirection: 'row',
          '&.Mui-expanded': { minHeight: 48 },
          '& .MuiAccordionSummary-content, & .MuiAccordionSummary-content.Mui-expanded': { minWidth: 0, my: 0, ml: 0 },
          '& .MuiAccordionSummary-expandIconWrapper': {
            flexShrink: 0,
            ml: 'auto',
            color: 'text.secondary',
            '&.Mui-expanded': { transform: 'rotate(180deg)' }
          }
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <HistoryOutlined />
          <Typography variant="subtitle2" fontWeight={700} noWrap>{title}</Typography>
          {unreadCount > 0 && <Chip size="small" color="primary" label={`${unreadCount} unread`} />}
        </Stack>
      </AccordionSummary>
      <AccordionDetails
        id="communication-timeline-content"
        sx={{
          minWidth: 0,
          maxHeight: { xs: 'min(55dvh, 420px)', md: 300 },
          overflowY: 'auto',
          overflowX: 'hidden',
          px: { xs: 1.5, sm: 2 },
          pt: 1.5,
          pb: 2,
          bgcolor: 'background.default',
          scrollbarGutter: 'stable',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 4 }
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: 0 }}>
            <TextField
              fullWidth
              size="small"
              label="Search activity"
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 200))}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
              sx={{ minWidth: 0 }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 145 }, width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}>
              <InputLabel id="timeline-channel-label">Channel</InputLabel>
              <Select labelId="timeline-channel-label" label="Channel" value={channel} onChange={(event) => setChannel(event.target.value)}>
                {CHANNEL_OPTIONS.map((option) => <MenuItem key={option.value || 'all'} value={option.value}>{option.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          {canManageFollowUps && (
            <Box sx={{ minWidth: 0, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Open follow-up tasks</Typography>
                <Button size="small" onClick={loadFollowUps} disabled={followUpLoading}>Refresh</Button>
              </Stack>
              {followUpError && <Alert severity="error" sx={{ mb: 1 }}>{followUpError}</Alert>}
              {followUpEntry && (
                <Stack spacing={1} sx={{ mb: 1.5 }}>
                  <Alert severity="info">Creating a task from: {followUpEntry.summary}</Alert>
                  <TextField size="small" label="Task title" value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value.slice(0, 200))} />
                  <TextField size="small" label="Due date" type="datetime-local" value={followUpDue} onChange={(event) => setFollowUpDue(event.target.value)} InputLabelProps={{ shrink: true }} />
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" size="small" onClick={saveFollowUp} disabled={followUpLoading}>{followUpLoading ? 'Creating…' : 'Create task'}</Button>
                    <Button size="small" onClick={() => { setFollowUpEntry(null); followUpKey.current = null; }}>Cancel</Button>
                  </Stack>
                </Stack>
              )}
              {followUpLoading && !followUpEntry ? <Stack direction="row" spacing={1}><CircularProgress size={18} /><Typography variant="body2">Loading open tasks…</Typography></Stack>
                : followUps.length === 0 ? <Typography variant="body2" color="text.secondary">No open follow-up tasks.</Typography>
                : <List dense disablePadding>{followUps.map((task) => <ListItem key={task.id} disableGutters secondaryAction={
                  <Button size="small" startIcon={completingId === task.id ? <CircularProgress size={14} /> : <CheckOutlined />} disabled={completingId != null} onClick={() => finishFollowUp(task)}>Complete</Button>
                }><ListItemText primary={task.title} secondary={`Due ${formatActivityTime(task.dueAtUtc)}`} /></ListItem>)}</List>}
            </Box>
          )}

          <Box aria-live="polite" sx={{ minWidth: 0 }}>
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 3 }}><CircularProgress size={20} /><Typography variant="body2">Loading activity…</Typography></Stack>
            ) : error ? (
              <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => load({ search: query.trim(), selectedChannel: channel })}>Retry</Button>}>{error}</Alert>
            ) : items.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>{query || channel ? 'No activity matches these filters.' : `No ${title.toLowerCase()} yet.`}</Typography>
            ) : (
              <Box
                role="list"
                sx={{
                  width: '100%',
                  minWidth: 0,
                  m: 0,
                  p: 0,
                  overflowX: 'hidden'
                }}
              >
                {items.map((entry) => <TimelineEntry key={entry.id} entry={entry} canCreateFollowUp={canManageFollowUps} onCreateFollowUp={beginFollowUp} />)}
              </Box>
            )}
          </Box>

          {nextCursor && !query && !channel && (
            <Button variant="outlined" size="small" disabled={loadingMore} onClick={() => load({ cursor: nextCursor, append: true })}>
              {loadingMore ? 'Loading…' : loadMoreLabel}
            </Button>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
