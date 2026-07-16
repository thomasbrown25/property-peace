import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Stack, Button, Drawer, IconButton, TextField, CircularProgress, useTheme } from '@mui/material';
import { CloseOutlined, SendOutlined, RobotOutlined, CameraOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import axiosServices from 'utils/axios';

const DRAWER_WIDTH = 460;
const TEAL = '#0ea5e9';

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message, onUploadPhoto }) {
  const theme = useTheme();
  const isAgent = message.role === 'assistant';
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadPhoto) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result; // data:image/jpeg;base64,...
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      onUploadPhoto(base64, mimeType, dataUrl);
    };
    reader.readAsDataURL(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  return (
    <Stack direction="row" spacing={1} alignItems="flex-end" justifyContent={isAgent ? 'flex-start' : 'flex-end'} sx={{ px: 2, mb: 1.5 }}>
      {isAgent && (
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: `${TEAL}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mb: 0.25,
            alignSelf: 'flex-start',
            mt: 0.25
          }}
        >
          <RobotOutlined style={{ fontSize: 14, color: TEAL }} />
        </Box>
      )}

      <Box sx={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Photo preview (user messages with a photo) */}
        {!isAgent && message.photoPreviewUrl && (
          <Box
            sx={{
              borderRadius: '16px 16px 4px 16px',
              overflow: 'hidden',
              border: `2px solid ${TEAL}`,
              alignSelf: 'flex-end'
            }}
          >
            <img
              src={message.photoPreviewUrl}
              alt="Uploaded"
              style={{ display: 'block', maxWidth: 220, maxHeight: 160, objectFit: 'cover' }}
            />
          </Box>
        )}

        {/* Bubble */}
        <Box
          sx={{
            px: 1.75,
            py: 1.25,
            borderRadius: isAgent ? '4px 16px 16px 16px' : '16px 16px 4px 16px',
            bgcolor: isAgent ? (theme.palette.mode === 'dark' ? `${TEAL}22` : `${TEAL}0d`) : TEAL,
            color: isAgent ? theme.palette.text.primary : '#ffffff',
            border: isAgent ? `1px solid ${TEAL}30` : 'none'
          }}
        >
          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <span style={{ display: 'block', margin: 0, lineHeight: 1.55, fontSize: '0.875rem', color: 'inherit' }}>{children}</span>
              ),
              strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'inherit' }}>{children}</strong>,
              em: ({ children }) => <em style={{ color: 'inherit' }}>{children}</em>,
              ol: ({ children }) => <ol style={{ margin: '4px 0 0', paddingLeft: 18, color: 'inherit' }}>{children}</ol>,
              ul: ({ children }) => <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: 'inherit' }}>{children}</ul>,
              li: ({ children }) => <li style={{ lineHeight: 1.55, fontSize: '0.875rem', color: 'inherit' }}>{children}</li>
            }}
          >
            {message.content}
          </ReactMarkdown>
        </Box>

        {/* Upload button — shown on agent messages that request a photo */}
        {isAgent && onUploadPhoto && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            <Button
              variant="outlined"
              size="small"
              startIcon={<CameraOutlined />}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                alignSelf: 'flex-start',
                borderColor: TEAL,
                color: TEAL,
                fontSize: '0.8rem',
                px: 2,
                py: 0.5,
                textTransform: 'none',
                '&:hover': { borderColor: '#0284c7', color: '#0284c7', bgcolor: `${TEAL}08` }
              }}
            >
              Upload a photo
            </Button>
          </>
        )}
      </Box>
    </Stack>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ px: 2, mb: 1.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: `${TEAL}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <RobotOutlined style={{ fontSize: 14, color: TEAL }} />
      </Box>
      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          borderRadius: '4px 16px 16px 16px',
          bgcolor: `${TEAL}0d`,
          border: `1px solid ${TEAL}20`,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: TEAL,
              opacity: 0.5,
              animation: 'bounce 1.2s infinite ease-in-out',
              animationDelay: `${i * 0.2}s`,
              '@keyframes bounce': {
                '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
                '40%': { transform: 'scale(1)', opacity: 1 }
              }
            }}
          />
        ))}
      </Box>
    </Stack>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────

