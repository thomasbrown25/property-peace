import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
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
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  MailOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import CreateOrganizationDialog from 'components/organization/CreateOrganizationDialog';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import { getCurrentOrganization } from 'api/organization';
import { getMembers, removeMember, updateMember } from 'api/organizationMember';
import { createInvite, deleteInvite, getInvites, resendInvite } from 'api/organizationInvite';

const ROLE_DETAILS = {
  Owner: {
    description: 'Full organization access, including billing and team management.',
    permissions: ['All organization access', 'Billing and team management'],
    color: 'primary'
  },
  Manager: {
    description: 'Runs day-to-day property operations without billing or team access.',
    permissions: ['Properties, tenants, and leases', 'Maintenance operations'],
    color: 'success'
  },
  Viewer: {
    description: 'Read-only access for accountants, partners, or other stakeholders.',
    permissions: ['View organization information', 'No editing or management access'],
    color: 'default'
  }
};

const ROLE_PERMISSIONS = {
  Owner: {
    canManageProperties: true,
    canManageTenants: true,
    canManageLeases: true,
    canManageMaintenance: true,
    canManageBilling: true,
    canManageMembers: true
  },
  Manager: {
    canManageProperties: true,
    canManageTenants: true,
    canManageLeases: true,
    canManageMaintenance: true,
    canManageBilling: false,
    canManageMembers: false
  },
  Viewer: {
    canManageProperties: false,
    canManageTenants: false,
    canManageLeases: false,
    canManageMaintenance: false,
    canManageBilling: false,
    canManageMembers: false
  }
};

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const unwrap = (response) => response?.data ?? response?.Data ?? response ?? null;
const normalizeEmail = (value) => value.trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function getInitials(name, email) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return String(email || '?').slice(0, 2).toUpperCase();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function roleDetail(role) {
  return ROLE_DETAILS[role] || ROLE_DETAILS.Viewer;
}

function SummaryCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%', minHeight: 112, p: 2, borderRadius: 2.5, textAlign: 'left', cursor: 'pointer', font: 'inherit',
        color: 'text.primary', bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.13 : 0.055) : 'background.paper',
        border: `1px solid ${active ? alpha(color, 0.52) : alpha(theme.palette.divider, 0.16)}`,
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha('#061e35', 0.05)}`,
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.42), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.25)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 750 }}>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function RoleChip({ role }) {
  const details = roleDetail(role);
  return <Chip size="small" color={details.color} variant={role === 'Viewer' ? 'outlined' : 'filled'} label={role || 'Viewer'} sx={{ height: 24, fontWeight: 700, fontSize: '0.7rem' }} />;
}

function EmptyState({ filtered, onInvite, canManage }) {
  return (
    <Stack alignItems="center" spacing={1.4} sx={{ py: 8, px: 2, textAlign: 'center' }}>
      <Avatar sx={{ width: 52, height: 52, bgcolor: alpha('#16a34a', 0.1), color: 'success.main' }}><TeamOutlined /></Avatar>
      <Typography variant="h5" fontWeight={750}>{filtered ? 'No people match this view' : 'Build your property team'}</Typography>
      <Typography sx={{ maxWidth: 480, color: 'text.secondary', fontSize: '0.85rem' }}>
        {filtered ? 'Try a different search or reset the status filter.' : 'Invite teammates by email. People with an account can join immediately; everyone else can create one from the same link.'}
      </Typography>
      {!filtered && canManage && <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={onInvite} sx={{ mt: 0.5, textTransform: 'none', fontWeight: 700 }}>Invite a teammate</Button>}
    </Stack>
  );
}

function TeamRow({ item, canManage, isCurrentUser, onEdit, onRemove, onResend, onCancel }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const isInvite = item.kind === 'invite';
  const name = isInvite ? item.email : item.name;
  const secondary = isInvite ? `Invited ${formatDate(item.createdAt)}` : item.email;

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 }, py: 1.45, display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(250px, 1.7fr) minmax(105px, .65fr) minmax(155px, .9fr) minmax(125px, .7fr) 44px',
        gap: { xs: 1.25, md: 2 }, alignItems: 'center', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.025) }
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.35} minWidth={0}>
        <Avatar sx={{ width: 42, height: 42, fontSize: '0.78rem', fontWeight: 750, bgcolor: isInvite ? alpha(theme.palette.warning.main, 0.13) : alpha(theme.palette.primary.main, 0.12), color: isInvite ? 'warning.dark' : 'primary.main' }}>
          {isInvite ? <MailOutlined /> : getInitials(name, item.email)}
        </Avatar>
        <Box minWidth={0}>
          <Stack direction="row" spacing={0.7} alignItems="center">
            <Typography fontWeight={700} noWrap>{name || item.email}</Typography>
            {isCurrentUser && <Chip label="You" size="small" sx={{ height: 19, fontSize: '0.62rem' }} />}
          </Stack>
          <Typography noWrap sx={{ mt: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>{secondary}</Typography>
        </Box>
      </Stack>

      <Box><RoleChip role={item.role} /></Box>

      <Box>
        <Chip
          size="small"
          icon={isInvite ? <MailOutlined /> : <CheckCircleOutlined />}
          label={isInvite ? 'Invitation pending' : 'Active member'}
          color={isInvite ? 'warning' : 'success'}
          variant="outlined"
          sx={{ height: 26, fontSize: '0.68rem', fontWeight: 650 }}
        />
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 650 }}>{isInvite ? `Expires ${formatDate(item.expiresAt)}` : `Joined ${formatDate(item.joinedAt)}`}</Typography>
        <Typography sx={{ mt: 0.2, fontSize: '0.68rem', color: 'text.secondary' }}>{isInvite ? `Sent by ${item.invitedByName || 'your team'}` : roleDetail(item.role).description}</Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        {canManage && !(isCurrentUser && item.role === 'Owner') && (
          <>
            <Tooltip title="Team member actions"><IconButton size="small" aria-label={`Actions for ${name}`} onClick={(event) => setAnchorEl(event.currentTarget)}><MoreOutlined /></IconButton></Tooltip>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
              {isInvite ? [
                <MenuItem key="resend" onClick={() => { setAnchorEl(null); onResend(item); }}><ReloadOutlined style={{ marginRight: 10 }} />Resend invitation</MenuItem>,
                <MenuItem key="cancel" onClick={() => { setAnchorEl(null); onCancel(item); }} sx={{ color: 'error.main' }}><DeleteOutlined style={{ marginRight: 10 }} />Revoke invitation</MenuItem>
              ] : [
                <MenuItem key="edit" onClick={() => { setAnchorEl(null); onEdit(item); }}><EditOutlined style={{ marginRight: 10 }} />Change role</MenuItem>,
                <MenuItem key="remove" onClick={() => { setAnchorEl(null); onRemove(item); }} sx={{ color: 'error.main' }}><DeleteOutlined style={{ marginRight: 10 }} />Remove from organization</MenuItem>
              ]}
            </Menu>
          </>
        )}
      </Box>
    </Box>
  );
}

function InviteDialog({ open, organization, onClose, onCreated }) {
  const fullScreen = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Manager');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setEmail(''); setRole('Manager'); setError(''); }
  }, [open]);

  const submit = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) { setError('Enter a valid email address.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const response = await createInvite(organization.id, normalizedEmail, role);
      if (response?.success === false || response?.Success === false) throw new Error(response.message || response.Message || 'Could not send the invitation.');
      openSnackbar({ open: true, message: `Invitation sent to ${normalizedEmail}`, variant: 'alert', alert: { color: 'success' } });
      onCreated();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.Message || err?.message || 'Could not send the invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box><Typography variant="h4" fontWeight={750}>Invite to {organization?.name || 'your organization'}</Typography><Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.82rem' }}>One invitation works whether they already use Property Peace or are brand new.</Typography></Box>
          <IconButton onClick={onClose} disabled={submitting} aria-label="Close"><CloseOutlined /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Alert severity="info" icon={<MailOutlined />} sx={{ mb: 2.5, '& .MuiAlert-message': { width: '100%' } }}>
          <Typography fontWeight={700} sx={{ fontSize: '0.8rem' }}>We email them a secure invitation link</Typography>
          <Typography sx={{ mt: 0.3, fontSize: '0.75rem' }}>Existing users sign in and accept. New users create an account with this email and are placed directly into <strong>{organization?.name}</strong>—no separate organization is created.</Typography>
        </Alert>

        <Stack spacing={2.25}>
          <Box>
            <Typography sx={{ mb: 0.65, fontWeight: 700, fontSize: '0.78rem' }}>Email address</Typography>
            <OutlinedInput autoFocus fullWidth type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="teammate@company.com" startAdornment={<InputAdornment position="start"><MailOutlined /></InputAdornment>} onKeyDown={(event) => { if (event.key === 'Enter') submit(); }} />
            {error && <FormHelperText error>{error}</FormHelperText>}
          </Box>

          <Box>
            <Typography sx={{ mb: 0.65, fontWeight: 700, fontSize: '0.78rem' }}>Organization role</Typography>
            <FormControl fullWidth>
              <Select value={role} onChange={(event) => setRole(event.target.value)} IconComponent={DownOutlined}>
                {['Manager', 'Viewer', 'Owner'].map((option) => <MenuItem key={option} value={option}><Stack><Typography fontWeight={700} sx={{ fontSize: '0.82rem' }}>{option}</Typography><Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{roleDetail(option).description}</Typography></Stack></MenuItem>)}
              </Select>
            </FormControl>
            <Stack spacing={0.55} sx={{ mt: 1.2, p: 1.4, borderRadius: 1.5, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.035) }}>
              {roleDetail(role).permissions.map((permission) => <Stack key={permission} direction="row" spacing={0.8} alignItems="center"><CheckCircleOutlined style={{ color: '#16a34a', fontSize: 13 }} /><Typography sx={{ fontSize: '0.73rem' }}>{permission}</Typography></Stack>)}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" color="success" startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <MailOutlined />} onClick={submit} disabled={submitting} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>{submitting ? 'Sending…' : 'Send invitation'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function RoleDialog({ member, open, onClose, onSaved }) {
  const [role, setRole] = useState('Viewer');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (member) setRole(member.role); }, [member]);

  const save = async () => {
    setSaving(true);
    try {
      await updateMember(member.id, role, ROLE_PERMISSIONS[role]);
      openSnackbar({ open: true, message: `${member.name}'s role was updated`, variant: 'alert', alert: { color: 'success' } });
      onSaved();
      onClose();
    } catch (err) {
      openSnackbar({ open: true, message: err?.response?.data?.message || err?.message || 'Could not update the role', variant: 'alert', alert: { color: 'error' } });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle><Typography variant="h4" fontWeight={750}>Change organization role</Typography><Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.8rem' }}>{member?.name}</Typography></DialogTitle>
      <DialogContent><Select fullWidth value={role} onChange={(event) => setRole(event.target.value)}>{['Manager', 'Viewer', 'Owner'].map((option) => <MenuItem key={option} value={option}><Stack><Typography fontWeight={700}>{option}</Typography><Typography sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{roleDetail(option).description}</Typography></Stack></MenuItem>)}</Select><Alert severity="warning" sx={{ mt: 2, display: role === 'Owner' ? 'flex' : 'none' }}>Owners can manage billing, members, and every organization setting.</Alert></DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save role'}</Button></DialogActions>
    </Dialog>
  );
}

