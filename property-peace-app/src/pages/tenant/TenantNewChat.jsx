import AppIcon from 'components/AppIcon';
import { useId, useState } from 'react';
import { Alert, Avatar, Box, Chip, CircularProgress, IconButton, List, ListItem, ListItemButton, Stack, TextField, Typography, alpha, useTheme } from '@mui/material';
import { getChatStyles } from 'themes/chatStyles';

export default function TenantNewChat({
  landlords, loading, loadError, landlord, onSelect, onClearLandlord, draft, onDraftChange, isSending, sendError, maxLength, onSend, onClose
}) {
  const theme = useTheme();
  const { messagesDivider, messagesDashedBorder } = getChatStyles(theme);
  const [query, setQuery] = useState('');
  const [recipientsOpen, setRecipientsOpen] = useState(true);
  const recipientsId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredLandlords = landlords.filter((option) =>
    [option.name, option.propertyName, option.email].some((value) => value?.toLowerCase().includes(normalizedQuery))
  );
  const showRecipients = !landlord && recipientsOpen;

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${messagesDivider}` }}>
        <Typography variant="h6" fontWeight={700}>New message</Typography>
        <IconButton size="small" aria-label="Close new message" onClick={onClose} disabled={isSending}>
          <AppIcon name="close" />
        </IconButton>
      </Stack>
      <Box sx={{ px: 2.25, py: 1.5, position: 'relative', zIndex: 2, borderBottom: `1px solid ${messagesDivider}`, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="body2" fontWeight={700}>To:</Typography>
          {landlord ? (
            <Chip
              avatar={<Avatar>{landlord.name?.charAt(0)?.toUpperCase() || 'L'}</Avatar>}
              label={landlord.name || 'Landlord'}
              onDelete={isSending ? undefined : () => {
                setQuery('');
                setRecipientsOpen(true);
                onClearLandlord();
              }}
              sx={{ maxWidth: '85%' }}
            />
          ) : (
            <TextField
              fullWidth
              size="small"
              autoFocus
              placeholder="Enter landlord name, email or property"
              value={query}
              onFocus={() => setRecipientsOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setRecipientsOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setRecipientsOpen(false);
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  if (showRecipients) document.getElementById(recipientsId)?.querySelector('button')?.focus();
                  else setRecipientsOpen(true);
                }
              }}
              slotProps={{ htmlInput: { 'aria-label': 'Search landlord contacts', 'aria-controls': showRecipients ? recipientsId : undefined } }}
              sx={{ '& .MuiOutlinedInput-root': { height: 38, fontSize: '0.85rem', borderRadius: 1.5 } }}
            />
          )}
        </Stack>
        {showRecipients && (
          <Box
            id={recipientsId}
            component="section"
            aria-label="Landlord recipients"
            sx={{
              position: 'absolute', top: '100%', left: { xs: 1, sm: 2.25 }, right: { xs: 1, sm: 2.25 },
              maxHeight: 280, overflowY: 'auto', border: `1px solid ${messagesDivider}`, borderRadius: 1.5,
              bgcolor: 'background.paper', boxShadow: theme.shadows[8], scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} aria-label="Loading landlord contacts" /></Box>
            ) : loadError ? (
              <Alert severity="error">{loadError}</Alert>
            ) : filteredLandlords.length === 0 ? (
              <Box sx={{ p: 3, border: `1px dashed ${messagesDashedBorder}`, textAlign: 'center' }}>
                <Typography variant="subtitle2" fontWeight={700}>{landlords.length ? 'No matching landlords' : 'No landlord contacts'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {landlords.length ? 'Try searching by name, email or property.' : 'Ask your landlord to check your tenant account or resend your invite.'}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {filteredLandlords.map((option) => (
                  <ListItem key={option.landlordUserId} disablePadding>
                    <ListItemButton
                      component="button"
                      type="button"
                      onClick={() => onSelect(option)}
                      sx={{ width: '100%', px: 1.5, py: 1, borderBottom: `1px solid ${messagesDivider}` }}
                    >
                      <Avatar sx={{ width: 40, height: 40, fontSize: '0.85rem', fontWeight: 700, bgcolor: 'primary.main', color: 'common.white', mr: 1.5 }}>
                        {option.name?.charAt(0)?.toUpperCase() || 'L'}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{option.name || 'Landlord'}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{option.propertyName || option.email}</Typography>
                      </Box>
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Box>
      <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, minHeight: 0, textAlign: 'center', px: 2, bgcolor: 'background.paper' }}>
        <Box sx={{ width: 82, height: 82, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'grid', placeItems: 'center', mb: 2 }}>
          <AppIcon name="messages" size={38} />
        </Box>
        <Typography variant="h5" fontWeight={700}>You’re starting a new conversation</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Type your first message below.</Typography>
      </Stack>
      <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${messagesDivider}`, bgcolor: 'background.paper' }}>
        {sendError && <Alert severity="error" sx={{ mb: 1 }}>{sendError}</Alert>}
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth multiline maxRows={4} size="small"
            placeholder={landlord ? 'Type your first message…' : 'Choose a landlord to start messaging'}
            value={draft}
            disabled={!landlord || isSending}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                onSend();
              }
            }}
            slotProps={{ htmlInput: { maxLength, 'aria-label': 'First message' } }}
          />
          <IconButton aria-label="Send first message" color="primary" disabled={!landlord || !draft.trim() || isSending} onClick={onSend}>
            {isSending ? <CircularProgress size={20} /> : <AppIcon name="send" />}
          </IconButton>
        </Stack>
      </Box>
    </>
  );
}
