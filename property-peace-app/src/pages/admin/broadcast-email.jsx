import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  InputAdornment,
  alpha,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { SendOutlined, RobotOutlined, MailOutlined, UserOutlined, HistoryOutlined } from '@ant-design/icons';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const SIGNATURE_BLOCK = `If there are any questions, you can reach out to me directly.

Thomas Brown
Cell: (864) 324-7107
Email: tbrown@brownstonehub.com`;
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { adminBroadcastEmailAPI } from 'api/admin/broadcast-email';
import { adminUserAPI } from 'api/admin/user';
import { openSnackbar } from 'api/snackbar';

export default function AdminBroadcastEmail() {
  const theme = useTheme();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientMode, setRecipientMode] = useState('all'); // 'all' | 'selected'
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState(null);
  const [emailHistory, setEmailHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true);
      try {
        const res = await adminUserAPI.getAllUsers(false);
        if (res?.success && Array.isArray(res.data)) {
          setUsers(res.data.filter((u) => !u.isDeleted && u.email));
        } else {
          setUsers([]);
        }
      } catch (e) {
        console.error(e);
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, []);

  const handleImproveWithAI = async () => {
    setImproving(true);
    setError(null);
    try {
      const res = await adminBroadcastEmailAPI.improveBroadcastMessage({ subject, body });
      if (res?.success) {
        if (res.subject != null) setSubject(res.subject);
        if (res.body != null) setBody(res.body);
        openSnackbar({
          open: true,
          message: 'Message improved with AI',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        setError(res?.message || 'Failed to improve message. AI may not be configured.');
        openSnackbar({
          open: true,
          message: res?.message || 'Failed to improve message',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to improve message';
      setError(msg);
      openSnackbar({
        open: true,
        message: msg,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setImproving(false);
    }
  };

  const handleSend = async () => {
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      openSnackbar({
        open: true,
        message: 'Subject and message body are required',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    if (recipientMode === 'selected' && selectedUserIds.length === 0) {
      openSnackbar({
        open: true,
        message: 'Select at least one user when using "Selected users"',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setSending(true);
    setError(null);
    try {
      const payload = {
        subject: trimmedSubject,
        body: trimmedBody,
        userIds: recipientMode === 'selected' ? selectedUserIds.map((id) => Number(id)) : undefined
      };
      const res = await adminBroadcastEmailAPI.sendBroadcastEmail(payload);
      if (res?.success && (res.sentCount ?? 0) > 0) {
        const recipients =
          recipientMode === 'selected'
            ? users.filter((u) => selectedUserIds.includes(u.id))
            : users;
        setEmailHistory((prev) => [
          {
            id: Date.now(),
            sentAt: new Date(),
            subject: trimmedSubject,
            recipients: recipients.map((u) => ({
              name: [u.firstName || u.firstname, u.lastName || u.lastname].filter(Boolean).join(' ') || '—',
              email: u.email || '—'
            }))
          },
          ...prev
        ]);
        openSnackbar({
          open: true,
          message: res.message || `Email sent to ${res.sentCount} recipient(s).`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else if (res?.success && (res.sentCount ?? 0) === 0) {
        const msg = res.message || 'Email could not be delivered to any recipient. Check email service configuration (e.g. Azure Communication Services).';
        setError(msg);
        openSnackbar({
          open: true,
          message: msg,
          variant: 'alert',
          alert: { color: 'error' }
        });
      } else {
        setError(res?.message || 'Failed to send email');
        openSnackbar({
          open: true,
          message: res?.message || 'Failed to send email',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to send email';
      setError(msg);
      openSnackbar({
        open: true,
        message: msg,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSending(false);
    }
  };

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    const ids = users.map((u) => u.id);
    setSelectedUserIds(ids);
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid size={12}>
          <PageBreadcrumbs title="Broadcast Email" />
        </Grid>
        <Grid size={12}>
          <MainCard>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h4" sx={{ mb: 0.5 }}>
                  Send announcement or warning
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Email all or selected users about app issues, maintenance, or announcements.
                </Typography>
              </Box>

              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              <FormControl component="fieldset">
                <FormLabel component="legend">Recipients</FormLabel>
                <RadioGroup
                  row
                  value={recipientMode}
                  onChange={(e) => setRecipientMode(e.target.value)}
                >
                  <FormControlLabel value="all" control={<Radio />} label="All users (with email)" />
                  <FormControlLabel value="selected" control={<Radio />} label="Selected users only" />
                </RadioGroup>
              </FormControl>

              {recipientMode === 'selected' && (
                <Box
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04)
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Select users</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={selectAllUsers}>
                        Select all
                      </Button>
                      <Button size="small" variant="outlined" onClick={clearSelection}>
                        Clear
                      </Button>
                    </Stack>
                  </Stack>
                  {loadingUsers ? (
                    <Box display="flex" justifyContent="center" py={2}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <TableContainer sx={{ maxHeight: 220 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox" />
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Roles</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {users.map((u) => (
                            <TableRow key={u.id} hover>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={selectedUserIds.includes(u.id)}
                                  onChange={() => toggleUser(u.id)}
                                />
                              </TableCell>
                              <TableCell>
                                {[u.firstName || u.firstname, u.lastName || u.lastname].filter(Boolean).join(' ') || '—'}
                              </TableCell>
                              <TableCell>{u.email || '—'}</TableCell>
                              <TableCell>{(u.roles || []).join(', ') || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {recipientMode === 'selected' && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {selectedUserIds.length} user(s) selected
                    </Typography>
                  )}
                </Box>
              )}

              <TextField
                fullWidth
                label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Scheduled maintenance – Feb 20"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MailOutlined style={{ color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  )
                }}
              />

              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Message body
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<UserOutlined />}
                      onClick={() => setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${SIGNATURE_BLOCK}` : SIGNATURE_BLOCK))}
                    >
                      Insert contact me
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={improving ? <CircularProgress size={16} /> : <RobotOutlined />}
                      onClick={handleImproveWithAI}
                      disabled={improving}
                    >
                      Improve with AI
                    </Button>
                  </Stack>
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={6}
                  maxRows={14}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your announcement or warning. Use {{FirstName}} for a personal greeting (e.g. Hello {{FirstName}},). The AI can add this for you."
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      
                    }
                  }}
                />
              </Box>

              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  variant="contained"
                  startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendOutlined />}
                  onClick={handleSend}
                  disabled={sending || !subject.trim() || !body.trim() || (recipientMode === 'selected' && selectedUserIds.length === 0)}
                  sx={{ px: 2.5 }}
                >
                  {sending ? 'Sending…' : 'Send email'}
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {recipientMode === 'all' && `Will send to ${users.length} user(s) with email.`}
                  {recipientMode === 'selected' && `Will send to ${selectedUserIds.length} selected user(s).`}
                </Typography>
              </Stack>

              {emailHistory.length > 0 && (
                <Box sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                    <HistoryOutlined />
                    Email history
                  </Typography>
                  {emailHistory.map((entry) => (
                    <Accordion
                      key={entry.id}
                      disableGutters
                      sx={{ boxShadow: 'none', border: 1, borderColor: 'divider', '&:not(:last-child)': { mb: 1 }, '&::before': { display: 'none' } }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%', pr: 1 }}>
                          <Typography variant="subtitle2">{entry.subject}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(entry.sentAt).toLocaleString()} · {entry.recipients.length} recipient{entry.recipients.length !== 1 ? 's' : ''}
                          </Typography>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Sent to:
                        </Typography>
                        <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
                          {entry.recipients.map((r, i) => (
                            <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                              <ListItemText primary={r.name} secondary={r.email} primaryTypographyProps={{ variant: 'body2' }} secondaryTypographyProps={{ variant: 'caption' }} />
                            </ListItem>
                          ))}
                        </List>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Box>
              )}
            </Stack>
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
