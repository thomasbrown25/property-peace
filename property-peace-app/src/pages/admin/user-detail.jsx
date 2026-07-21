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
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import {
  ArrowLeftOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  LoginOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { adminUserAPI } from 'api/admin/user';
import { openSnackbar } from 'api/snackbar';

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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    </Stack>
  );
}
