import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Divider,
  Grid,
  Button,
  Chip,
  IconButton,
  alpha,
  CircularProgress,
  Alert,
  Avatar,
  useTheme,
  Card,
  CardContent,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowLeftOutlined,
  UserOutlined,
  MailOutlined,
  EditOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';
import MainCard from 'components/MainCard';
import { staffMemberAPI } from 'api';
import { formatDate, formatDateAndTime, formatCurrency } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchTimeEntries from 'hooks/useFetchTimeEntries';

export default function StaffMemberPage() {
  const { staffMemberId } = useParams();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [staffMember, setStaffMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staffInvites, setStaffInvites] = useState([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);

  // Fetch time entries for this staff member
  const { timeEntries, loading: loadingTimeEntries } = useFetchTimeEntries({ 
    staffMemberId: staffMemberId ? parseInt(staffMemberId) : null 
  });

  // Fetch staff member details
  useEffect(() => {
    const fetchStaffMember = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await staffMemberAPI.getStaffMemberById(parseInt(staffMemberId));
        // Handle both response structures: response.data.success or response.success
        const staffData = response?.data?.success ? response.data.data : (response?.success ? response.data : null);
        
        if (staffData) {
          setStaffMember(staffData);
          
          // Fetch invites if staff member has no account
          if (!staffData.userId && !staffData.hasAccount) {
            try {
              const invitesResponse = await staffMemberAPI.getInvitesByStaffMemberId(parseInt(staffMemberId));
              const invitesData = invitesResponse?.data?.success ? invitesResponse.data.data : (invitesResponse?.success ? invitesResponse.data : []);
              if (Array.isArray(invitesData)) {
                setStaffInvites(invitesData);
              }
            } catch (err) {
              console.error('Error fetching invites:', err);
            }
          }
        } else {
          setError('Staff member not found');
        }
      } catch (err) {
        console.error('Error fetching staff member:', err);
        setError(err?.response?.data?.message || 'Failed to load staff member details');
      } finally {
        setLoading(false);
      }
    };

    if (staffMemberId) {
      fetchStaffMember();
    }
  }, [staffMemberId]);

  const displayName = useMemo(() => {
    if (!staffMember) return '';
    return staffMember.userName || 
      `${staffMember.firstName || staffMember.userFirstName || ''} ${staffMember.lastName || staffMember.userLastName || ''}`.trim() || 
      'Unknown Staff Member';
  }, [staffMember]);

  const displayEmail = useMemo(() => {
    if (!staffMember) return '';
    return staffMember.email || staffMember.userEmail || 'N/A';
  }, [staffMember]);

  const handleEdit = () => {
    if (staffMember) {
      // Open edit dialog - you might need to implement this
      navigate(`/landlord/staff-members?edit=${staffMember.id}`);
    }
  };

  const handleViewTimeEntries = () => {
    navigate(`/landlord/time-entries?staffMemberId=${staffMemberId}`);
  };

  const handleSendInvite = async () => {
    if (!staffMember || !displayEmail || displayEmail === 'N/A') {
      openSnackbar({
        open: true,
        message: 'Email is required to send an invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setSendingInvite(true);
      const inviteResponse = await staffMemberAPI.createInvite(parseInt(staffMemberId), displayEmail);
      
      // Check if user exists (409 status code means USER_EXISTS)
      // The error might be in the response structure
      if (inviteResponse?.response?.status === 409 || 
          (inviteResponse?.data && !inviteResponse.data.success && inviteResponse.data.message === 'USER_EXISTS')) {
        // User exists - show confirmation dialog
        setPendingInvite({ staffMemberId: parseInt(staffMemberId), email: displayEmail });
        setConfirmDialogOpen(true);
        setSendingInvite(false);
        return;
      }

      if (!inviteResponse?.data?.success) {
        throw new Error(inviteResponse?.data?.message || 'Failed to create invite');
      }

      // Refresh invites
      const invitesResponse = await staffMemberAPI.getInvitesByStaffMemberId(parseInt(staffMemberId));
      const invitesData = invitesResponse?.data?.success ? invitesResponse.data.data : (invitesResponse?.success ? invitesResponse.data : []);
      if (Array.isArray(invitesData)) {
        setStaffInvites(invitesData);
      }

      openSnackbar({
        open: true,
        message: 'Invitation sent successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });

      // Refresh staff member data
      const refreshResponse = await staffMemberAPI.getStaffMemberById(parseInt(staffMemberId));
      const refreshData = refreshResponse?.data?.success ? refreshResponse.data.data : (refreshResponse?.success ? refreshResponse.data : null);
      if (refreshData) {
        setStaffMember(refreshData);
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      // Check if error is about existing user
      if (error?.response?.status === 409 || 
          (error?.response?.data?.message && error.response.data.message.includes('USER_EXISTS'))) {
        setPendingInvite({ staffMemberId: parseInt(staffMemberId), email: displayEmail });
        setConfirmDialogOpen(true);
      } else {
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to send invitation',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } finally {
      setSendingInvite(false);
    }
  };

  const handleConfirmInvite = async () => {
    if (!pendingInvite) return;

    try {
      setSendingInvite(true);
      const inviteResponse = await staffMemberAPI.createInvite(pendingInvite.staffMemberId, pendingInvite.email);
      
      if (inviteResponse?.data?.success) {
        // Refresh invites
        const invitesResponse = await staffMemberAPI.getInvitesByStaffMemberId(parseInt(staffMemberId));
        const invitesData = invitesResponse?.data?.success ? invitesResponse.data.data : (invitesResponse?.success ? invitesResponse.data : []);
        if (Array.isArray(invitesData)) {
          setStaffInvites(invitesData);
        }

        openSnackbar({
          open: true,
          message: 'Invitation sent successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refresh staff member data
        const refreshResponse = await staffMemberAPI.getStaffMemberById(parseInt(staffMemberId));
        const refreshData = refreshResponse?.data?.success ? refreshResponse.data.data : (refreshResponse?.success ? refreshResponse.data : null);
        if (refreshData) {
          setStaffMember(refreshData);
        }
      } else {
        throw new Error(inviteResponse?.data?.message || 'Failed to send invitation');
      }

      setConfirmDialogOpen(false);
      setPendingInvite(null);
    } catch (error) {
      console.error('Error sending invite:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to send invitation',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !staffMember) {
    return (
      <MainCard>
        <Alert severity="error">{error || 'Staff member not found'}</Alert>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate('/landlord/staff-members')}
          sx={{ mt: 2 }}
        >
          Back to Staff Members
        </Button>
      </MainCard>
    );
  }

  const hasAccount = !!staffMember.userId || staffMember.hasAccount;
  const hasInviteSent = !hasAccount && displayEmail && staffInvites.length > 0;

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Staff Members', to: '/landlord/staff-members' },
          { label: displayName }
        ]}
      />

      {/* Header */}
      <MainCard sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              sx={{
                width: 64,
                height: 64,
                bgcolor: 'primary.main',
                fontSize: '1.5rem'
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h3" sx={{ mb: 0.5 }}>
                {displayName}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip
                  label={staffMember.isActive ? 'Active' : 'Inactive'}
                  color={staffMember.isActive ? 'success' : 'default'}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={
                    hasAccount 
                      ? 'Account Created' 
                      : hasInviteSent 
                        ? 'Invite Sent' 
                        : 'No Account'
                  }
                  color={
                    hasAccount 
                      ? 'success' 
                      : hasInviteSent 
                        ? 'warning' 
                        : 'default'
                  }
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            {!hasAccount && displayEmail && displayEmail !== 'N/A' && (
              <Button
                variant="text"
                startIcon={<SendOutlined />}
                onClick={handleSendInvite}
                disabled={sendingInvite}
              >
                {hasInviteSent ? 'Resend Invite' : 'Send Invite'}
              </Button>
            )}
            <Button
              variant="text"
              startIcon={<EditOutlined />}
              onClick={handleEdit}
            >
              Edit
            </Button>
            <Button
              variant="text"
              startIcon={<ClockCircleOutlined />}
              onClick={handleViewTimeEntries}
            >
              View Time Entries
            </Button>
          </Stack>
        </Stack>
      </MainCard>

      <Grid container spacing={isMobile ? 2 : 3}>
        {/* Left Column - Staff Member Information */}
        <Grid item xs={12} md={8}>
          <MainCard title="Staff Member Information" sx={{ mb: isMobile ? 2 : 3 }}>
            <Grid container spacing={isMobile ? 2 : 3}>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Full Name
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {displayName}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Email
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {displayEmail}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Role
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {staffMember.role || 'N/A'}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Hourly Rate
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {staffMember.hourlyRate ? formatCurrency(staffMember.hourlyRate) : 'N/A'}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Organization
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {staffMember.organizationName || 'N/A'}
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Status
                  </Typography>
                  <Chip
                    label={staffMember.isActive ? 'Active' : 'Inactive'}
                    color={staffMember.isActive ? 'success' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Created At
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {staffMember.createdAt ? formatDateAndTime(staffMember.createdAt) : 'N/A'}
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </MainCard>

          {/* Time Entries Preview */}
          <MainCard 
            title="Recent Time Entries" 
            secondary={
              timeEntries.length > 0 ? (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ClockCircleOutlined />}
                  onClick={handleViewTimeEntries}
                >
                  View All
                </Button>
              ) : null
            }
          >
            {loadingTimeEntries ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : timeEntries.length === 0 ? (
              <Box textAlign="center" py={4}>
                <ClockCircleOutlined style={{ fontSize: 48, opacity: 0.3, color: theme.palette.text.secondary }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No time entries yet
                </Typography>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ClockCircleOutlined />}
                  onClick={handleViewTimeEntries}
                  sx={{ mt: 1 }}
                >
                  Add Time Entry
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Property</TableCell>
                      <TableCell>Hours</TableCell>
                      <TableCell>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timeEntries.slice(0, 5).map((entry) => (
                      <TableRow key={entry.id} hover>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(entry.date)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {entry.propertyName || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {entry.hours || 0}h
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {entry.totalAmount ? formatCurrency(entry.totalAmount) : '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </MainCard>
        </Grid>

        {/* Right Column - Summary Cards */}
        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Total Time Entries
                </Typography>
                <Typography variant="h4" fontWeight={600}>
                  {timeEntries.length}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Total Hours
                </Typography>
                <Typography variant="h4" fontWeight={600}>
                  {timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0).toFixed(1)}h
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Confirm Invite Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>User Already Exists</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            A user with the email <strong>{pendingInvite?.email}</strong> already exists in the system.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Do you want to send them an invitation to join your team as a staff member?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setConfirmDialogOpen(false);
            setPendingInvite(null);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmInvite} 
            variant="contained" 
            disabled={sendingInvite}
          >
            {sendingInvite ? 'Sending...' : 'Send Invite'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
