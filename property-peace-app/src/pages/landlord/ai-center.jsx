import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputBase,
  Stack,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import {
  ApiOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseOutlined,
  DatabaseOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  MenuOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  SyncOutlined,
  ToolOutlined
} from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useOrganizationSummary from 'hooks/useOrganizationSummary';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import { aiFollowUpAPI } from 'api';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';
import { mapPercySource } from 'utils/percySources';
import { createPercyChatRequestAttempt } from 'utils/percyChatRequestAttempt';
import {
  createAICenterScopeGuard,
  getAICenterReadinessMarker,
  getCurrentOrganizationId,
  isAICenterRuntimeReady,
  isAICenterScopeEligible,
  makeAICenterScope
} from 'utils/aiCenterScope';

const NAVY = '#061e35';
const GREEN = '#16a34a';
const STARTER_PROMPTS = [
  { label: 'Rent at risk', prompt: 'Which tenants are behind on rent?', icon: <DollarCircleOutlined /> },
  { label: 'Urgent maintenance', prompt: 'Summarize urgent maintenance.', icon: <ToolOutlined /> },
  { label: 'Lease expirations', prompt: 'Show leases expiring in the next 60 days.', icon: <ClockCircleOutlined /> },
  { label: 'Portfolio pulse', prompt: 'Give me a quick portfolio summary.', icon: <DatabaseOutlined /> }
];

