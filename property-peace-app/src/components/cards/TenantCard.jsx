import PropTypes from 'prop-types';
import { useState, useMemo } from 'react';

// material-ui
import { Button } from '@mui/material';
import { Chip } from '@mui/material';
import { Divider } from '@mui/material';
import { Fade } from '@mui/material';
import { Grid } from '@mui/material';
import { List } from '@mui/material';
import { ListItem } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Menu } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Tooltip } from '@mui/material';
import { alpha, Box } from '@mui/system';

// project imports
import MainCard from 'components/MainCard';
import IconButton from 'components/@extended/IconButton';

// icons
import {
  UserOutlined,
  MoreOutlined,
  HomeOutlined,
  MailOutlined,
  PhoneOutlined,
  EditOutlined,
  DeleteOutlined
} from '@ant-design/icons';

// utils
import { formatPhoneInput } from 'utils/formatters';
import { useDispatch } from 'react-redux';
import { deleteTenant } from 'store/tenant/tenant.action';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { tenantInviteAPI } from 'api';
import { CircularProgress } from '@mui/material';

export default function TenantCard({ tenant, onEdit, onDelete, onClick, refetch }) {
  const dispatch = useDispatch();

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);
  const [openRemoveConfirm, setOpenRemoveConfirm] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  const handleMenuClick = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const { id, firstname, lastname, email, phoneNumber, propertyName, unitName, propertyType, userId, UserId } = tenant ?? {};
  const hasAccount = !!(userId || UserId);

  const propertyDisplay = useMemo(() => {
    if (!propertyName) return 'N/A';
    if (propertyType?.toLowerCase() === 'singlefamily') {
      return propertyName;
    }
    return unitName ? `${propertyName} – ${unitName}` : propertyName;
  }, [propertyName, unitName, propertyType]);

  const fullName = useMemo(() => {
    return `${firstname || ''} ${lastname || ''}`.trim() || 'Unnamed Tenant';
  }, [firstname, lastname]);

  const handleRemoveClick = () => {
    setOpenRemoveConfirm(true);
  };

  const handleConfirmRemove = async () => {
    setOpenRemoveConfirm(false);
    try {
      await dispatch(deleteTenant(tenant.id));
      await refetch();

      openSnackbar({
        open: true,
        message: `Tenant "${fullName}" has been removed from portfolio`,
        variant: 'alert',
        alert: {
          color: 'success',
          variant: 'filled'
        },
        close: true,
        actionButton: false,
        anchorOrigin: {
          vertical: 'bottom',
          horizontal: 'right'
        },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    } catch (error) {
      console.error('Error removing tenant:', error);

      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to remove tenant',
        variant: 'alert',
        alert: {
          color: 'error',
          variant: 'filled'
        },
        close: true,
        actionButton: false,
        anchorOrigin: {
          vertical: 'bottom',
          horizontal: 'right'
        },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    }
  };

  const handleSendReminder = async () => {
    if (!email) {
      openSnackbar({
        open: true,
        message: 'Tenant does not have an email address',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setSendingInvite(true);

    try {
      // First, try to get existing invites for this tenant
      const invitesResponse = await tenantInviteAPI.getInvitesByTenantId(tenant.id);

      if (invitesResponse.success && invitesResponse.data && invitesResponse.data.length > 0) {
        // Find a valid (unused, not expired) invite
        const validInvite = invitesResponse.data.find((invite) => !invite.isUsed && new Date(invite.expiresAt) > new Date());

        if (validInvite) {
          // Resend existing invite
          const resendResponse = await tenantInviteAPI.resendInvite(validInvite.id);
          if (resendResponse.success) {
            openSnackbar({
              open: true,
              message: 'Reminder email sent successfully!',
              variant: 'alert',
              alert: { color: 'success' }
            });
            return;
          }
        }
      }

      // If no valid invite exists, create a new one
      const response = await tenantInviteAPI.createTenantInvite({
        tenantId: tenant.id,
        email: email
      });

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Reminder email sent successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        // If it fails because a valid invite exists, try to resend it
        if (response.message?.includes('valid invite already exists')) {
          const invitesResponse = await tenantInviteAPI.getInvitesByTenantId(tenant.id);
          if (invitesResponse.success && invitesResponse.data && invitesResponse.data.length > 0) {
            const validInvite = invitesResponse.data.find((invite) => !invite.isUsed && new Date(invite.expiresAt) > new Date());
            if (validInvite) {
              const resendResponse = await tenantInviteAPI.resendInvite(validInvite.id);
              if (resendResponse.success) {
                openSnackbar({
                  open: true,
                  message: 'Reminder email sent successfully!',
                  variant: 'alert',
                  alert: { color: 'success' }
                });
                return;
              }
            }
          }
        }

        openSnackbar({
          open: true,
          message: response.message || 'Failed to send reminder email',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error sending reminder email:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to send reminder email',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <MainCard
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`
            }
          : {},
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
        '& .MuiCardContent-root': { flexGrow: 1, display: 'flex', flexDirection: 'column' }
      }}
    >
      <Grid container spacing={2.25}>
        {/* Header */}
        <Grid size={12}>
          <List sx={{ width: 1, p: 0 }}>
            <ListItem
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  aria-label="more"
                  color="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuClick(e);
                  }}
                >
                  <MoreOutlined style={{ fontSize: '1.15rem' }} />
                </IconButton>
              }
            >
              <UserOutlined style={{ fontSize: '1.5rem', color: '#061e35' }} />
              <ListItemText
                primary={<Typography variant="subtitle1">{fullName}</Typography>}
                secondary={
                  <Typography variant="caption" color="secondary">
                    Tenant
                  </Typography>
                }
                sx={{ ml: 1.25 }}
              />
            </ListItem>
          </List>

          {/* Menu */}
          <Menu
            id="tenant-menu"
            anchorEl={anchorEl}
            open={openMenu}
            onClose={handleMenuClose}
            slots={{ transition: Fade }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={() => {
                handleMenuClose();
                onEdit?.(tenant);
              }}
            >
              Edit
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                handleRemoveClick();
              }}
            >
              Remove Tenant
            </MenuItem>
          </Menu>
        </Grid>

        <Grid size={12}>
          <Divider />
        </Grid>

        {/* Details */}
        <Grid size={12}>
          <Grid container spacing={1}>
            <Grid size={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                <List sx={{ p: 0, '& .MuiListItem-root': { px: 0, py: 0.5 } }}>
                  {propertyName && (
                    <ListItem alignItems="flex-start">
                      <ListItemIcon>
                        <HomeOutlined />
                      </ListItemIcon>
                      <ListItemText
                        sx={{ minWidth: 0 }}
                        primary={
                          <Typography
                            color="secondary"
                            noWrap
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {propertyDisplay}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}

                  {email && (
                    <ListItem alignItems="flex-start">
                      <ListItemIcon>
                        <MailOutlined />
                      </ListItemIcon>
                      <ListItemText
                        sx={{ minWidth: 0 }}
                        primary={
                          <Typography
                            color="secondary"
                            noWrap
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {email}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}

                  {phoneNumber && (
                    <ListItem alignItems="flex-start">
                      <ListItemIcon>
                        <PhoneOutlined />
                      </ListItemIcon>
                      <ListItemText
                        sx={{ minWidth: 0 }}
                        primary={
                          <Typography
                            color="secondary"
                            noWrap
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {formatPhoneInput(phoneNumber)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
                {/* Account Status */}
                <Box display="flex" flexDirection="column" justifyContent="space-between" alignItems="end" gap={1}>
                  {(() => {
                    const hasPendingInvite = !hasAccount && tenant.email && (tenant.hasPendingInvite || false);
                    return (
                      <Chip
                        label={hasAccount ? 'Account Created' : hasPendingInvite ? 'Existing - Invite Sent' : 'No Account'}
                        color={hasAccount ? 'success' : hasPendingInvite ? 'warning' : 'default'}
                        size="small"
                      />
                    );
                  })()}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Grid>

        {/* Footer */}
        <Stack
          direction="row"
          sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between', mt: 'auto', mb: 0, pt: 2.25, width: '100%' }}
        >
          <Tooltip
            title={
              !email
                ? 'No email address'
                : hasAccount
                  ? 'Tenant already has an account'
                  : 'Send Reminder Email'
            }
          >
            <span>
              <Button
                variant="outlined"
                size="small"
                color="primary"
                startIcon={sendingInvite ? <CircularProgress size={14} /> : <MailOutlined />}
                onClick={handleSendReminder}
                disabled={sendingInvite || !email || hasAccount}
              >
                Send Reminder
              </Button>
            </span>
          </Tooltip>
          <Button variant="outlined" size="small" startIcon={<EditOutlined />} onClick={() => onEdit?.(tenant)}>
            Edit
          </Button>
          <Button variant="outlined" size="small" color="error" startIcon={<DeleteOutlined />} onClick={handleRemoveClick}>
            Remove
          </Button>
        </Stack>
      </Grid>

      {/* Remove Confirmation Dialog */}
      <ConfirmationDialog
        open={openRemoveConfirm}
        onClose={() => setOpenRemoveConfirm(false)}
        onConfirm={handleConfirmRemove}
        title="Confirm Remove Tenant"
        message={`Are you sure you want to remove tenant "${fullName}" from your portfolio? The tenant's account and historical documents will be preserved.`}
        confirmText="Remove"
        cancelText="Cancel"
        confirmColor="error"
      />
    </MainCard>
  );
}

TenantCard.propTypes = {
  tenant: PropTypes.shape({
    id: PropTypes.number,
    firstname: PropTypes.string,
    lastname: PropTypes.string,
    email: PropTypes.string,
    phoneNumber: PropTypes.string,
    propertyName: PropTypes.string,
    unitName: PropTypes.string,
    propertyType: PropTypes.string,
    userId: PropTypes.number,
    UserId: PropTypes.number
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  refetch: PropTypes.func
};

TenantCard.defaultProps = {
  onEdit: () => {},
  onDelete: () => {},
  refetch: () => {}
};