export default function MaintenanceAgentDrawer({
  open,
  onClose,
  onRequestCreated,
  subtitle = 'Active · Tenant-initiated',
  chatEndpoint = '/api/maintenance-agent/chat',
  initialContext = null
}) {
  const theme = useTheme();
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // messages: { role, content, photoBase64?, photoMimeType?, photoPreviewUrl? }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  // index of the last agent message that requested a photo (-1 = none)
  const [photoRequestIdx, setPhotoRequestIdx] = useState(-1);
  const [awaitingPostSubmitChoice, setAwaitingPostSubmitChoice] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, loading]);

  useEffect(() => {
    if (open && !initialized) {
      setMessages([]);
      setInput('');
      setPhotoRequestIdx(-1);
      setAwaitingPostSubmitChoice(false);
      setInitialized(true);
      sendToAgent([]);
    }
    if (!open) {
      setInitialized(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendToAgent = useCallback(
    async (msgHistory) => {
      setLoading(true);
      // Clear any pending photo request while waiting for response
      setPhotoRequestIdx(-1);
      try {
        // Strip photoPreviewUrl (display-only) before sending to API
        const payload = msgHistory.map(({ photoPreviewUrl: _preview, ...rest }) => rest);
        const body = { messages: payload };
        if (initialContext?.propertyId) {
          body.propertyId = initialContext.propertyId;
          body.propertyName = initialContext.propertyName;
          body.unitId = initialContext.unitId ?? null;
          body.unitName = initialContext.unitName ?? null;
        }
        const response = await axiosServices.post(chatEndpoint, body);

        const data = response.data?.data;
        if (!data) return;

        const agentMsg = { role: 'assistant', content: data.message };
        setMessages((prev) => {
          const updated = [...prev, agentMsg];
          if (data.photoRequested) {
            setPhotoRequestIdx(updated.length - 1);
          }
          return updated;
        });

        if (data.done && data.maintenanceRequest) {
          setAwaitingPostSubmitChoice(true);
          if (onRequestCreated) await onRequestCreated(data.maintenanceRequest);
        }
      } catch (err) {
        console.error('Maintenance Agent error:', err);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: "I'm sorry, something went wrong. Please try again or contact support." }
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [onRequestCreated, chatEndpoint, initialContext]
  );

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');

    if (awaitingPostSubmitChoice) {
      const normalized = text.toLowerCase();
      const wantsToClose =
        normalized === 'no' ||
        normalized === 'nope' ||
        normalized.includes("i'm done") ||
        normalized.includes('im done') ||
        normalized.includes('all done') ||
        normalized.includes('all set') ||
        normalized.includes('nothing else') ||
        normalized.includes('no thanks') ||
        normalized.includes("that's it") ||
        normalized.includes('that is it') ||
        normalized.includes('finished');

      if (wantsToClose) {
        onClose();
        return;
      }

      setAwaitingPostSubmitChoice(false);
    }

    sendToAgent(newMessages);
  };

  const handlePhotoUpload = useCallback(
    (base64, mimeType, previewUrl) => {
      // Dismiss the upload button
      setPhotoRequestIdx(-1);
      const userMsg = {
        role: 'user',
        content: "Here's a photo of the issue.",
        photoBase64: base64,
        photoMimeType: mimeType,
        photoPreviewUrl: previewUrl
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      sendToAgent(newMessages);
    },
    [messages, sendToAgent]
  );

  const handleSkipPhoto = useCallback(() => {
    setPhotoRequestIdx(-1);
    const userMsg = { role: 'user', content: 'No photo, please continue.' };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    sendToAgent(newMessages);
  }, [messages, sendToAgent]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim() && !loading;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: DRAWER_WIDTH },
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexShrink: 0,
          bgcolor: 'background.paper'
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: `${TEAL}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <RobotOutlined style={{ fontSize: 18, color: TEAL }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} lineHeight={1.2} sx={{ color: 'text.primary' }}>
            Maintenance Agent
          </Typography>
          <Typography variant="caption" sx={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#16a34a', display: 'inline-block' }} />
            {subtitle}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseOutlined style={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ── Body ── */}
      <>
        {/* Message list */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            pt: 2,
            pb: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {messages.length === 0 && !loading && (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} sx={{ color: TEAL }} />
            </Box>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} onUploadPhoto={idx === photoRequestIdx && !loading ? handlePhotoUpload : null} />
          ))}

          {/* Skip photo option — shown below the photo-request message */}
          {photoRequestIdx >= 0 && !loading && (
            <Box sx={{ px: 2, mb: 1.5 }}>
              <Button
                size="small"
                onClick={handleSkipPhoto}
                sx={{ color: 'text.disabled', fontSize: '0.78rem', textTransform: 'none', p: 0, minWidth: 0 }}
              >
                Skip, no photo
              </Button>
            </Box>
          )}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </Box>

        {/* ── Input ── */}
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            flexShrink: 0,
            bgcolor: 'background.paper'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-end">
            <TextField
              inputRef={inputRef}
              fullWidth
              multiline
              maxRows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message…"
              disabled={loading}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 3,
                  fontSize: '0.875rem',
                  bgcolor: 'background.default',
                  '& input, & textarea': { color: 'text.primary' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: TEAL
                  }
                }
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={!canSend}
              sx={{
                bgcolor: canSend ? TEAL : `${TEAL}14`,
                color: canSend ? '#fff' : TEAL,
                borderRadius: 2,
                width: 38,
                height: 38,
                flexShrink: 0,
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: canSend ? '#0284c7' : `${TEAL}20`
                },
                '&.Mui-disabled': {
                  bgcolor: `${TEAL}0e`,
                  color: `${TEAL}60`
                }
              }}
            >
              <SendOutlined style={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block', textAlign: 'center' }}>
            Press Enter to send · Shift+Enter for new line
          </Typography>
        </Box>
      </>
    </Drawer>
  );
}

MaintenanceAgentDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRequestCreated: PropTypes.func,
  subtitle: PropTypes.string,
  chatEndpoint: PropTypes.string,
  initialContext: PropTypes.shape({
    propertyId: PropTypes.number,
    propertyName: PropTypes.string,
    unitId: PropTypes.number,
    unitName: PropTypes.string
  })
};