const readField = (value, ...keys) => {
  for (const key of keys) {
    if (value?.[key] !== undefined && value?.[key] !== null) return value[key];
  }
  return undefined;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const unwrapData = (response) => readField(response, 'data', 'Data') ?? response;

const mapConfirmation = (value) => {
  if (!value) return null;
  return {
    id: readField(value, 'id', 'Id'),
    actionLabel: readField(value, 'actionLabel', 'ActionLabel') || 'Percy action',
    prompt: readField(value, 'prompt', 'Prompt') || 'Please confirm this action.',
    status: readField(value, 'status', 'Status') || 'Pending',
    expiresAt: readField(value, 'expiresAt', 'ExpiresAt')
  };
};

const mapMessage = (value) => {
  const activityLabel = readField(value, 'activityLabel', 'ActivityLabel');
  const activityStatus = readField(value, 'activityStatus', 'ActivityStatus');
  return {
    id: readField(value, 'id', 'Id') || `${readField(value, 'role', 'Role')}-${Date.now()}-${Math.random()}`,
    role: String(readField(value, 'role', 'Role') || 'assistant').toLowerCase(),
    content: readField(value, 'content', 'Content') || '',
    createdAt: readField(value, 'createdAt', 'CreatedAt'),
    tool: activityLabel && activityStatus
      ? { label: activityLabel, status: activityStatus }
      : null,
    metrics: asArray(readField(value, 'metrics', 'Metrics')).map((metric) => ({
      label: readField(metric, 'label', 'Label'),
      value: readField(metric, 'value', 'Value'),
      money: Boolean(readField(metric, 'money', 'Money'))
    })),
    items: asArray(readField(value, 'items', 'Items')).map((item) => ({
      title: readField(item, 'title', 'Title'),
      detail: readField(item, 'detail', 'Detail'),
      value: readField(item, 'value', 'Value')
    })),
    sources: asArray(readField(value, 'sources', 'Sources')).map(mapPercySource),
    pendingConfirmation: mapConfirmation(readField(value, 'pendingConfirmation', 'PendingConfirmation'))
  };
};

const mapChatResponse = (value) =>
  mapMessage({
    id: readField(value, 'assistantMessageId', 'AssistantMessageId'),
    role: 'assistant',
    content: readField(value, 'content', 'Content'),
    activityLabel: readField(value, 'activityLabel', 'ActivityLabel'),
    activityStatus: readField(value, 'activityStatus', 'ActivityStatus'),
    metrics: readField(value, 'metrics', 'Metrics'),
    items: readField(value, 'items', 'Items'),
    sources: readField(value, 'sources', 'Sources'),
    pendingConfirmation: readField(value, 'pendingConfirmation', 'PendingConfirmation')
  });

const errorMessage = (error, fallback) =>
  readField(error, 'message', 'Message') || readField(error?.response?.data, 'message', 'Message') || fallback;

function ToolStatus({ tool }) {
  return (
    <Box sx={{ mt: 1.5, px: 1.25, py: 1, borderRadius: 1.75, bgcolor: alpha(NAVY, 0.035), border: `1px solid ${alpha(NAVY, 0.08)}` }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{ width: 28, height: 28, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: alpha(GREEN, 0.1), color: GREEN }}
        >
          <ApiOutlined />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" fontWeight={800} sx={{ display: 'block', color: NAVY }}>
            {tool.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {tool.status}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function SourceLinks({ sources }) {
  if (!sources?.length) return null;
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mt: 1.25 }}>
      <Typography variant="caption" color="text.secondary">Sources</Typography>
      {sources.map((source, index) => {
        const label = source.label || 'Property Peace data';
        const key = `${source.kind}-${source.workflowRoute || 'unlinked'}-${index}`;
        return source.workflowRoute ? (
          <Chip key={key} size="small" component={Link} clickable to={source.workflowRoute} label={label}
            icon={<DatabaseOutlined />} sx={{ textDecoration: 'none' }} />
        ) : <Chip key={key} size="small" label={label} icon={<DatabaseOutlined />} />;
      })}
    </Stack>
  );
}

function AssistantMessage({ message, onResolveConfirmation, confirmationLoading, confirmationError }) {
  const confirmation = message.pendingConfirmation;
  const confirmationPending = confirmation && String(confirmation.status).toLowerCase() === 'pending';
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ width: '100%' }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 1.25,
          display: 'grid',
          placeItems: 'center',
          bgcolor: NAVY,
          color: '#fff'
        }}
      >
        <RobotOutlined />
      </Box>
      <Box sx={{ minWidth: 0, maxWidth: 760, flex: 1 }}>
        <Typography variant="body1" sx={{ color: NAVY, lineHeight: 1.75 }}>
          {message.content}
        </Typography>

        {message.tool && <ToolStatus tool={message.tool} />}
        <SourceLinks sources={message.sources} />

        {message.metrics?.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: `repeat(${Math.min(message.metrics.length, 4)}, minmax(0, 1fr))`
              },
              gap: 1,
              mt: 1.5
            }}
          >
            {message.metrics.map((metric) => (
              <Box key={metric.label} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${alpha(NAVY, 0.09)}`, bgcolor: '#fff' }}>
                <Typography variant="caption" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: NAVY, mt: 0.2 }}>
                  {metric.money
                    ? Number(metric.value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                    : metric.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {message.items?.length > 0 && (
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {message.items.map((item, index) => (
              <Stack
                key={`${item.title}-${index}`}
                direction="row"
                justifyContent="space-between"
                spacing={2}
                sx={{ px: 1.25, py: 1, borderRadius: 1.5, border: `1px solid ${alpha(NAVY, 0.08)}`, bgcolor: '#fff' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={750} noWrap>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {item.detail}
                  </Typography>
                </Box>
                {item.value !== undefined && (
                  <Typography variant="body2" fontWeight={750} sx={{ flexShrink: 0, color: NAVY }}>
                    {typeof item.value === 'number'
                      ? item.value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                      : item.value}
                  </Typography>
                )}
              </Stack>
            ))}
          </Stack>
        )}

        {confirmation && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, border: `1px solid ${alpha('#d97706', 0.25)}`, bgcolor: alpha('#d97706', 0.045) }}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
              <Typography variant="subtitle2" fontWeight={800}>
                {confirmation.actionLabel}
              </Typography>
              <Chip size="small" label={confirmation.status} color={confirmationPending ? 'warning' : 'default'} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, mb: 1.25 }}>
              {confirmation.prompt}
            </Typography>
            {confirmation.expiresAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
                Expires {new Date(confirmation.expiresAt).toLocaleString()}
              </Typography>
            )}
            {confirmationError && (
              <Alert severity="error" sx={{ mb: 1.25 }}>
                {confirmationError}
              </Alert>
            )}
            {confirmationPending && (
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={confirmationLoading}
                  onClick={() => onResolveConfirmation(message.id, confirmation.id, true)}
                  startIcon={confirmationLoading ? <SyncOutlined spin /> : <CheckCircleFilled />}
                  sx={{ boxShadow: 'none' }}
                >
                  Confirm
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={confirmationLoading}
                  onClick={() => onResolveConfirmation(message.id, confirmation.id, false)}
                >
                  Cancel
                </Button>
              </Stack>
            )}
          </Box>
        )}
      </Box>
    </Stack>
  );
}

function UserMessage({ message }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
      <Box sx={{ maxWidth: 680, px: 1.75, py: 1.15, borderRadius: '18px 18px 4px 18px', bgcolor: alpha(NAVY, 0.075), color: NAVY }}>
        <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
          {message.content}
        </Typography>
      </Box>
    </Box>
  );
}

function ConnectionRow({ icon, title, detail, active = false }) {
  return (
    <Stack direction="row" spacing={1.1} alignItems="center" sx={{ py: 1 }}>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: 1.25,
          display: 'grid',
          placeItems: 'center',
          bgcolor: active ? alpha(GREEN, 0.09) : alpha(NAVY, 0.05),
          color: active ? GREEN : NAVY
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={750}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {detail}
        </Typography>
      </Box>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: active ? GREEN : 'text.disabled' }} />
    </Stack>
  );
}

export default function AICenter() {
  const theme = useTheme();

  const messageEndRef = useRef(null);
  const selectionVersionRef = useRef(0);
  const scopeGuardRef = useRef(createAICenterScopeGuard());
  const progressTimerRef = useRef(null);
  const streamAbortRef = useRef(null);
  const chatRequestAttemptRef = useRef(createPercyChatRequestAttempt());
  const { user } = useAuth();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const userId = user?.id ?? user?.Id ?? user?.email ?? user?.Email ?? null;
  const organizationId = getCurrentOrganizationId(currentOrganization);
  const aiScopeEligible = isAICenterScopeEligible({ userId, currentOrganization, organizationLoading });
  const aiScope = useMemo(() => makeAICenterScope({ userId, organizationId }), [organizationId, userId]);
  // Synchronize during render so same-organization loading transitions close
  // currentness immediately, rather than waiting for effect cleanup.
  const aiRuntime = scopeGuardRef.current.synchronize(aiScope, aiScopeEligible);
  const currentScopeRef = useRef(aiRuntime);
  currentScopeRef.current = aiRuntime;
  const { data: summary, loading: summaryLoading, error: summaryError } = useOrganizationSummary();
  const { presentation: percyReadiness } = useFeatureReadiness(FEATURE_KEYS.percy);
  const readinessMarker = getAICenterReadinessMarker(percyReadiness);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [progressText, setProgressText] = useState('Understanding your request');
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState('');
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [confirmationLoading, setConfirmationLoading] = useState({});
  const [confirmationErrors, setConfirmationErrors] = useState({});
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [stateScopeGeneration, setStateScopeGeneration] = useState(null);
  const aiRuntimeReady = isAICenterRuntimeReady({ runtime: aiRuntime, stateGeneration: stateScopeGeneration });

  const sortConversations = (items) =>
    [...items].sort(
      (a, b) => new Date(readField(b, 'updatedAt', 'UpdatedAt') || 0) - new Date(readField(a, 'updatedAt', 'UpdatedAt') || 0)
    );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const handleSelectConversation = async (id) => {
    if (!aiScopeEligible) return;
    const scopeRequest = scopeGuardRef.current.capture(aiScope);
    chatRequestAttemptRef.current.contextChanged({ conversationId: id, scopeKey: aiScope.scopeKey });
    streamAbortRef.current?.abort();
    const version = ++selectionVersionRef.current;
    clearTimeout(progressTimerRef.current);
    setSelectedConversationId(id);
    setMessages([]);
    setInput('');
    setThinking(false);
    setConversationLoading(true);
    setConversationError('');
    try {
      const response = unwrapData(await aiFollowUpAPI.getConversation(id));
      if (selectionVersionRef.current !== version || !scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) return;
      setMessages(asArray(readField(response, 'messages', 'Messages')).map(mapMessage));
    } catch (error) {
      if (selectionVersionRef.current !== version || !scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) return;
      setConversationError(errorMessage(error, 'Could not load this conversation. Please try again.'));
    } finally {
      if (selectionVersionRef.current === version && scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) {
        setConversationLoading(false);
      }
    }
  };

  useEffect(() => {
    const scopeRequest = scopeGuardRef.current.beginScope(aiScope, aiScopeEligible);
    const isCurrentScope = () => scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current);
    chatRequestAttemptRef.current.contextChanged({ conversationId: null, scopeKey: aiScope.scopeKey });

    selectionVersionRef.current += 1;
    streamAbortRef.current?.abort();
    clearTimeout(progressTimerRef.current);
    setMessages([]);
    setInput('');
    setThinking(false);
    setProgressText('Understanding your request');
    setConversations([]);
    setSelectedConversationId(null);
    setConversationsLoading(true);
    setConversationsError('');
    setConversationLoading(false);
    setConversationError('');
    setConfirmationLoading({});
    setConfirmationErrors({});
    setMobilePanelOpen(false);
    setStateScopeGeneration(scopeRequest.generation);

    const disposeScope = () => {
      // Invalidate first: aborts and timer cleanup are not sufficient when an adapter ignores cancellation.
      scopeGuardRef.current.dispose();
      selectionVersionRef.current += 1;
      streamAbortRef.current?.abort();
      clearTimeout(progressTimerRef.current);
    };

    if (!aiScopeEligible) {
      setConversationsLoading(false);
      return disposeScope;
    }

    const loadConversations = async () => {
      try {
        const response = unwrapData(await aiFollowUpAPI.getConversations());
        if (!isCurrentScope()) return;
        const loaded = sortConversations(asArray(response));
        setConversations(loaded);
        if (loaded.length > 0) handleSelectConversation(readField(loaded[0], 'id', 'Id'));
      } catch (error) {
        if (isCurrentScope()) setConversationsError(errorMessage(error, 'Could not load your Percy conversations.'));
      } finally {
        if (isCurrentScope()) setConversationsLoading(false);
      }
    };
    loadConversations();
    return disposeScope;
    // Initial durable conversation load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiScope.scopeKey, aiScopeEligible]);

  const handleNewChat = () => {
    if (!aiRuntimeReady) return;
    chatRequestAttemptRef.current.contextChanged({ conversationId: null, scopeKey: aiScope.scopeKey });
    streamAbortRef.current?.abort();
    selectionVersionRef.current += 1;
    clearTimeout(progressTimerRef.current);
    setSelectedConversationId(null);
    setMessages([]);
    setInput('');
    setThinking(false);
    setConversationLoading(false);
    setConversationError('');
  };

  const handleSend = async (value = input) => {
    if (!aiRuntimeReady || !percyReadiness.canInvoke) return;
    const prompt = value.trim();
    if (!prompt || thinking || conversationLoading) return;

    const scopeRequest = scopeGuardRef.current.capture(aiScope);
    const version = selectionVersionRef.current;
    const conversationId = selectedConversationId;
    const requestAttempt = chatRequestAttemptRef.current.begin({
      message: prompt,
      conversationId,
      scopeKey: aiScope.scopeKey
    });
    const optimisticId = `user-${Date.now()}`;
    const assistantPlaceholderId = `assistant-stream-${Date.now()}`;
    const controller = new AbortController();
    streamAbortRef.current = controller;

    setMessages((current) => [
      ...current,
      { id: optimisticId, role: 'user', content: prompt },
      { id: assistantPlaceholderId, role: 'assistant', content: '' }
    ]);
    setInput('');
    setThinking(true);
    setProgressText('Understanding your request');

    let completedResponse = null;
    try {
      await aiFollowUpAPI.streamChat(prompt, conversationId, requestAttempt.clientRequestId, {
        signal: controller.signal,
        onEvent: (event) => {
          if (selectionVersionRef.current !== version || !scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) return;
          if (event.type === 'status') {
            setProgressText(event.message || 'Checking Property Peace data');
            return;
          }
          if (event.type === 'content.delta') {
            setProgressText('Percy is responding');
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantPlaceholderId
                  ? { ...message, content: `${message.content || ''}${event.delta || ''}` }
                  : message
              )
            );
            return;
          }
          if (event.type === 'completed') {
            completedResponse = event.response;
            return;
          }
          if (event.type === 'error') throw new Error(event.message || 'Percy could not complete this request.');
        }
      });

      if (
        selectionVersionRef.current !== version
        || !scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)
      ) return;
      if (!completedResponse) throw new Error('Percy could not complete this request. Please try again.');
      const response = completedResponse;
      chatRequestAttemptRef.current.succeed(requestAttempt);
      const serverConversationId = readField(response, 'conversationId', 'ConversationId');
      const title = readField(response, 'conversationTitle', 'ConversationTitle') || prompt;
      const userMessageId = readField(response, 'userMessageId', 'UserMessageId');
      setSelectedConversationId(serverConversationId);
      setMessages((current) =>
        current.map((message) => {
          if (message.id === optimisticId) return { ...message, id: userMessageId || message.id };
          if (message.id === assistantPlaceholderId) return mapChatResponse(response);
          return message;
        })
      );
      setConversations((current) => {
        const existing = current.find((item) => readField(item, 'id', 'Id') === serverConversationId) || {};
        const next = {
          ...existing,
          id: serverConversationId,
          title,
          updatedAt: new Date().toISOString(),
          lastMessagePreview: readField(response, 'content', 'Content') || prompt
        };
        return sortConversations([next, ...current.filter((item) => readField(item, 'id', 'Id') !== serverConversationId)]);
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      chatRequestAttemptRef.current.fail(requestAttempt);
      if (selectionVersionRef.current === version && scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) {
        setInput(prompt);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantPlaceholderId
              ? {
                  ...message,
                  id: `assistant-error-${Date.now()}`,
                  content: errorMessage(error, 'I could not access your Property Peace data for that request. Please try again.')
                }
              : message
          )
        );
      }
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      clearTimeout(progressTimerRef.current);
      if (selectionVersionRef.current === version && scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) {
        setThinking(false);
      }
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };


  const handleResolveConfirmation = async (messageId, confirmationId, confirm) => {
    if (!aiRuntimeReady) return;
    const scopeRequest = scopeGuardRef.current.capture(aiScope);
    setConfirmationLoading((current) => ({ ...current, [confirmationId]: true }));
    setConfirmationErrors((current) => ({ ...current, [confirmationId]: '' }));
    try {
      const response = unwrapData(
        await (confirm ? aiFollowUpAPI.confirmAction(confirmationId) : aiFollowUpAPI.declineAction(confirmationId))
      );
      if (!scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) return;
      const status = readField(response, 'status', 'Status') || (confirm ? 'Completed' : 'Declined');
      const resultMessage = readField(response, 'message', 'Message');
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                content: resultMessage || message.content,
                pendingConfirmation: { ...message.pendingConfirmation, status }
              }
            : message
        )
      );
    } catch (error) {
      if (!scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) return;
      setConfirmationErrors((current) => ({
        ...current,
        [confirmationId]: errorMessage(error, `Could not ${confirm ? 'confirm' : 'cancel'} this action. Please try again.`)
      }));
    } finally {
      if (scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) {
        setConfirmationLoading((current) => ({ ...current, [confirmationId]: false }));
      }
    }
  };

  const dataReady = !summaryLoading && !summaryError;
  const contextCounts = {
    properties: asArray(readField(summary, 'properties', 'Properties')).length,
    tenants: asArray(readField(summary, 'tenants', 'Tenants')).length
  };

  // Never render retained state while the scope is ineligible or while a fresh
  // runtime generation is waiting for its reset/reload effect.
  if (!aiRuntimeReady) return null;

  return (
    <Box>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Percy' }]} />
      <FeatureReadinessNotice presentation={percyReadiness} featureName="Percy" />

      <Box
        sx={{
          height: { xs: 'calc(100dvh - 122px)', md: 'calc(100dvh - 136px)' },
          minHeight: { xs: 620, lg: 700 },
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 3,
          border: `1px solid ${alpha(NAVY, 0.11)}`,
          bgcolor: '#fff',
          boxShadow: `0 18px 45px ${alpha(NAVY, 0.07)}`
        }}
      >
        <Box
          sx={{
            width: 236,
            flexShrink: 0,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            bgcolor: alpha(NAVY, 0.025),
            borderRight: `1px solid ${alpha(NAVY, 0.08)}`
          }}
        >
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 1.4, display: 'grid', placeItems: 'center', bgcolor: NAVY, color: '#fff' }}>
                <RobotOutlined />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={850} sx={{ color: NAVY, lineHeight: 1.1 }}>
                  Percy
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Property copilot
                </Typography>
              </Box>
            </Stack>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PlusOutlined />}
              onClick={handleNewChat}
              sx={{
                justifyContent: 'flex-start',
                borderColor: alpha(NAVY, 0.18),
                color: NAVY,
                bgcolor: '#fff',
                textTransform: 'none',
                fontWeight: 750
              }}
            >
              New conversation
            </Button>
          </Box>

          <Box sx={{ px: 1.25, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1, fontWeight: 800, letterSpacing: 0.8 }}>
              Conversations
            </Typography>
            {conversationsLoading && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.1, py: 1.5 }}>
                <CircularProgress size={15} />
                <Typography variant="caption" color="text.secondary">
                  Loading conversations…
                </Typography>
              </Stack>
            )}
            {!conversationsLoading && conversationsError && (
              <Alert severity="error" sx={{ mt: 0.5, py: 0 }}>
                {conversationsError}
              </Alert>
            )}
            {!conversationsLoading && !conversationsError && conversations.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.1, py: 1.5 }}>
                No saved conversations yet.
              </Typography>
            )}
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {conversations.map((conversation) => {
                const id = readField(conversation, 'id', 'Id');
                const selected = id === selectedConversationId;
                return (
                  <Box
                    key={id}
                    component="button"
                    type="button"
                    onClick={() => handleSelectConversation(id)}
                    sx={{
                      width: '100%',
                      border: 0,
                      mt: 0,
                      px: 1.1,
                      py: 1,
                      borderRadius: 1.5,
                      bgcolor: selected ? alpha(NAVY, 0.07) : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: alpha(NAVY, 0.05) }
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <MessageOutlined style={{ color: NAVY, marginTop: 3 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={selected ? 750 : 600} noWrap>
                          {readField(conversation, 'title', 'Title') || 'Untitled conversation'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {readField(conversation, 'lastMessagePreview', 'LastMessagePreview') || 'No messages yet'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>

          <Box sx={{ p: 1.5 }}>
            <Button
              component={Link}
              to="/landlord/ai-center/collections-history"
              fullWidth
              startIcon={<HistoryOutlined />}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none' }}
            >
              Activity history
            </Button>

          </Box>
        </Box>

        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ height: 58, flexShrink: 0, px: { xs: 1.5, sm: 2.25 }, borderBottom: `1px solid ${alpha(NAVY, 0.07)}` }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton onClick={() => setMobilePanelOpen(true)} sx={{ display: { xl: 'none' } }}>
                <MenuOutlined />
              </IconButton>
              <Box>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: NAVY }}>
                    Percy workspace
                  </Typography>
                  <Chip
                    label={readinessMarker.label}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: readinessMarker.active ? alpha(GREEN, 0.09) : alpha(NAVY, 0.06),
                      color: readinessMarker.active ? GREEN : 'text.secondary',
                      fontWeight: 800
                    }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {readinessMarker.toolDetail}
                </Typography>
              </Box>
            </Stack>
            <Tooltip title="Start a new conversation">
              <IconButton size="small" onClick={handleNewChat}>
                <PlusOutlined />
              </IconButton>
            </Tooltip>
          </Stack>

          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3, lg: 5 }, py: 3, bgcolor: alpha('#f8fafc', 0.55) }}>
            {summaryError && (
              <Alert severity="warning" sx={{ maxWidth: 760, mx: 'auto', mb: 2 }}>
                Percy could not load all portfolio context. You can still navigate tools from the workspace.
              </Alert>
            )}
            {conversationError && (
              <Alert severity="error" sx={{ maxWidth: 760, mx: 'auto', mb: 2 }}>
                {conversationError}
              </Alert>
            )}

            {conversationLoading ? (
              <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: '100%', minHeight: 300 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  Loading conversation…
                </Typography>
              </Stack>
            ) : messages.length === 0 ? (
              <Box
                sx={{
                  height: '100%',
                  minHeight: 430,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  maxWidth: 760,
                  mx: 'auto'
                }}
              >
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: 2.25,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: NAVY,
                    color: '#fff',
                    boxShadow: `0 12px 24px ${alpha(NAVY, 0.2)}`
                  }}
                >
                  <RobotOutlined style={{ fontSize: 28 }} />
                </Box>
                <Typography variant="h2" fontWeight={800} sx={{ mt: 2, color: NAVY, letterSpacing: -0.7 }}>
                  What can Percy help with?
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 560, lineHeight: 1.7 }}>
                  Ask about live rent, leases, applications, or maintenance. Percy will show which Property Peace tools were used before
                  presenting the result.
                </Typography>

                <Box
                  sx={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                    mt: 3
                  }}
                >
                  {STARTER_PROMPTS.map((starter) => (
                    <Box
                      key={starter.label}
                      component="button"
                      type="button"
                      disabled={!aiRuntimeReady || !percyReadiness.canInvoke || thinking || conversationLoading}
                      onClick={() => handleSend(starter.prompt)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: `1px solid ${alpha(NAVY, 0.1)}`,
                        bgcolor: '#fff',
                        color: NAVY,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 160ms ease',
                        '&:hover': {
                          borderColor: alpha(NAVY, 0.25),
                          boxShadow: `0 8px 20px ${alpha(NAVY, 0.07)}`,
                          transform: 'translateY(-1px)'
                        }
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 1.25,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: alpha(GREEN, 0.08),
                            color: GREEN
                          }}
                        >
                          {starter.icon}
                        </Box>
                        <Box>
                          <Typography variant="body2" fontWeight={800}>
                            {starter.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 250 }}>
                            {starter.prompt}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : (
              <Stack spacing={3} sx={{ maxWidth: 860, mx: 'auto' }}>
                {messages.map((message) =>
                  message.role === 'user' ? (
                    <UserMessage key={message.id} message={message} />
                  ) : (
                    <AssistantMessage
                      key={message.id}
                      message={message}
                      onResolveConfirmation={handleResolveConfirmation}
                      confirmationLoading={Boolean(confirmationLoading[message.pendingConfirmation?.id])}
                      confirmationError={confirmationErrors[message.pendingConfirmation?.id]}
                    />
                  )
                )}
                {thinking && (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1.25,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: NAVY,
                        color: '#fff'
                      }}
                    >
                      <RobotOutlined />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700} sx={{ color: NAVY }}>
                        {progressText}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Waiting for Percy's full response…
                      </Typography>
                    </Box>
                  </Stack>
                )}
                <div ref={messageEndRef} />
              </Stack>
            )}
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              px: { xs: 1.5, sm: 3, lg: 5 },
              pt: 1.5,
              pb: 1.25,
              borderTop: `1px solid ${alpha(NAVY, 0.07)}`,
              bgcolor: '#fff'
            }}
          >
            <Box sx={{ maxWidth: 860, mx: 'auto' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 1,
                  p: 0.75,
                  pl: 1.5,
                  borderRadius: 2.25,
                  border: `1px solid ${alpha(NAVY, 0.16)}`,
                  boxShadow: `0 5px 18px ${alpha(NAVY, 0.06)}`,
                  '&:focus-within': { borderColor: alpha(NAVY, 0.38), boxShadow: `0 0 0 3px ${alpha(NAVY, 0.05)}` }
                }}
              >
                <InputBase
                  multiline
                  maxRows={5}
                  fullWidth
                  value={input}
                  onChange={(event) => {
                    chatRequestAttemptRef.current.inputChanged(event.target.value);
                    setInput(event.target.value);
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Ask Percy about your properties…"
                  disabled={!aiRuntimeReady || !percyReadiness.canInvoke || summaryLoading || conversationLoading}
                  sx={{ py: 0.75, fontSize: '0.95rem' }}
                />
                <IconButton
                  onClick={() => handleSend()}
                  disabled={!input.trim() || thinking || conversationLoading || !percyReadiness.canInvoke}
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: input.trim() ? NAVY : alpha(NAVY, 0.06),
                    color: input.trim() ? '#fff' : 'text.disabled',
                    '&:hover': { bgcolor: NAVY }
                  }}
                >
                  {thinking ? <CircularProgress size={17} color="inherit" /> : <SendOutlined />}
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 0.75 }}>
                Percy uses organization-scoped data. Confirmations are required before consequential actions.
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            width: 292,
            flexShrink: 0,
            display: { xs: 'none', xl: 'flex' },
            flexDirection: 'column',
            borderLeft: `1px solid ${alpha(NAVY, 0.08)}`,
            bgcolor: alpha(NAVY, 0.018),
            overflowY: 'auto'
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={850} sx={{ color: NAVY }}>
              Workspace connections
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Data and tool availability
            </Typography>
            <Stack sx={{ mt: 1.25 }} divider={<Divider />}>
              <ConnectionRow
                icon={<DatabaseOutlined />}
                title="Property Peace"
                detail={
                  summaryLoading ? 'Loading live context…' : `${contextCounts.properties} properties · ${contextCounts.tenants} tenants`
                }
                active={dataReady}
              />
              <ConnectionRow
                icon={<ApiOutlined />}
                title="Built-in tools"
                detail={readinessMarker.toolDetail}
                active={readinessMarker.active}
              />
            </Stack>
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={850} sx={{ color: NAVY, mb: 1 }}>
              Tool shortcuts
            </Typography>
            <Stack spacing={0.25}>
              <Button
                component={Link}
                to="/landlord/rent-collection"
                startIcon={<DollarCircleOutlined />}
                endIcon={<ArrowRightOutlined />}
                sx={{
                  justifyContent: 'flex-start',
                  color: 'text.secondary',
                  textTransform: 'none',
                  '& .MuiButton-endIcon': { ml: 'auto' }
                }}
              >
                Rent collection
              </Button>
              <Button
                component={Link}
                to="/landlord/maintenances"
                startIcon={<ToolOutlined />}
                endIcon={<ArrowRightOutlined />}
                sx={{
                  justifyContent: 'flex-start',
                  color: 'text.secondary',
                  textTransform: 'none',
                  '& .MuiButton-endIcon': { ml: 'auto' }
                }}
              >
                Maintenance
              </Button>
              <Button
                component={Link}
                to="/landlord/ai-center/collections-history"
                startIcon={<HistoryOutlined />}
                endIcon={<ArrowRightOutlined />}
                sx={{
                  justifyContent: 'flex-start',
                  color: 'text.secondary',
                  textTransform: 'none',
                  '& .MuiButton-endIcon': { ml: 'auto' }
                }}
              >
                Activity history
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>

      {mobilePanelOpen && (
        <Box
          sx={{ position: 'fixed', inset: 0, zIndex: theme.zIndex.drawer + 2, display: { xl: 'none' }, bgcolor: alpha('#000', 0.35) }}
          onClick={() => setMobilePanelOpen(false)}
        >
          <Box
            sx={{
              width: { xs: '86%', sm: 330 },
              height: '100%',
              ml: 'auto',
              p: 2,
              bgcolor: '#fff',
              overflowY: 'auto',
              boxShadow: `-12px 0 40px ${alpha('#000', 0.16)}`
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h5" fontWeight={800}>
                Percy workspace
              </Typography>
              <IconButton onClick={() => setMobilePanelOpen(false)}>
                <CloseOutlined />
              </IconButton>
            </Stack>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<PlusOutlined />}
              onClick={() => {
                handleNewChat();
                setMobilePanelOpen(false);
              }}
              sx={{ mb: 2, justifyContent: 'flex-start', textTransform: 'none' }}
            >
              New conversation
            </Button>
            <Typography variant="subtitle2" fontWeight={800}>
              Conversations
            </Typography>
            {conversationsLoading && (
              <Typography variant="caption" color="text.secondary">
                Loading conversations…
              </Typography>
            )}
            {!conversationsLoading && conversationsError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {conversationsError}
              </Alert>
            )}
            {!conversationsLoading && !conversationsError && conversations.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                No saved conversations yet.
              </Typography>
            )}
            <Stack spacing={0.5} sx={{ mt: 1, mb: 2 }}>
              {conversations.map((conversation) => {
                const id = readField(conversation, 'id', 'Id');
                return (
                  <Button
                    key={id}
                    fullWidth
                    onClick={() => {
                      handleSelectConversation(id);
                      setMobilePanelOpen(false);
                    }}
                    startIcon={<MessageOutlined />}
                    sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: id === selectedConversationId ? 800 : 500 }}
                  >
                    <Typography variant="body2" noWrap>
                      {readField(conversation, 'title', 'Title') || 'Untitled conversation'}
                    </Typography>
                  </Button>
                );
              })}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={800}>
              Connections
            </Typography>
            <ConnectionRow
              icon={<DatabaseOutlined />}
              title="Property Peace"
              detail={`${contextCounts.properties} properties · ${contextCounts.tenants} tenants`}
              active={dataReady}
            />
            <ConnectionRow
              icon={<ApiOutlined />}
              title="Built-in tools"
              detail={readinessMarker.toolDetail}
              active={readinessMarker.active}
            />
            <Divider sx={{ my: 1.5 }} />
            <Button
              component={Link}
              to="/landlord/ai-center/collections-history"
              fullWidth
              startIcon={<HistoryOutlined />}
              onClick={() => setMobilePanelOpen(false)}
              sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none' }}
            >
              Activity history
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
