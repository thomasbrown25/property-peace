import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
  SendOutlined,
  SyncOutlined,
  ToolOutlined
} from '@ant-design/icons';
import FloatingWren from 'components/FloatingWren';
import useOrganizationSummary from 'hooks/useOrganizationSummary';
import useAuth from 'hooks/useAuth';
import useWrenConversations from 'hooks/useWrenConversations';
import { useOrganization } from 'contexts/OrganizationContext';
import { aiFollowUpAPI } from 'api';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';
import { formatWrenMetricValue } from 'utils/wrenMetricValue';
import { sortWrenConversationsMostRecentFirst } from 'utils/wrenConversations';
import { mapWrenSource } from 'utils/wrenSources';
import { createWrenChatRequestAttempt } from 'utils/wrenChatRequestAttempt';
import { selectProperties, selectPropertiesOrganizationId } from 'store/property/property.selector';
import {
  createAICenterScopeGuard,
  getAICenterReadinessMarker,
  getCurrentOrganizationId,
  isAICenterRuntimeReady,
  isAICenterScopeEligible,
  makeAICenterScope
} from 'utils/aiCenterScope';

const workspaceIconSx = { display: 'grid', placeItems: 'center', flexShrink: 0, color: 'primary.main' };
const toolShortcutSx = {
  justifyContent: 'flex-start',
  color: 'text.secondary',
  textTransform: 'none',
  '& .MuiButton-startIcon, & .MuiButton-endIcon': { color: 'primary.main' },
  '& .MuiButton-endIcon': { ml: 'auto' }
};
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
    actionLabel: readField(value, 'actionLabel', 'ActionLabel') || 'Wren AI action',
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
    sources: asArray(readField(value, 'sources', 'Sources')).map(mapWrenSource),
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
    <Box sx={{ mt: 1.5, px: 1.25, py: 1, borderRadius: 1.75, bgcolor: 'surface.nested', border: '1px solid', borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ ...workspaceIconSx, width: 28, height: 28 }}>
          <ApiOutlined />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" fontWeight={800} sx={{ display: 'block', color: 'text.primary' }}>
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

function AssistantMessage({ message, progressText, onResolveConfirmation, confirmationLoading, confirmationError }) {
  const confirmation = message.pendingConfirmation;
  const confirmationPending = confirmation && String(confirmation.status).toLowerCase() === 'pending';
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ width: '100%' }}>
      <FloatingWren placement="reply" />
      <Box sx={{ minWidth: 0, maxWidth: 760, flex: 1 }}>
        {message.streaming && !message.content ? (
          <Typography variant="body2" fontWeight={700} sx={{ color: 'text.primary' }}>
            {progressText}
          </Typography>
        ) : (
          <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.75 }}>
            {message.content}
          </Typography>
        )}

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
              <Box key={metric.label} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography variant="caption" color="text.secondary">
                  {metric.label}
                </Typography>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'text.primary', mt: 0.2 }}>
                  {formatWrenMetricValue(metric)}
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
                sx={{ px: 1.25, py: 1, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
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
                  <Typography variant="body2" fontWeight={750} sx={{ flexShrink: 0, color: 'text.primary' }}>
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
      <Box sx={{ maxWidth: 680, px: 1.75, py: 1.15, borderRadius: '18px 18px 4px 18px', bgcolor: 'primary.main' }}>
        <Typography variant="body1" sx={{ color: '#fff', lineHeight: 1.6 }}>
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
          ...workspaceIconSx,
          width: 30,
          height: 30,
          fontSize: 17,
          color: active ? 'primary.main' : 'text.secondary'
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
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: active ? 'success.main' : 'text.disabled' }} />
    </Stack>
  );
}

