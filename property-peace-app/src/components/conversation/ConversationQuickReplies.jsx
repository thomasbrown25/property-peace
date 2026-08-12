import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';

import { listQuickReplies } from 'api/conversationTimeline';
import { resolveQuickReplyScope } from 'utils/conversationTimeline';

export default function ConversationQuickReplies({ conversation, organizationId, userId, hidden = false, onSelect }) {
  const scope = useMemo(
    () => resolveQuickReplyScope({ conversation, organizationId, userId }),
    [conversation, organizationId, userId]
  );
  const scopeKey = scope ? `${scope.userId}:${scope.organizationId}:${scope.contextKind || 'all'}` : null;
  const [requestVersion, setRequestVersion] = useState(0);
  const [result, setResult] = useState({ scopeKey: null, status: 'idle', replies: [] });

  useEffect(() => {
    if (!scope || !scopeKey) return undefined;
    let current = true;
    setResult({ scopeKey, status: 'loading', replies: [] });
    listQuickReplies(scope.organizationId, scope.contextKind)
      .then((replies) => {
        if (current) setResult({ scopeKey, status: 'ready', replies });
      })
      .catch(() => {
        if (current) setResult({ scopeKey, status: 'error', replies: [] });
      });
    return () => {
      current = false;
    };
  }, [requestVersion, scopeKey]); // Scope values are encoded in scopeKey; stale requests are ignored by cleanup.

  if (hidden || !scopeKey || result.scopeKey !== scopeKey) return null;

  if (result.status === 'loading') {
    return (
      <Box aria-live="polite" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pb: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">Loading quick replies…</Typography>
      </Box>
    );
  }

  if (result.status === 'error') {
    return (
      <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pb: 1 }}>
        <Typography variant="caption" color="text.secondary">Quick replies unavailable.</Typography>
        <Button size="small" onClick={() => setRequestVersion((value) => value + 1)} sx={{ minWidth: 0, p: 0, textTransform: 'none' }}>
          Try again
        </Button>
      </Box>
    );
  }

  if (result.status !== 'ready' || result.replies.length === 0) return null;

  return (
    <Box aria-label="Quick replies" sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
      {result.replies.map((reply) => (
        <Chip
          key={reply.id}
          label={reply.title}
          title={reply.body}
          variant="outlined"
          onClick={() => onSelect(reply.body)}
          sx={{ flexShrink: 0, maxWidth: { xs: 250, sm: 'none' }, borderRadius: 2, bgcolor: 'background.paper', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
        />
      ))}
    </Box>
  );
}

ConversationQuickReplies.propTypes = {
  conversation: PropTypes.object,
  organizationId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  hidden: PropTypes.bool,
  onSelect: PropTypes.func.isRequired
};
