import { useCallback, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, IconButton, List, ListItem, ListItemText, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import TeamOutlined from '@ant-design/icons/TeamOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';

import {
  addGroupParticipant, createGroupConversation, discoverGroupParticipants,
  leaveGroupConversation, removeGroupParticipant
} from 'api/conversation';

const errorMessage = (error, fallback) => {
  if (error?.response?.status === 401) return 'Your session expired. Sign in again to manage group conversations.';
  if (error?.response?.status === 403) return 'You are not authorized to manage group conversations for this organization.';
  return error?.response?.data?.message || fallback;
};

export default function GroupConversationManager({ organizationId, conversation, currentUserId, onChanged, onLeft }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isGroup = Boolean(conversation?.isGroupChat ?? conversation?.IsGroupChat);
  const participants = useMemo(() => (conversation?.participants || conversation?.Participants || []).filter((item) => item.isActive !== false), [conversation]);
  const participantIds = useMemo(() => new Set(participants.map((item) => String(item.userId ?? item.UserId))), [participants]);

  const loadPeople = useCallback(async () => {
    if (!Number.isSafeInteger(Number(organizationId)) || Number(organizationId) <= 0) {
      setError('Select an organization before creating or managing a group conversation.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setPeople(await discoverGroupParticipants(Number(organizationId)));
    } catch (requestError) {
      setError(errorMessage(requestError, 'Participants could not be loaded. Try again.'));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const handleOpen = async () => {
    setOpen(true); setNotice(''); setError(''); setSelected([]); setTitle('');
    await loadPeople();
  };

  const create = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > 100 || selected.length < 1) {
      setError('Enter a title of 1–100 characters and choose at least one participant.');
      return;
    }
    setSaving(true); setError('');
    try {
      const group = await createGroupConversation({ organizationId: Number(organizationId), title: trimmed, participantUserIds: selected.map(Number) });
      setOpen(false);
      await onChanged?.(group?.id);
    } catch (requestError) {
      setError(errorMessage(requestError, 'The group could not be created. Review the participants and try again.'));
    } finally { setSaving(false); }
  };

  const add = async (userId) => {
    setSaving(true); setError(''); setNotice('');
    try {
      await addGroupParticipant(conversation.id, userId);
      setNotice('Participant added. New participants can only see activity from the time they joined.');
      await onChanged?.(conversation.id);
      await loadPeople();
    } catch (requestError) { setError(errorMessage(requestError, 'Participant could not be added.')); }
    finally { setSaving(false); }
  };

  const remove = async (userId) => {
    setSaving(true); setError(''); setNotice('');
    try {
      await removeGroupParticipant(conversation.id, userId);
      setNotice('Participant removed.');
      await onChanged?.(conversation.id);
    } catch (requestError) { setError(errorMessage(requestError, 'Participant could not be removed.')); }
    finally { setSaving(false); }
  };

  const leave = async () => {
    if (!window.confirm('Leave this group conversation? You will no longer receive its messages.')) return;
    setSaving(true); setError('');
    try {
      await leaveGroupConversation(conversation.id);
      setOpen(false);
      await onLeft?.();
    } catch (requestError) { setError(errorMessage(requestError, 'You could not leave this group. Another group admin may need to be assigned first.')); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Button variant={isGroup ? 'outlined' : 'contained'} startIcon={<TeamOutlined />} onClick={handleOpen} size="small">
        {isGroup ? 'Manage group' : 'New group'}
      </Button>
      <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isGroup ? `Manage ${conversation?.title || 'group'}` : 'Create group conversation'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error" action={!loading && <Button color="inherit" size="small" onClick={loadPeople}>Retry</Button>}>{error}</Alert>}
            {notice && <Alert severity="success">{notice}</Alert>}
            {loading ? <Stack direction="row" spacing={1} justifyContent="center"><CircularProgress size={20} /><Typography>Loading participants…</Typography></Stack> : isGroup ? (
              <>
                <Typography variant="subtitle2">Current participants</Typography>
                <List dense disablePadding>
                  {participants.map((person) => {
                    const id = person.userId ?? person.UserId;
                    const name = person.userName ?? person.UserName ?? `User ${id}`;
                    return <ListItem key={id} secondaryAction={String(id) !== String(currentUserId) && <Tooltip title="Remove participant"><span><IconButton disabled={saving} aria-label={`Remove ${name}`} onClick={() => remove(id)}><DeleteOutlined /></IconButton></span></Tooltip>}>
                      <ListItemText primary={name} secondary={(person.isAdmin ?? person.IsAdmin) ? 'Group admin' : 'Participant'} />
                    </ListItem>;
                  })}
                </List>
                <Typography variant="subtitle2">Add participant</Typography>
                {people.filter((person) => !participantIds.has(String(person.userId))).length === 0 ? <Typography color="text.secondary" variant="body2">No additional eligible participants.</Typography> : (
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {people.filter((person) => !participantIds.has(String(person.userId))).map((person) => <Chip key={person.userId} label={`${person.displayName}${person.isStaff ? ' · Staff' : ''}`} onClick={() => add(person.userId)} disabled={saving} />)}
                  </Stack>
                )}
                <Box><Button color="error" variant="outlined" disabled={saving} onClick={leave}>Leave group</Button></Box>
              </>
            ) : (
              <>
                <TextField label="Group title" value={title} onChange={(event) => setTitle(event.target.value.slice(0, 100))} helperText={`${title.length}/100`} required />
                <Typography variant="subtitle2">Participants</Typography>
                {people.filter((person) => String(person.userId) !== String(currentUserId)).map((person) => <FormControlLabel key={person.userId} control={<Checkbox checked={selected.includes(String(person.userId))} onChange={(event) => setSelected((current) => event.target.checked ? [...current, String(person.userId)] : current.filter((id) => id !== String(person.userId)))} />} label={`${person.displayName}${person.isStaff ? ' (staff)' : ''}`} />)}
                {!people.length && !error && <Alert severity="info">No eligible participants were found in this organization.</Alert>}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Close</Button>
          {!isGroup && <Button variant="contained" onClick={create} disabled={saving || loading}>{saving ? 'Creating…' : 'Create group'}</Button>}
        </DialogActions>
      </Dialog>
    </>
  );
}