export default function AICenter() {
  const theme = useTheme();
  const location = useLocation();
  const chatParams = new URLSearchParams(location.search);
  const startsNewChat = chatParams.get('new') === '1';
  const requestedPropertyId = startsNewChat ? chatParams.get('propertyId') : null;
  const requestedConversationId = startsNewChat ? null : chatParams.get('conversationId');
  const routeSelectionKey = startsNewChat || requestedConversationId ? location.key : null;
  const newChatTitle = startsNewChat && requestedPropertyId == null ? 'New chat (all properties)' : 'New chat';

  const messageEndRef = useRef(null);
  const selectionVersionRef = useRef(0);
  const initialSelectionPendingRef = useRef(false);
  const scopeGuardRef = useRef(createAICenterScopeGuard());
  const progressTimerRef = useRef(null);
  const streamAbortRef = useRef(null);
  const chatRequestAttemptRef = useRef(createWrenChatRequestAttempt());
  const { user } = useAuth();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const userId = user?.id ?? user?.Id ?? user?.email ?? user?.Email ?? null;
  const organizationId = getCurrentOrganizationId(currentOrganization);
  const properties = useSelector(selectProperties);
  const propertiesOrganizationId = useSelector(selectPropertiesOrganizationId);
  const aiScopeEligible = isAICenterScopeEligible({ userId, currentOrganization, organizationLoading });
  const aiScope = useMemo(() => makeAICenterScope({ userId, organizationId }), [organizationId, userId]);
  // Synchronize during render so same-organization loading transitions close
  // currentness immediately, rather than waiting for effect cleanup.
  const aiRuntime = scopeGuardRef.current.synchronize(aiScope, aiScopeEligible);
  const currentScopeRef = useRef(aiRuntime);
  currentScopeRef.current = aiRuntime;
  const { data: summary, loading: summaryLoading, error: summaryError } = useOrganizationSummary();
  const { presentation: wrenReadiness } = useFeatureReadiness(FEATURE_KEYS.wrenAi);
  const readinessMarker = getAICenterReadinessMarker(wrenReadiness);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [progressText, setProgressText] = useState('Let me take a look…');
  const { conversations, isLoading: conversationsLoading, mutate: mutateConversations } = useWrenConversations();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [selectedConversationTitle, setSelectedConversationTitle] = useState(null);
  const [activePropertyId, setActivePropertyId] = useState(null);
  const [selectedArchived, setSelectedArchived] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [confirmationLoading, setConfirmationLoading] = useState({});
  const [confirmationErrors, setConfirmationErrors] = useState({});
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [stateScopeGeneration, setStateScopeGeneration] = useState(null);
  const aiRuntimeReady = isAICenterRuntimeReady({ runtime: aiRuntime, stateGeneration: stateScopeGeneration });
  const sortedConversations = useMemo(
    () => sortWrenConversationsMostRecentFirst(conversations.filter((item) => !readField(item, 'isArchived', 'IsArchived'))),
    [conversations]
  );
  const cachedSelection = selectedConversationId != null
    ? conversations.find((item) => String(readField(item, 'id', 'Id')) === String(selectedConversationId))
    : null;
  const conversationTitle = selectedConversationTitle || readField(cachedSelection, 'title', 'Title');
  const selectionIsArchived = Boolean(readField(cachedSelection, 'isArchived', 'IsArchived'));
  const chatArchived = selectedArchived || selectionIsArchived;
  const summaryProperties = asArray(readField(summary, 'properties', 'Properties'));
  const matchesActiveProperty = (property) => String(readField(property, 'id', 'Id')) === String(activePropertyId);
  const scopedProperties = String(propertiesOrganizationId) === String(organizationId) ? properties : [];
  const activeProperty = activePropertyId != null
    ? scopedProperties.find(matchesActiveProperty) ?? summaryProperties.find(matchesActiveProperty)
    : null;
  const propertyLabel = readField(activeProperty, 'name', 'Name') || readField(activeProperty, 'streetAddress', 'StreetAddress')
    || readField(activeProperty, 'address', 'Address');

  useEffect(() => {
    if (selectionIsArchived) setSelectedArchived(true);
  }, [selectionIsArchived]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const handleSelectConversation = async (id) => {
    if (!aiScopeEligible) return;
    initialSelectionPendingRef.current = false;
    const scopeRequest = scopeGuardRef.current.capture(aiScope);
    chatRequestAttemptRef.current.contextChanged({ conversationId: id, scopeKey: aiScope.scopeKey });
    streamAbortRef.current?.abort();
    const version = ++selectionVersionRef.current;
    clearTimeout(progressTimerRef.current);
    setSelectedConversationId(id);
    setSelectedConversationTitle(null);
    setActivePropertyId(null);
    setSelectedArchived(false);
    setMessages([]);
    setInput('');
    setThinking(false);
    setConversationLoading(true);
    setConversationError('');
    try {
      const response = unwrapData(await aiFollowUpAPI.getConversation(id));
      if (selectionVersionRef.current !== version || !scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) return;
      setSelectedConversationId(readField(response, 'id', 'Id') ?? id);
      setSelectedConversationTitle(readField(response, 'title', 'Title') ?? null);
      setActivePropertyId(readField(response, 'propertyId', 'PropertyId') ?? null);
      if (readField(response, 'isArchived', 'IsArchived')) setSelectedArchived(true);
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
    currentScopeRef.current = scopeRequest;
    chatRequestAttemptRef.current.reset();
    initialSelectionPendingRef.current = aiScopeEligible && !startsNewChat && !requestedConversationId;

    selectionVersionRef.current += 1;
    streamAbortRef.current?.abort();
    clearTimeout(progressTimerRef.current);
    setMessages([]);
    setInput('');
    setThinking(false);
    setProgressText('Let me take a look…');
    setSelectedConversationId(null);
    setSelectedConversationTitle(null);
    setActivePropertyId(requestedPropertyId);
    setSelectedArchived(false);
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

    if (aiScopeEligible && requestedConversationId) handleSelectConversation(requestedConversationId);
    return disposeScope;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiScope.scopeKey, aiScopeEligible, routeSelectionKey, startsNewChat, requestedPropertyId, requestedConversationId]);

  useEffect(() => {
    if (!aiRuntimeReady || !initialSelectionPendingRef.current || conversationsLoading) return;
    initialSelectionPendingRef.current = false;
    const latestId = readField(sortedConversations[0], 'id', 'Id');
    if (latestId != null) handleSelectConversation(latestId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiRuntimeReady, conversationsLoading, sortedConversations]);

  const handleSend = async (value = input) => {
    if (!aiRuntimeReady || !wrenReadiness.canInvoke) return;
    const prompt = value.trim();
    if (!prompt || thinking || conversationLoading || chatArchived || conversationError) return;

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
      { id: assistantPlaceholderId, role: 'assistant', content: '', streaming: true }
    ]);
    setInput('');
    setThinking(true);
    setProgressText('Let me take a look…');

    let completedResponse = null;
    try {
      await aiFollowUpAPI.streamChat(prompt, conversationId, requestAttempt.clientRequestId, {
        propertyId: conversationId == null ? activePropertyId : null,
        signal: controller.signal,
        onEvent: (event) => {
          if (selectionVersionRef.current !== version || !scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)) return;
          if (event.type === 'status') {
            setProgressText(event.message || "I'm pulling that together for you…");
            return;
          }
          if (event.type === 'content.delta') {
            setProgressText('Wren AI is responding');
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
          if (event.type === 'error') throw new Error(event.message || 'Wren AI could not complete this request.');
        }
      });

      if (
        selectionVersionRef.current !== version
        || !scopeGuardRef.current.isCurrent(scopeRequest, currentScopeRef.current)
      ) return;
      if (!completedResponse) throw new Error('Wren AI could not complete this request. Please try again.');
      const response = completedResponse;
      chatRequestAttemptRef.current.succeed(requestAttempt);
      const serverConversationId = readField(response, 'conversationId', 'ConversationId');
      const title = readField(response, 'conversationTitle', 'ConversationTitle') || conversationTitle || 'Untitled conversation';
      const userMessageId = readField(response, 'userMessageId', 'UserMessageId');
      setSelectedConversationId(serverConversationId);
      setSelectedConversationTitle(title);
      setMessages((current) =>
        current.map((message) => {
          if (message.id === optimisticId) return { ...message, id: userMessageId || message.id };
          if (message.id === assistantPlaceholderId) return mapChatResponse(response);
          return message;
        })
      );
      void mutateConversations((current = []) => {
        const existing = current.find((item) => readField(item, 'id', 'Id') === serverConversationId) || {};
        const next = {
          ...existing,
          id: serverConversationId,
          propertyId: activePropertyId,
          title,
          updatedAt: new Date().toISOString(),
          lastMessagePreview: readField(response, 'content', 'Content') || prompt
        };
        return sortWrenConversationsMostRecentFirst([
          next,
          ...current.filter((item) => readField(item, 'id', 'Id') !== serverConversationId)
        ]);
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
    properties: summaryProperties.length,
    tenants: asArray(readField(summary, 'tenants', 'Tenants')).length
  };

  // Never render retained state while the scope is ineligible or while a fresh
  // runtime generation is waiting for its reset/reload effect.
  if (!aiRuntimeReady) return null;

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <FeatureReadinessNotice presentation={wrenReadiness} featureName="Wren AI" />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: (theme) => `0 18px 45px ${alpha(theme.palette.text.primary, 0.07)}`
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ height: 58, flexShrink: 0, px: { xs: 1.5, sm: 2.25 }, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <IconButton aria-label="Workspace details" color="primary" onClick={() => setMobilePanelOpen(true)} sx={{ display: { xl: 'none' } }}>
              <MenuOutlined />
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" variant="subtitle1" fontWeight={800} color="text.primary" noWrap>
                {activePropertyId != null ? propertyLabel || 'Property chat' : 'Wren AI workspace'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                {conversationTitle || (conversationLoading ? 'Loading chat…' : newChatTitle)}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 2, sm: 3, lg: 5 }, py: 3, bgcolor: 'surface.nested' }}>
            {summaryError && (
              <Alert severity="warning" sx={{ maxWidth: 760, mx: 'auto', mb: 2 }}>
                Wren AI could not load all portfolio context. You can still navigate tools from the workspace.
              </Alert>
            )}
            {conversationError && (
              <Alert severity="error" sx={{ maxWidth: 760, mx: 'auto', mb: 2 }}>
                {conversationError}
              </Alert>
            )}
            {chatArchived && (
              <Alert severity="info" sx={{ maxWidth: 760, mx: 'auto', mb: 2 }}>
                This chat is archived.
              </Alert>
            )}

            {conversationLoading ? (
              <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: '100%' }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  Loading conversation…
                </Typography>
              </Stack>
            ) : messages.length === 0 ? (
              <Box
                sx={{
                  minHeight: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  maxWidth: 760,
                  mx: 'auto'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 2, maxWidth: '100%', mb: 1 }}>
                  <FloatingWren placement="welcome" />
                  <Typography
                    component="h2"
                    variant="body1"
                    fontWeight={650}
                    sx={{
                      position: 'relative',
                      textAlign: 'left',
                      color: 'text.primary',
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2.5,
                      px: 1.75,
                      py: 1.1,
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: -5,
                        top: 15,
                        width: 9,
                        height: 9,
                        bgcolor: 'inherit',
                        borderLeft: '1px solid',
                        borderBottom: '1px solid',
                        borderColor: 'inherit',
                        transform: 'rotate(45deg)'
                      }
                    }}
                  >
                    How can I help today?
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 560, lineHeight: 1.7 }}>
                  Ask about live rent, leases, applications, or maintenance.
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
                      disabled={!aiRuntimeReady || !wrenReadiness.canInvoke || thinking || conversationLoading || chatArchived || Boolean(conversationError)}
                      onClick={() => handleSend(starter.prompt)}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 160ms ease',
                        '&:hover': {
                          borderColor: 'text.secondary',
                          boxShadow: (theme) => `0 8px 20px ${alpha(theme.palette.text.primary, 0.07)}`,
                          transform: 'translateY(-1px)'
                        }
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box sx={{ ...workspaceIconSx, width: 34, height: 34, fontSize: 18 }}>
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
                      progressText={progressText}
                      onResolveConfirmation={handleResolveConfirmation}
                      confirmationLoading={Boolean(confirmationLoading[message.pendingConfirmation?.id])}
                      confirmationError={confirmationErrors[message.pendingConfirmation?.id]}
                    />
                  )
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
              pb: (theme) => `max(${theme.spacing(1.25)}, env(safe-area-inset-bottom, 0px))`,
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper'
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
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: (theme) => `0 5px 18px ${alpha(theme.palette.text.primary, 0.06)}`,
                  '&:focus-within': { borderColor: 'primary.main', boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.12)}` }
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
                  placeholder={activePropertyId != null ? 'Ask Wren AI about this property…' : 'Ask Wren AI about your properties…'}
                  disabled={!aiRuntimeReady || !wrenReadiness.canInvoke || summaryLoading || conversationLoading || chatArchived || Boolean(conversationError)}
                  sx={{ py: 0.75, fontSize: '0.95rem' }}
                />
                <IconButton
                  aria-label="Send message"
                  disableRipple
                  onClick={() => handleSend()}
                  disabled={!aiRuntimeReady || !input.trim() || thinking || conversationLoading || !wrenReadiness.canInvoke || chatArchived || Boolean(conversationError)}
                  sx={{
                    width: 38,
                    height: 38,
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'transparent', color: 'primary.main' },
                    '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }
                  }}
                >
                  {thinking ? <CircularProgress size={17} color="inherit" /> : <SendOutlined />}
                </IconButton>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            width: 292,
            flexShrink: 0,
            display: { xs: 'none', xl: 'flex' },
            flexDirection: 'column',
            borderLeft: '1px solid',
            borderColor: 'divider',
            bgcolor: 'surface.nested',
            overflowY: 'auto'
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={850} sx={{ color: 'text.primary' }}>
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
            <Typography variant="subtitle2" fontWeight={850} sx={{ color: 'text.primary', mb: 1 }}>
              Tool shortcuts
            </Typography>
            <Stack spacing={0.25}>
              <Button
                component={Link}
                to="/landlord/leases"
                startIcon={<DollarCircleOutlined />}
                endIcon={<ArrowRightOutlined />}
                sx={toolShortcutSx}
              >
                Leases
              </Button>
              <Button
                component={Link}
                to="/landlord/maintenances"
                startIcon={<ToolOutlined />}
                endIcon={<ArrowRightOutlined />}
                sx={toolShortcutSx}
              >
                Maintenance
              </Button>
              <Button
                component={Link}
                to="/landlord/ai-center/collections-history"
                startIcon={<HistoryOutlined />}
                endIcon={<ArrowRightOutlined />}
                sx={toolShortcutSx}
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
              bgcolor: 'background.paper',
              overflowY: 'auto',
              boxShadow: `-12px 0 40px ${alpha('#000', 0.16)}`
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h5" fontWeight={800}>
                Workspace details
              </Typography>
              <IconButton aria-label="Close workspace details" color="primary" onClick={() => setMobilePanelOpen(false)}>
                <CloseOutlined />
              </IconButton>
            </Stack>
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
              sx={toolShortcutSx}
            >
              Activity history
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
