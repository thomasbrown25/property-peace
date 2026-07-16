import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Divider,
  alpha,
  useTheme,
  Fab,
  useMediaQuery,
  Container,
  InputAdornment,
  Menu,
  MenuList,
  ListItemText,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Drawer
} from '@mui/material';
import Autocomplete from 'components/@extended/AutoComplete';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import {
  UserAddOutlined,
  MailOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  TeamOutlined,
  PlusOutlined,
  SendOutlined,
  CloseOutlined,
  MoreOutlined,
  SearchOutlined
} from '@ant-design/icons';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useOrganization } from 'contexts/OrganizationContext';
import useOrganizationRole from 'hooks/useOrganizationRole';
import { organizationAPI, organizationMemberAPI, organizationInviteAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import OrganizationCreatingOverlay from 'components/organization/OrganizationCreatingOverlay';
import EditOrganizationModal from 'components/dialogs/EditOrganizationModal';

export default function Team() {
  const { currentOrganization, organizations, refreshOrganizations, switchOrganization } = useOrganization();
  const { hasPermission, isOwner, isManager } = useOrganizationRole();
  const auth = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Viewer');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [removingMember, setRemovingMember] = useState(null);
  const [resendingInvite, setResendingInvite] = useState(null);
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [deleteOrgDialogOpen, setDeleteOrgDialogOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(null);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [filteredMembersList, setFilteredMembersList] = useState([]);
  const [loadingFilteredMembers, setLoadingFilteredMembers] = useState(false);
  const [editOrgModalOpen, setEditOrgModalOpen] = useState(false);
  const [orgMenuAnchor, setOrgMenuAnchor] = useState(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  // Get current user's role from organization context (primary) or members list (fallback)
  const orgUserRole = currentOrganization?.userRole || null;
  const currentUserMember = members.find(m => m.userId === auth?.user?.Id);
  const memberUserRole = currentUserMember?.role || null;
  const userRole = orgUserRole || memberUserRole;
  
  // Owners can always manage members. Managers can if they have the permission.
  const canManageMembers = 
    userRole === 'Owner' || 
    isOwner || 
    (userRole === 'Manager' && (currentUserMember?.canManageMembers || hasPermission('CanManageMembers')));
  
  const canViewAccountStatus = canManageMembers; // Only owners/managers with CanManageMembers can see account status

  useEffect(() => {
    if (currentOrganization) {
      loadTeamData();
      // Default to current organization
      if (!selectedOrganizationId) {
        setSelectedOrganizationId(currentOrganization.id);
      }
    }
  }, [currentOrganization]);

  // Load members for selected organization without switching context
  useEffect(() => {
    if (selectedOrganizationId) {
      loadMembersForOrganization(selectedOrganizationId);
    } else {
      setFilteredMembersList([]);
    }
  }, [selectedOrganizationId]);

  // Load organizations for filter
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoadingOrganizations(true);
        const response = await organizationAPI.getUserOrganizations();
        if (response.success && response.data) {
          setAvailableOrganizations(response.data);
        } else {
          setAvailableOrganizations([]);
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setAvailableOrganizations([]);
      } finally {
        setLoadingOrganizations(false);
      }
    };

    loadOrganizations();
  }, []);

  const loadTeamData = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const [membersResponse, invitesResponse] = await Promise.allSettled([
        organizationMemberAPI.getMembers(currentOrganization.id),
        organizationInviteAPI.getInvites(currentOrganization.id)
      ]);

      // Handle members response
      if (membersResponse.status === 'fulfilled' && membersResponse.value.success) {
        setMembers(membersResponse.value.data || []);
      } else {
        const error = membersResponse.status === 'rejected' ? membersResponse.reason : membersResponse.value;
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load team members';
        console.error('Error loading members:', errorMessage, error);
        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: 'error' }
        });
        setMembers([]);
      }

      // Handle invites response - don't show error for 403 (expected for viewers)
      if (invitesResponse.status === 'fulfilled' && invitesResponse.value.success) {
        setInvites(invitesResponse.value.data || []);
      } else {
        const error = invitesResponse.status === 'rejected' ? invitesResponse.reason : invitesResponse.value;
        const isForbidden = error?.response?.status === 403 || 
                          error?.statusCode === 403 ||
                          (invitesResponse.status === 'fulfilled' && invitesResponse.value.statusCode === 403);
        
        // Only log non-403 errors
        if (!isForbidden) {
          const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load invites';
          console.error('Error loading invites:', errorMessage);
        }
        setInvites([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Unexpected error loading team data:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load team data';
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error' }
      });
      setMembers([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !currentOrganization) return;

    try {
      setSendingInvite(true);
      const response = await organizationInviteAPI.createInvite(
        currentOrganization.id,
        inviteEmail.trim(),
        inviteRole
      );

      if (response.success) {
        openSnackbar({
          open: true,
          message: `Invite sent successfully! Email sent to ${inviteEmail}`,
          variant: 'alert',
          alert: { color: 'success' }
        });

        setInviteDialogOpen(false);
        setInviteEmail('');
        setInviteRole('Viewer');
        loadTeamData();
        // Reload filtered members if viewing a different organization
        if (selectedOrganizationId && selectedOrganizationId !== currentOrganization?.id) {
          loadMembersForOrganization(selectedOrganizationId);
        }
      } else {
        throw new Error(response.message || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to send invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    // Use selected organization if filtering, otherwise use current organization
    const organizationId = selectedOrganizationId || currentOrganization?.id;
    if (!organizationId) return;

    // Check if trying to remove self
    const isRemovingSelf = String(memberUserId) === String(auth?.user?.Id) || 
                          String(memberUserId) === String(auth?.user?.id);
    
    if (isRemovingSelf) {
      // Check if user is the owner - use filtered members or regular members
      const membersToCheck = selectedOrganizationId && selectedOrganizationId !== currentOrganization?.id 
        ? filteredMembersList 
        : members;
      const memberToRemove = membersToCheck.find(m => 
        String(m.userId || m.id) === String(memberUserId)
      );
      
      if (memberToRemove?.role === 'Owner') {
        // Count how many owners exist
        const ownerCount = membersToCheck.filter(m => m.role === 'Owner' && m.isActive).length;
        
        if (ownerCount <= 1) {
          openSnackbar({
            open: true,
            message: 'You cannot remove yourself as you are the last owner. Please transfer ownership to another member first.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          return;
        } else {
          openSnackbar({
            open: true,
            message: 'You cannot remove yourself from the organization. Please have another owner remove you if needed.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          return;
        }
      }
    }

    try {
      setRemovingMember(memberUserId);
      const response = await organizationMemberAPI.removeMember(
        organizationId,
        memberUserId
      );

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Member removed successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        loadTeamData();
        // Reload filtered members if viewing a different organization
        if (selectedOrganizationId && selectedOrganizationId !== currentOrganization?.id) {
          loadMembersForOrganization(selectedOrganizationId);
        }
      } else {
        throw new Error(response.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to remove member',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setRemovingMember(null);
    }
  };

  const handleCopyInviteLink = async (token) => {
    const baseUrl = window.location.origin;
    const inviteLink = `${baseUrl}/organization/invite/${token}`;
    await navigator.clipboard.writeText(inviteLink);
    openSnackbar({
      open: true,
      message: 'Invite link copied to clipboard!',
      variant: 'alert',
      alert: { color: 'success' }
    });
  };

  const handleResendInvite = async (memberEmailOrInvite) => {
    if (!currentOrganization) return;

    try {
      let invite;
      let inviteId;
      
      // If it's an invite object (from pending invites), use it directly
      if (typeof memberEmailOrInvite === 'object' && memberEmailOrInvite.token) {
        invite = memberEmailOrInvite;
        inviteId = memberEmailOrInvite.id;
      } else {
        // Otherwise, find the invite by email (from members section)
        invite = invites.find(
          inv => inv.email?.toLowerCase() === memberEmailOrInvite?.toLowerCase() && !inv.isAccepted
        );

        if (!invite) {
          openSnackbar({
            open: true,
            message: 'No pending invite found for this member',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          return;
        }
        inviteId = invite.id;
      }

      const emailKey = typeof memberEmailOrInvite === 'object' ? memberEmailOrInvite.email : memberEmailOrInvite;
      setResendingInvite(emailKey);
      
      // Call the API to resend the invite (generates new token and extends expiration)
      const response = await organizationInviteAPI.resendInvite(inviteId);
      
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Invite resent successfully! Email sent with the invite link.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refresh the team data to get the updated invite
        loadTeamData();
      } else {
        throw new Error(response.message || 'Failed to resend invite');
      }
    } catch (error) {
      console.error('Error resending invite:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to resend invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setResendingInvite(null);
    }
  };

  // Helper function to get invite for a member
  const getMemberInvite = (member) => {
    const memberEmail = member.userEmail || member.email;
    if (!memberEmail) return null;
    
    return invites.find(
      inv => inv.email?.toLowerCase() === memberEmail?.toLowerCase()
    );
  };

  const handleDeleteInvite = async (inviteId) => {
    try {
      const response = await organizationInviteAPI.deleteInvite(inviteId);
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Invite deleted',
          variant: 'alert',
          alert: { color: 'success' }
        });
        loadTeamData();
      }
    } catch (error) {
      console.error('Error deleting invite:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) return;

    try {
      setCreatingOrg(true);
      const response = await organizationAPI.createOrganization(
        orgName.trim(),
        orgDescription.trim() || null
      );

      if (response.success && response.data) {
        openSnackbar({
          open: true,
          message: 'Organization created successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refresh organizations list
        await refreshOrganizations();

        // Switch to the new organization
        await switchOrganization(response.data.id);

        // Close dialog and reset form
        setCreateOrgDialogOpen(false);
        setOrgName('');
        setOrgDescription('');

        // Note: useEffect will automatically reload team data when currentOrganization changes
      } else {
        throw new Error(response.message || 'Failed to create organization');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to create organization',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!currentOrganization) return;

    try {
      setDeletingOrg(true);
      const response = await organizationAPI.deleteOrganization(currentOrganization.id);

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Organization and all related data deleted successfully. User accounts were preserved.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        // Refresh organizations list
        await refreshOrganizations();

        // Close dialog
        setDeleteOrgDialogOpen(false);

        // If there are other organizations, switch to the first one
        if (organizations && organizations.length > 1) {
          const otherOrg = organizations.find(o => o.id !== currentOrganization.id);
          if (otherOrg) {
            await switchOrganization(otherOrg.id);
          }
        } else {
          // No other organizations - clear current organization
          localStorage.removeItem('currentOrganizationId');
          // Reload page to refresh all data
          window.location.reload();
        }
      } else {
        throw new Error(response.message || 'Failed to delete organization');
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to delete organization',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeletingOrg(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Owner':
        return 'error';
      case 'Manager':
        return 'primary';
      case 'Viewer':
        return 'default';
      default:
        return 'default';
    }
  };

  // Load members for a specific organization without switching context
  const loadMembersForOrganization = async (organizationId) => {
    try {
      setLoadingFilteredMembers(true);
      const response = await organizationMemberAPI.getMembers(organizationId);
      
      if (response.success) {
        setFilteredMembersList(response.data || []);
      } else {
        setFilteredMembersList([]);
      }
    } catch (error) {
      console.error('Error loading members for organization:', error);
      setFilteredMembersList([]);
    } finally {
      setLoadingFilteredMembers(false);
    }
  };

  // Use filtered members from selected organization, or fall back to current organization members
  const filteredMembers = useMemo(() => {
    if (selectedOrganizationId && selectedOrganizationId !== currentOrganization?.id) {
      return filteredMembersList;
    }
    return members;
  }, [members, filteredMembersList, selectedOrganizationId, currentOrganization]);

  const pendingInvites = useMemo(() => invites.filter((invite) => !invite.isAccepted), [invites]);

  const teamRows = useMemo(() => {
    const memberEmailSet = new Set(
      filteredMembers
        .map((member) => (member.userEmail || member.email || '').toLowerCase())
        .filter(Boolean)
    );

    const memberRows = filteredMembers.map((member) => {
      const memberInvite = getMemberInvite(member);
      const hasPendingInvite = memberInvite && !memberInvite.isAccepted;
      return {
        type: 'member',
        id: `member-${member.id || member.userId || member.email}`,
        member,
        invite: memberInvite,
        name: member.userName || member.email || 'Pending',
        email: member.userEmail || member.email || '',
        role: member.role || 'Viewer',
        invitedBy: member.invitedByName || '—',
        status: hasPendingInvite ? 'Pending invite' : member.isActive === false ? 'Inactive' : 'Active'
      };
    });

    const inviteRows = pendingInvites
      .filter((invite) => !memberEmailSet.has((invite.email || '').toLowerCase()))
      .map((invite) => ({
        type: 'invite',
        id: `invite-${invite.id || invite.email}`,
        invite,
        name: 'Pending invite',
        email: invite.email || '',
        role: invite.role || 'Viewer',
        invitedBy: invite.invitedByName || '—',
        status: new Date(invite.expiresAt) < new Date() ? 'Expired' : 'Pending invite'
      }));

    return [...memberRows, ...inviteRows];
  }, [filteredMembers, pendingInvites, invites]);

  const filteredTeamRows = useMemo(() => {
    const query = teamSearchQuery.trim().toLowerCase();
    if (!query) return teamRows;
    return teamRows.filter((row) =>
      [row.name, row.email, row.role, row.invitedBy, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [teamRows, teamSearchQuery]);

  // Show loading spinner on full page until data is loaded
  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Show organization creating overlay
  if (creatingOrg) {
    return (
      <>
        <OrganizationCreatingOverlay />
        {!currentOrganization && (
          <MainCard boxShadow border={false} shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`} sx={{ border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h3" sx={{ mb: 0.5 }}>
                  Admin Members
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create or join an organization to manage your team
                </Typography>
              </Box>
            </Stack>
          </MainCard>
        )}
      </>
    );
  }

  if (!currentOrganization) {
    return (
      <MainCard sx={{ border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, boxShadow: theme.palette.mode === 'dark' ? `0 4px 24px ${alpha(theme.palette.common.black, 0.3)}, inset 0 1px 0 rgba(255,255,255,0.04)` : `0 2px 12px ${alpha(theme.palette.common.black, 0.06)}` }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" sx={{ mb: 0.5 }}>
              Team Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create or join an organization to manage your team
            </Typography>
          </Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            You need to be part of an organization to manage team members. Create a new organization to get started.
          </Alert>
          <Button
            variant="contained"
            startIcon={<PlusOutlined />}
            onClick={() => setCreateOrgDialogOpen(true)}
            size="small"
          >
            Create Organization
          </Button>
        </Stack>

        {/* Create Organization Dialog */}
        <Dialog open={createOrgDialogOpen} onClose={() => setCreateOrgDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Organization Name"
                type="text"
                fullWidth
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="My Organization"
                inputProps={{ maxLength: 255 }}
                helperText={`${orgName.length} / 255 characters`}
              />
              <TextField
                label="Description (Optional)"
                type="text"
                fullWidth
                multiline
                rows={3}
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
                placeholder="Brief description of your organization"
                inputProps={{ maxLength: 1000 }}
                helperText={`${orgDescription.length} / 1000 characters`}
              />
              <Alert severity="info">
                You'll be the owner of this organization and can invite team members after creation.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOrgDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreateOrganization}
              disabled={!orgName.trim() || creatingOrg}
            >
              {creatingOrg ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogActions>
        </Dialog>
      </MainCard>
    );
  }

  return (
    <Box>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Team & Staff' }
          ]}
        />

        {/* Header */}
        <Box sx={{ mb: 0.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'flex-start' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h3" fontWeight={700}>
                Team & Staff
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 0.25 }}>
                {currentOrganization && (
                  <Typography variant="body1" color="text.secondary">
                    {currentOrganization.name}
                  </Typography>
                )}
                {currentOrganization && (
                  <>
                    <Typography variant="body2" color="text.disabled">·</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {members.length} {members.length === 1 ? 'member' : 'members'}
                    </Typography>
                  </>
                )}
                {currentOrganization && canManageMembers && pendingInvites.length > 0 && (
                  <>
                    <Typography variant="body2" color="text.disabled">·</Typography>
                    <Typography variant="body2" color="warning.main">
                      {pendingInvites.length} pending {pendingInvites.length === 1 ? 'invite' : 'invites'}
                    </Typography>
                  </>
                )}
              </Stack>
            </Box>
            {currentOrganization && (
              <>
                <Tooltip title="Organization settings">
                  <IconButton
                    onClick={(e) => setOrgMenuAnchor(e.currentTarget)}
                    size="small"
                    sx={{ color: 'text.secondary' }}
                  >
                    <MoreOutlined style={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={orgMenuAnchor}
                  open={Boolean(orgMenuAnchor)}
                  onClose={() => setOrgMenuAnchor(null)}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  {isOwner && (
                    <MenuItem onClick={() => { setOrgMenuAnchor(null); setEditOrgModalOpen(true); }}>
                      <EditOutlined style={{ marginRight: 8, fontSize: 14 }} />
                      Edit Organization
                    </MenuItem>
                  )}
                  <MenuItem onClick={() => { setOrgMenuAnchor(null); setCreateOrgDialogOpen(true); }}>
                    <PlusOutlined style={{ marginRight: 8, fontSize: 14 }} />
                    Create Organization
                  </MenuItem>
                  {isOwner && <Divider />}
                  {isOwner && (
                    <MenuItem
                      onClick={() => { setOrgMenuAnchor(null); setDeleteOrgDialogOpen(true); }}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteOutlined style={{ marginRight: 8, fontSize: 14 }} />
                      Delete Organization
                    </MenuItem>
                  )}
                </Menu>
              </>
            )}
          </Stack>
        </Box>

        {/* Team access */}
        <MainCard
          content={false}
          boxShadow
          border={false}
          shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`}
          sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, borderRadius: 1.5, overflow: 'hidden' }}
        >
          <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  Team access ({filteredTeamRows.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Active members and pending invites in one list
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                {availableOrganizations.length > 1 && (
                  <Autocomplete
                    options={availableOrganizations}
                    value={availableOrganizations.find(org => org.id === selectedOrganizationId) || null}
                    onChange={(event, newValue) => setSelectedOrganizationId(newValue ? newValue.id : null)}
                    getOptionLabel={(option) => option.name || ''}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    loading={loadingOrganizations || loadingFilteredMembers}
                    width="200px"
                    label="Organization"
                    disablePortal={false}
                  />
                )}
                {canManageMembers && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<UserAddOutlined />}
                    onClick={() => setInviteDialogOpen(true)}
                    sx={{ borderRadius: 1, textTransform: 'none', whiteSpace: 'nowrap' }}
                  >
                    Invite Member
                  </Button>
                )}
              </Stack>
            </Stack>

            <TextField
              fullWidth
              size="small"
              value={teamSearchQuery}
              onChange={(e) => setTeamSearchQuery(e.target.value)}
              placeholder="Search team members, emails, roles, invites..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined style={{ fontSize: 16, opacity: 0.65 }} />
                  </InputAdornment>
                ),
                sx: { height: 34, fontSize: '0.8rem', bgcolor: 'background.paper' }
              }}
              sx={{ mt: 1.5, maxWidth: { xs: '100%', md: 520 } }}
            />
          </Box>

          <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 860 }}>
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: alpha(theme.palette.grey[500], 0.06),
                    '& th': {
                      py: 1.15,
                      color: 'text.secondary',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }
                  }}
                >
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Invited By</TableCell>
                  {canManageMembers && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingFilteredMembers ? (
                  <TableRow>
                    <TableCell colSpan={canManageMembers ? 6 : 5} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : filteredTeamRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageMembers ? 6 : 5} align="center" sx={{ py: 5 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: canManageMembers ? 1.5 : 0 }}>
                        {teamSearchQuery ? 'No team members or invites match your search.' : 'No team members yet. Invite team members to get started.'}
                      </Typography>
                      {canManageMembers && !teamSearchQuery && (
                        <Button
                          variant="contained"
                          startIcon={<UserAddOutlined />}
                          onClick={() => setInviteDialogOpen(true)}
                          size="small"
                        >
                          Invite Your First Member
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeamRows.map((row) => {
                    const { member, invite } = row;
                    const isInvite = row.type === 'invite';
                    const isExpired = row.status === 'Expired';
                    const canRemove =
                      canManageMembers &&
                      member?.userId != null &&
                      String(member.userId) !== String(auth?.user?.Id) &&
                      String(member.userId) !== String(auth?.user?.id);

                    return (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{
                          '& td': { py: 1.25, borderBottomColor: alpha(theme.palette.divider, 0.7) },
                          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.025) }
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={600} color={isInvite ? 'text.secondary' : 'text.primary'}>
                              {row.name}
                            </Typography>
                            {canViewAccountStatus &&
                              member?.userId != null &&
                              String(member.userId) !== String(auth?.user?.Id) &&
                              String(member.userId) !== String(auth?.user?.id) &&
                              !member.hasAccount && (
                                <Chip label="No account" color="default" size="small" sx={{ height: 20, fontSize: '0.68rem' }} />
                              )}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {row.email || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={row.role} color={getRoleColor(row.role)} size="small" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.status}
                            color={isExpired ? 'error' : row.status === 'Active' ? 'success' : 'warning'}
                            size="small"
                            variant={row.status === 'Active' ? 'filled' : 'outlined'}
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {row.invitedBy || '—'}
                          </Typography>
                        </TableCell>
                        {canManageMembers && (
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              {(invite || isInvite) && (
                                <Tooltip title="Resend Invite">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleResendInvite(isInvite ? invite : row.email)}
                                    disabled={resendingInvite === row.email}
                                  >
                                    {resendingInvite === row.email ? <CircularProgress size={14} /> : <SendOutlined />}
                                  </IconButton>
                                </Tooltip>
                              )}
                              {isInvite && invite?.token && (
                                <Tooltip title="Copy Invite Link">
                                  <IconButton size="small" onClick={() => handleCopyInviteLink(invite.token)}>
                                    <CopyOutlined />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {isInvite && invite?.id && (
                                <Tooltip title="Delete Invite">
                                  <IconButton size="small" color="error" onClick={() => handleDeleteInvite(invite.id)}>
                                    <DeleteOutlined />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canRemove && (
                                <Tooltip title="Remove Member">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveMember(member.userId || member.id)}
                                    disabled={removingMember === (member.userId || member.id)}
                                  >
                                    {removingMember === (member.userId || member.id) ? <CircularProgress size={14} /> : <DeleteOutlined />}
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>


        {/* Invite Drawer */}
        <Drawer
          anchor="right"
          open={inviteDialogOpen}
          onClose={() => setInviteDialogOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, p: 3, bgcolor: 'background.paper', backgroundImage: 'none' } }}
        >
          <Stack spacing={3}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h5">Invite Team Member</Typography>
              <IconButton size="small" onClick={() => setInviteDialogOpen(false)}>
                <CloseOutlined />
              </IconButton>
            </Stack>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="team.member@example.com"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={inviteRole}
                label="Role"
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <MenuItem value="Viewer">Viewer - Read-only access</MenuItem>
                <MenuItem value="Manager">Manager - Can manage properties, tenants, and leases</MenuItem>
                {isOwner && <MenuItem value="Owner">Owner - Full access</MenuItem>}
              </Select>
            </FormControl>
            <Alert severity="info">
              An invite email will be sent to the user. They must click the link in the email to accept the invite.
            </Alert>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim() || sendingInvite}
              >
                {sendingInvite ? 'Sending...' : 'Send Invite'}
              </Button>
            </Stack>
          </Stack>
        </Drawer>

        {/* Create Organization Dialog */}
        <Dialog open={createOrgDialogOpen} onClose={() => setCreateOrgDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Organization Name"
                type="text"
                fullWidth
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="My Organization"
                inputProps={{ maxLength: 255 }}
                helperText={`${orgName.length} / 255 characters`}
              />
              <TextField
                label="Description (Optional)"
                type="text"
                fullWidth
                multiline
                rows={3}
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
                placeholder="Brief description of your organization"
                inputProps={{ maxLength: 1000 }}
                helperText={`${orgDescription.length} / 1000 characters`}
              />
              <Alert severity="info">
                You'll be the owner of this organization and can invite team members after creation.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOrgDialogOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleCreateOrganization}
              disabled={!orgName.trim() || creatingOrg}
            >
              {creatingOrg ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Organization Dialog */}
        <Dialog open={deleteOrgDialogOpen} onClose={() => setDeleteOrgDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {currentOrganization 
              ? `Are you sure you want to delete '${currentOrganization.name}'?`
              : 'Delete Organization'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="error" icon={<WarningIcon />}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Warning: This action cannot be undone!
                </Typography>
                <Typography variant="body2" component="div">
                  Deleting this organization will permanently delete:
                  <ul style={{ marginTop: 8, marginBottom: 8 }}>
                    <li>All properties and units</li>
                    <li>All leases and tenant data</li>
                    <li>All maintenance requests</li>
                    <li>All expenses and financial records</li>
                    <li>All subscriptions and billing information</li>
                    <li>All files and documents</li>
                    <li>All team members and invites</li>
                  </ul>
                  <strong>User accounts (including tenants) will NOT be deleted.</strong>
                </Typography>
              </Alert>
              <Alert severity="info">
                If you have other organizations, you can switch to them after deletion. Otherwise, you'll need to create a new organization.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOrgDialogOpen(false)} disabled={deletingOrg}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeleteOrganization}
              disabled={deletingOrg}
              startIcon={deletingOrg ? <CircularProgress size={16} /> : <DeleteOutlined />}
            >
              {deletingOrg ? 'Deleting...' : 'Delete Organization'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Floating Action Button for Mobile */}
        {canManageMembers && isMobile && (
          <Fab
            color="primary"
            aria-label="invite member"
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1000
            }}
            onClick={() => setInviteDialogOpen(true)}
          >
            <UserAddOutlined style={{ fontSize: 24 }} />
          </Fab>
        )}

        {/* Edit Organization Modal */}
        {currentOrganization && (
          <EditOrganizationModal
            open={editOrgModalOpen}
            onClose={() => setEditOrgModalOpen(false)}
            organization={currentOrganization}
          />
        )}
      </Stack>
    </Box>
  );
}