export default function Team() {
  const theme = useTheme();
  const { user } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const loadData = async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const organizationResponse = await getCurrentOrganization();
      const organizationData = unwrap(organizationResponse);
      if (!organizationData?.id) throw new Error('No organization is currently selected.');
      setOrganization(organizationData);
      const [membersResponse, invitesResponse] = await Promise.all([
        getMembers(organizationData.id),
        getInvites(organizationData.id)
      ]);
      setMembers(unwrap(membersResponse) || []);
      setInvites((unwrap(invitesResponse) || []).filter((invite) => !read(invite, 'isAccepted', 'IsAccepted')));
    } catch (err) {
      openSnackbar({ open: true, message: err?.response?.data?.message || err?.message || 'Could not load the organization team', variant: 'alert', alert: { color: 'error' } });
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  const normalizedMembers = useMemo(() => members.map((member) => ({
    kind: 'member',
    id: read(member, 'id', 'Id'),
    userId: read(member, 'userId', 'UserId'),
    name: read(member, 'userName', 'UserName') || read(member, 'name', 'Name') || read(member, 'userEmail', 'UserEmail'),
    email: read(member, 'userEmail', 'UserEmail') || read(member, 'email', 'Email'),
    role: read(member, 'role', 'Role') || 'Viewer',
    joinedAt: read(member, 'joinedAt', 'JoinedAt'),
    canManageMembers: Boolean(read(member, 'canManageMembers', 'CanManageMembers'))
  })), [members]);

  const normalizedInvites = useMemo(() => invites.map((invite) => ({
    kind: 'invite',
    id: read(invite, 'id', 'Id'),
    email: read(invite, 'email', 'Email'),
    role: read(invite, 'role', 'Role') || 'Viewer',
    createdAt: read(invite, 'createdAt', 'CreatedAt'),
    expiresAt: read(invite, 'expiresAt', 'ExpiresAt'),
    invitedByName: read(invite, 'invitedByName', 'InvitedByName')
  })), [invites]);

  const currentUserId = Number(user?.id ?? user?.Id);
  const currentMember = normalizedMembers.find((member) => Number(member.userId) === currentUserId);
  const currentRole = organization?.userRole || organization?.UserRole || user?.currentOrganizationRole || user?.CurrentOrganizationRole || currentMember?.role;
  const canManage = currentRole === 'Owner' || currentMember?.canManageMembers;
  const allPeople = useMemo(() => [...normalizedMembers, ...normalizedInvites], [normalizedMembers, normalizedInvites]);

  const visiblePeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allPeople.filter((item) => {
      if (query && !`${item.name || ''} ${item.email || ''} ${item.role || ''}`.toLowerCase().includes(query)) return false;
      if (status === 'active' && item.kind !== 'member') return false;
      if (status === 'invited' && item.kind !== 'invite') return false;
      if (roleFilter !== 'all' && item.role !== roleFilter) return false;
      return true;
    }).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'invite' ? -1 : 1;
      return String(a.name || a.email).localeCompare(String(b.name || b.email));
    });
  }, [allPeople, roleFilter, search, status]);

  const owners = normalizedMembers.filter((member) => member.role === 'Owner').length;
  const managers = normalizedMembers.filter((member) => member.role === 'Manager').length;
  const filtered = Boolean(search || status !== 'all' || roleFilter !== 'all');

  const confirmAndRun = async (message, action, successMessage) => {
    if (!window.confirm(message)) return;
    try {
      await action();
      openSnackbar({ open: true, message: successMessage, variant: 'alert', alert: { color: 'success' } });
      await loadData(true);
    } catch (err) {
      openSnackbar({ open: true, message: err?.response?.data?.message || err?.response?.data?.Message || err?.message || 'The action could not be completed', variant: 'alert', alert: { color: 'error' } });
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}><PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Team & staff' }]} /></Box>

      <Box sx={{ mb: 2.5, p: { xs: 2, md: 2.75 }, borderRadius: 3, color: '#fff', background: 'linear-gradient(120deg, #061e35 0%, #0b3558 100%)', boxShadow: `0 16px 38px ${alpha('#061e35', 0.18)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box><Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Team & staff</Typography><Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>Manage who can access {organization?.name || 'your organization'}, what they can do, and invitations waiting to be accepted.</Typography></Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              startIcon={<PlusOutlined />}
              onClick={() => setCreateOrganizationOpen(true)}
              sx={{ color: '#fff', borderColor: alpha('#fff', 0.42), textTransform: 'none', fontWeight: 700, '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
            >
              Create organization
            </Button>
            {canManage && <Button variant="contained" color="success" startIcon={<MailOutlined />} onClick={() => setInviteOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>Invite teammate</Button>}
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="Active members" value={normalizedMembers.length} helper="People with organization access" icon={<TeamOutlined />} color={theme.palette.success.main} active={status === 'active'} onClick={() => setStatus((value) => value === 'active' ? 'all' : 'active')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="Pending invites" value={normalizedInvites.length} helper="Waiting for acceptance" icon={<MailOutlined />} color={theme.palette.warning.main} active={status === 'invited'} onClick={() => setStatus((value) => value === 'invited' ? 'all' : 'invited')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="Managers" value={managers} helper="Day-to-day operations access" icon={<SafetyCertificateOutlined />} color={theme.palette.primary.main} active={roleFilter === 'Manager'} onClick={() => setRoleFilter((value) => value === 'Manager' ? 'all' : 'Manager')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="Owners" value={owners} helper="Full access and billing" icon={<UserOutlined />} color={theme.palette.secondary.main} active={roleFilter === 'Owner'} onClick={() => setRoleFilter((value) => value === 'Owner' ? 'all' : 'Owner')} /></Grid>
      </Grid>

      {!canManage && !loading && <Alert severity="info" sx={{ mb: 2 }}>You can view the organization team. An owner or teammate with member-management access can send invitations and change roles.</Alert>}

      <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} alignItems={{ md: 'center' }}>
            <OutlinedInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, emails, or roles" size="small" startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>} sx={{ flex: 1, minWidth: { md: 260 }, borderRadius: 1.75 }} />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, md: 0 } }}>
              <Select size="small" value={status} onChange={(event) => setStatus(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 140, borderRadius: 1.75 }}><MenuItem value="all">All statuses</MenuItem><MenuItem value="active">Active members</MenuItem><MenuItem value="invited">Pending invites</MenuItem></Select>
              <Select size="small" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 126, borderRadius: 1.75 }}><MenuItem value="all">All roles</MenuItem><MenuItem value="Owner">Owners</MenuItem><MenuItem value="Manager">Managers</MenuItem><MenuItem value="Viewer">Viewers</MenuItem></Select>
              <Tooltip title="Refresh team"><span><IconButton onClick={() => loadData(true)} disabled={refreshing} aria-label="Refresh team">{refreshing ? <CircularProgress size={18} /> : <ReloadOutlined />}</IconButton></span></Tooltip>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}><Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>{visiblePeople.length} of {allPeople.length} people and invitations</Typography>{filtered && <Button size="small" onClick={() => { setSearch(''); setStatus('all'); setRoleFilter('all'); }} sx={{ textTransform: 'none' }}>Reset view</Button>}</Stack>
        </Box>
        <Divider />
        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(250px, 1.7fr) minmax(105px, .65fr) minmax(155px, .9fr) minmax(125px, .7fr) 44px', gap: 2, px: 2, py: 1.15, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
          {['Person', 'Role', 'Status', 'Access', ''].map((label) => <Typography key={label || 'actions'} sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>)}
        </Box>

        {loading ? <Stack alignItems="center" spacing={1} sx={{ py: 8 }}><CircularProgress size={26} /><Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>Loading your organization team…</Typography></Stack> : visiblePeople.length === 0 ? <EmptyState filtered={filtered} onInvite={() => setInviteOpen(true)} canManage={canManage} /> : visiblePeople.map((item) => (
          <TeamRow
            key={`${item.kind}-${item.id}`}
            item={item}
            canManage={canManage}
            isCurrentUser={item.kind === 'member' && Number(item.userId) === currentUserId}
            onEdit={setEditingMember}
            onRemove={(member) => confirmAndRun(`Remove ${member.name} from ${organization.name}? They will lose organization access immediately.`, () => removeMember(organization.id, member.id), `${member.name} was removed`)}
            onResend={async (invite) => { try { await resendInvite(invite.id); openSnackbar({ open: true, message: `A fresh invitation was sent to ${invite.email}`, variant: 'alert', alert: { color: 'success' } }); await loadData(true); } catch (err) { openSnackbar({ open: true, message: err?.response?.data?.message || err?.message || 'Could not resend the invitation', variant: 'alert', alert: { color: 'error' } }); } }}
            onCancel={(invite) => confirmAndRun(`Revoke the invitation for ${invite.email}? Their current link will stop working.`, () => deleteInvite(invite.id), `Invitation for ${invite.email} was revoked`)}
          />
        ))}
      </Box>

      <InviteDialog open={inviteOpen} organization={organization || {}} onClose={() => setInviteOpen(false)} onCreated={() => loadData(true)} />
      <CreateOrganizationDialog
        open={createOrganizationOpen}
        onClose={() => setCreateOrganizationOpen(false)}
        allowClose
        prefillUserName={false}
        title="Create another organization"
        description="Set up a separate organization for another company, portfolio, or team. You will become its owner and Property Peace will switch to it after creation."
      />
      <RoleDialog member={editingMember} open={Boolean(editingMember)} onClose={() => setEditingMember(null)} onSaved={() => loadData(true)} />
    </Box>
  );
}
