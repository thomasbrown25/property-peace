import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import {
  ArrowLeftOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  LoginOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { adminUserAPI } from 'api/admin/user';
import { adminSubscriptionAPI } from 'api/admin/subscription';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import { getPostLoginRedirectPath } from 'utils/authRedirect';
import { getAdminUserSubscriptionState } from 'utils/adminUserSubscription';

const getField = (source, ...keys) => keys.map((key) => source?.[key]).find((value) => value !== undefined && value !== null && value !== '');

const getDisplayName = (user) => {
  const firstName = getField(user, 'firstName', 'firstname', 'FirstName', 'Firstname') || '';
  const lastName = getField(user, 'lastName', 'lastname', 'LastName', 'Lastname') || '';
  return `${firstName} ${lastName}`.trim() || getField(user, 'email', 'Email') || 'User';
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1900) return 'N/A';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 1900) return 'N/A';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const roleChipColor = (role) => {
  const normalized = role?.toLowerCase?.() || '';
  if (normalized === 'admin') return 'error';
  if (normalized === 'landlord') return 'primary';
  if (normalized === 'tenant') return 'secondary';
  return 'default';
};

const StatCard = ({ title, value, icon, color = 'primary', subtitle }) => {
  const theme = useTheme();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: `${color}.main`,
              bgcolor: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1)
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" noWrap>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function AdminUserDetail() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { userId } = useParams();
  const { startImpersonation, impersonation } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [impersonationDialogOpen, setImpersonationDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [supportReference, setSupportReference] = useState('');
  const [impersonationError, setImpersonationError] = useState('');
  const [startingImpersonation, setStartingImpersonation] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [lifetimeDialogOpen, setLifetimeDialogOpen] = useState(false);
  const [assigningLifetime, setAssigningLifetime] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await adminUserAPI.getAllUsers(true);

        if (!response.success) {
          const message = response.message || 'Failed to load user';
          setError(message);
          openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'error' } });
          return;
        }

        const foundUser = (response.data || []).find((item) => String(item.id ?? item.Id) === String(userId));
        if (!foundUser) {
          setError('User not found');
          setUser(null);
          return;
        }

        setUser(foundUser);
        setSubscriptionLoading(true);
        setSubscriptionError('');
        try {
          const subscriptionResponse = await adminSubscriptionAPI.getUserSubscription(foundUser.id ?? foundUser.Id);
          if (subscriptionResponse.success) {
            setSubscription(subscriptionResponse.data || null);
          } else {
            setSubscription(null);
            setSubscriptionError(subscriptionResponse.message || 'Unable to load subscription');
          }
        } catch (subscriptionErr) {
          if (subscriptionErr?.response?.status === 404) {
            setSubscription(null);
          } else {
            console.error('Error loading user subscription:', subscriptionErr);
            setSubscriptionError(subscriptionErr?.response?.data?.message || 'Unable to load subscription');
          }
        } finally {
          setSubscriptionLoading(false);
        }
      } catch (err) {
        console.error('Error loading user:', err);
        setError('Failed to load user');
        openSnackbar({ open: true, message: 'Failed to load user', variant: 'alert', alert: { color: 'error' } });
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId]);

  const details = useMemo(() => {
    if (!user) return null;

    const roles = getField(user, 'roles', 'Roles') || [];
    const organizations = getField(user, 'organizations', 'Organizations') || [];
    const loginCount = getField(user, 'loginCount', 'LoginCount') ?? 0;
    const lastLogin = getField(user, 'lastLogin', 'LastLogin');
    const lastVisited = getField(user, 'lastVisited', 'LastVisited');
    const createdAt = getField(user, 'createDate', 'CreateDate');
    const suspendedAt = getField(user, 'suspendedAt', 'SuspendedAt');
    const deletedAt = getField(user, 'deletedAt', 'DeletedAt');

    const activity = [
      { label: 'Account created', value: formatDateTime(createdAt), icon: <CalendarOutlined /> },
      { label: 'Last login', value: formatDateTime(lastLogin), icon: <LoginOutlined /> },
      { label: 'Last visited', value: formatDateTime(lastVisited), icon: <ClockCircleOutlined /> },
      ...(suspendedAt ? [{ label: 'Suspended', value: formatDateTime(suspendedAt), icon: <SafetyCertificateOutlined /> }] : []),
      ...(deletedAt ? [{ label: 'Deleted', value: formatDateTime(deletedAt), icon: <SafetyCertificateOutlined /> }] : [])
    ];

    return { roles, organizations, loginCount, lastLogin, lastVisited, createdAt, activity };
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !user || !details) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/users')} sx={{ alignSelf: 'flex-start' }}>
          Back to users
        </Button>
        <Alert severity="error">{error || 'User not found'}</Alert>
      </Stack>
    );
  }

  const name = getDisplayName(user);
  const email = getField(user, 'email', 'Email') || 'N/A';
  const phone = getField(user, 'phoneNumber', 'PhoneNumber') || 'N/A';
  const authProvider = getField(user, 'authProvider', 'AuthProvider') || 'Email';
  const isDeleted = Boolean(getField(user, 'isDeleted', 'IsDeleted'));
  const isSuspended = Boolean(getField(user, 'isSuspended', 'IsSuspended'));
  const businessName = getField(user, 'businessName', 'BusinessName', 'company', 'Company');
  const currentOrganizationName = getField(user, 'currentOrganizationName', 'CurrentOrganizationName');
  const currentOrganizationRole = getField(user, 'currentOrganizationRole', 'CurrentOrganizationRole');
  const profileImageUrl = getField(user, 'profileImageUrl', 'ProfileImageUrl');
  const isExplicitlyInactive = getField(user, 'isActive', 'IsActive') === false;
  const isAdminTarget = details.roles.some((role) => String(role?.name ?? role?.Name ?? role).toLowerCase() === 'admin');
  const isLandlordTarget = details.roles.some((role) => String(role?.name ?? role?.Name ?? role).toLowerCase() === 'landlord');
  const canImpersonate = !isAdminTarget && !isDeleted && !isSuspended && !isExplicitlyInactive && !impersonation;
  const subscriptionDetails = getAdminUserSubscriptionState(subscription);
  const canAssignLifetime = isLandlordTarget && !isDeleted && !isSuspended && !isExplicitlyInactive && !subscriptionDetails.isLifetime;

  const handleStartImpersonation = async () => {
    if (!reason.trim()) {
      setImpersonationError('A reason is required for the audit log.');
      return;
    }
    setStartingImpersonation(true);
    setImpersonationError('');
    try {
      const result = await startImpersonation(getField(user, 'id', 'Id'), reason, supportReference);
      openSnackbar({ open: true, message: `Now logged in as ${name}`, variant: 'alert', alert: { color: 'warning' } });
      window.location.replace(getPostLoginRedirectPath(result.user));
    } catch (err) {
      setImpersonationError(err?.message || 'Unable to start impersonation.');
      setStartingImpersonation(false);
    }
  };

  const handleAssignLifetime = async () => {
    setAssigningLifetime(true);
    setSubscriptionError('');
    try {
      const response = await adminSubscriptionAPI.assignLifetimePlan({
        userId: getField(user, 'id', 'Id'),
        email: getField(user, 'email', 'Email')
      });

      if (!response.success) {
        throw new Error(response.message || 'Unable to assign Lifetime Plan');
      }

      setSubscription(response.data || null);
      setLifetimeDialogOpen(false);
      openSnackbar({
        open: true,
        message: `Lifetime Plan assigned to ${name}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Unable to assign Lifetime Plan';
      setSubscriptionError(message);
      openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'error' } });
    } finally {
      setAssigningLifetime(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Button startIcon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/users')} sx={{ alignSelf: 'flex-start' }}>
        Back to users
      </Button>

      <MainCard>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={profileImageUrl || undefined} sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: 28 }}>
              {name?.[0]?.toUpperCase() || <UserOutlined />}
            </Avatar>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h3">{name}</Typography>
                <Chip label={isDeleted ? 'Deleted' : isSuspended ? 'Suspended' : 'Active'} color={isDeleted ? 'error' : isSuspended ? 'warning' : 'success'} size="small" />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
                  <MailOutlined />
                  <Typography variant="body2">{email}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
                  <PhoneOutlined />
                  <Typography variant="body2">{phone}</Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
            {canImpersonate && (
              <Button variant="contained" color="warning" startIcon={<LoginOutlined />} onClick={() => setImpersonationDialogOpen(true)}>
                Log in as user
              </Button>
            )}
            {details.roles.length ? details.roles.map((role) => <Chip key={role} label={role} color={roleChipColor(role)} />) : <Chip label="No Role" />}
          </Stack>
        </Stack>
      </MainCard>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Login count" value={details.loginCount} icon={<LoginOutlined />} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Last login" value={formatDate(details.lastLogin)} icon={<ClockCircleOutlined />} color="success" subtitle={formatDateTime(details.lastLogin)} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Organizations" value={details.organizations.length} icon={<ApartmentOutlined />} color="secondary" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard title="Created" value={formatDate(details.createdAt)} icon={<CalendarOutlined />} color="warning" />
        </Grid>
      </Grid>

      <MainCard
        title="Subscription access"
        secondary={
          subscriptionDetails.isLifetime ? <Chip icon={<CrownOutlined />} label="Lifetime access" color="success" size="small" /> : null
        }
      >
        {subscriptionLoading ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">Loading subscription…</Typography>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            {subscriptionError && <Alert severity="error">{subscriptionError}</Alert>}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Current plan</Typography>
                  <Typography variant="h5">{subscriptionDetails.planName}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Billing cycle</Typography>
                  <Typography variant="body1">{subscriptionDetails.billingCycle}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Typography variant="body1">{subscriptionDetails.status}</Typography>
                </Box>
              </Stack>
              <Button
                variant="contained"
                color="success"
                startIcon={<CrownOutlined />}
                disabled={!canAssignLifetime || assigningLifetime}
                onClick={() => setLifetimeDialogOpen(true)}
                sx={{ minWidth: 190 }}
              >
                {subscriptionDetails.isLifetime ? 'Lifetime assigned' : 'Assign Lifetime Plan'}
              </Button>
            </Stack>
            {!isLandlordTarget && (
              <Typography variant="caption" color="text.secondary">
                Lifetime plans can only be assigned to landlord accounts.
              </Typography>
            )}
          </Stack>
        )}
      </MainCard>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <MainCard title="Account details">
            <Stack spacing={2}>
              {[
                ['User ID', getField(user, 'id', 'Id')],
                ['Email', email],
                ['Phone', phone],
                ['Auth provider', authProvider === 'Email,Google' ? 'Email, Google' : authProvider],
                ['Has password', getField(user, 'hasPassword', 'HasPassword') ? 'Yes' : 'No'],
                ['Business / Company', businessName || 'N/A'],
                ['Current organization', currentOrganizationName || 'N/A'],
                ['Current organization role', currentOrganizationRole || 'N/A']
              ].map(([label, value]) => (
                <Box key={label}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography variant="body1">{value}</Typography>
                </Box>
              ))}
            </Stack>
          </MainCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <MainCard title="Activity">
            <Stack spacing={0} divider={<Divider flexItem />}>
              {details.activity.map((item) => (
                <Stack key={item.label} direction="row" spacing={2} alignItems="center" sx={{ py: 1.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2">{item.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.value}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </MainCard>
        </Grid>
      </Grid>

      <MainCard title="Organizations">
        {details.organizations.length === 0 ? (
          <Box textAlign="center" py={4}>
            <TeamOutlined style={{ fontSize: 48, color: theme.palette.text.disabled }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>
              No organizations connected
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Organization</strong></TableCell>
                  <TableCell><strong>Role</strong></TableCell>
                  <TableCell><strong>Current</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {details.organizations.map((org) => (
                  <TableRow key={org.id ?? org.Id} hover>
                    <TableCell>{org.name ?? org.Name ?? 'N/A'}</TableCell>
                    <TableCell>
                      <Chip label={org.role ?? org.Role ?? 'Member'} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {String(org.id ?? org.Id) === String(getField(user, 'currentOrganizationId', 'CurrentOrganizationId')) ? (
                        <Chip label="Current" size="small" color="success" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>

      <Dialog open={lifetimeDialogOpen} onClose={assigningLifetime ? undefined : () => setLifetimeDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Assign Lifetime Plan to {name}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This grants permanent Premium access with no recurring charge. If this account has an active paid Stripe subscription, it will be cancelled immediately and replaced with the Lifetime Plan.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLifetimeDialogOpen(false)} disabled={assigningLifetime}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleAssignLifetime}
            disabled={assigningLifetime}
            startIcon={assigningLifetime ? <CircularProgress size={16} color="inherit" /> : <CrownOutlined />}
          >
            {assigningLifetime ? 'Assigning…' : 'Assign Lifetime Plan'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={impersonationDialogOpen} onClose={startingImpersonation ? undefined : () => setImpersonationDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Log in as {name}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Impersonation is isolated to this tab. If the browser copies session data into a newly opened tab, that tab detects the different owner and discards the impersonation session. Your administrator session remains available in other tabs.
          </DialogContentText>
          <Stack spacing={2}>
            <TextField
              autoFocus
              required
              fullWidth
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              error={Boolean(impersonationError && !reason.trim())}
              helperText="Required for the impersonation audit log"
              inputProps={{ maxLength: 500 }}
            />
            <TextField
              fullWidth
              label="Support reference (optional)"
              value={supportReference}
              onChange={(event) => setSupportReference(event.target.value)}
              placeholder="Ticket or case number"
              inputProps={{ maxLength: 100 }}
            />
            {impersonationError && <Alert severity="error">{impersonationError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImpersonationDialogOpen(false)} disabled={startingImpersonation}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleStartImpersonation} disabled={!reason.trim() || startingImpersonation} startIcon={startingImpersonation ? <CircularProgress size={16} color="inherit" /> : <LoginOutlined />}>
            {startingImpersonation ? 'Starting…' : 'Log in as user'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
