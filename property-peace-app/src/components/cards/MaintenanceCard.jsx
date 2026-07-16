import PropTypes from 'prop-types';
import { useState, useMemo } from 'react';

// material-ui
import { Button } from '@mui/material';
import { Chip } from '@mui/material';
import { Divider } from '@mui/material';
import { Fade } from '@mui/material';
import { Grid } from '@mui/material';
import { Link } from '@mui/material';
import { List } from '@mui/material';
import { ListItem } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Menu } from '@mui/material';
import { MenuItem } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { alpha, Box } from '@mui/system';

// project imports
import MainCard from 'components/MainCard';
import IconButton from 'components/@extended/IconButton';

// icons
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import MoreOutlined from '@ant-design/icons/MoreOutlined';
import CalendarOutlined from '@ant-design/icons/CalendarOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';

// utils
import { getPriorityColor, getStatusColor } from 'utils/helper-methods';
import { useDispatch } from 'react-redux';
import { resolveMaintenanceRequest, deleteMaintenance, reopenMaintenanceRequest } from 'store/maintenance/maintenance.action';
import useAuth from 'hooks/useAuth';
import { useNavigate } from 'react-router';
import moment from 'moment';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { openSnackbar } from 'api/snackbar';

export default function MaintenanceCard({ request, onEdit, onDelete, onPreview, refetch }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);
  const [openResolveConfirm, setOpenResolveConfirm] = useState(false);
  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [openReopenConfirm, setOpenReopenConfirm] = useState(false);

  const handleMenuClick = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const { id, title, propertyName, unitName, propertyType, status, priority, createdAt } = request ?? {};

  const isMultiUnit = propertyType?.toLowerCase() !== 'singlefamily' && unitName;

  const createdText = useMemo(() => {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? String(createdAt) : d.toLocaleDateString();
  }, [createdAt]);

  const handleResolveClick = (id) => {
    setOpenResolveConfirm(true);
  };

  const handleConfirmResolve = async () => {
    setOpenResolveConfirm(false);
    try {
      const result = await dispatch(resolveMaintenanceRequest(request.id));
      
      // Refetch maintenance list to get updated data
      await refetch();
      
      // Show success snackbar
      openSnackbar({
        open: true,
        message: `Maintenance request "${title}" has been resolved successfully`,
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
      console.error('Error resolving maintenance request:', error);
      
      // Show error snackbar if resolve fails
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to resolve maintenance request',
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

  const handleDeleteClick = () => {
    setOpenDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setOpenDeleteConfirm(false);
    try {
      await dispatch(deleteMaintenance(request.id));
      await refetch();
      
      // Show success snackbar
      openSnackbar({
        open: true,
        message: `Maintenance request "${title}" has been deleted successfully`,
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
      console.error('Error deleting maintenance request:', error);
      
      // Show error snackbar if delete fails
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to delete maintenance request',
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

  const handleReopenClick = () => {
    setOpenReopenConfirm(true);
  };

  const handleConfirmReopen = async () => {
    setOpenReopenConfirm(false);
    try {
      await dispatch(reopenMaintenanceRequest(request.id));
      await refetch();
      
      // Show success snackbar
      openSnackbar({
        open: true,
        message: `Maintenance request "${title}" has been reopened successfully`,
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
      console.error('Error reopening maintenance request:', error);
      
      // Show error snackbar if reopen fails
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to reopen maintenance request',
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

  return (
    <MainCard
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%', // let Grid stretch them, not force
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
                <IconButton edge="end" aria-label="more" color="secondary" onClick={handleMenuClick}>
                  <MoreOutlined style={{ fontSize: '1.15rem' }} />
                </IconButton>
              }
            >
              <ToolOutlined style={{ fontSize: '1.5rem', color: '#1890ff' }} />
              <ListItemText
                primary={<Typography variant="subtitle1">{title || 'Untitled request'}</Typography>}
                secondary={
                  <Typography variant="caption" color="secondary">
                    Maintenance Request
                  </Typography>
                }
                sx={{ ml: 1.25 }}
              />
            </ListItem>
          </List>

          {/* Menu */}
          <Menu
            id="maintenance-menu"
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
                onPreview?.(request);
              }}
            >
              View
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                onEdit?.(request);
              }}
            >
              Edit
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleMenuClose();
                handleDeleteClick();
              }}
            >
              Delete
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
                  <ListItem alignItems="flex-start">
                    <ListItemIcon>
                      <HomeOutlined />
                    </ListItemIcon>
                    <ListItemText
                      sx={{ minWidth: 0 }} // 👈 allow shrinking
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography
                            color="secondary"
                            noWrap
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {propertyName || 'N/A'}
                          </Typography>
                          {isMultiUnit && (
                            <Chip
                              label={unitName}
                              variant="outlined"
                              color="primary"
                              size="small"
                            />
                          )}
                        </Stack>
                      }
                    />
                  </ListItem>

                  <ListItem alignItems="flex-start">
                    <ListItemIcon>
                      <CalendarOutlined />
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
                          Created: {moment(createdAt).format('MM/DD/YYYY hh:mm A')}
                        </Typography>
                      }
                    />
                  </ListItem>
                </List>
                {/* Status + Priority */}
                <Box display="flex" flexDirection="column" justifyContent="space-between" alignItems="end" gap={1}>
                  <Chip sx={{ textTransform: 'capitalize' }} size="small" color={getStatusColor(status)} label={`${status}`} />
                  <Chip sx={{ textTransform: 'capitalize' }} size="small" color={getPriorityColor(priority)} label={`${priority}`} />
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
          {status !== 'completed' && status !== 'cancelled' ? (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EyeOutlined />}
                onClick={() => navigate(`/landlord/maintenance/${request.id}`)}
              >
                View
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="success"
                startIcon={<CheckCircleOutlined />}
                onClick={() => handleResolveClick(request.id)}
              >
                Resolve
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                size="small"
                color="success"
                startIcon={<CheckCircleOutlined />}
                onClick={handleReopenClick}
              >
                Reopen
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<CheckCircleOutlined />}
                onClick={handleDeleteClick}
              >
                Delete
              </Button>
            </>
          )}
        </Stack>
      </Grid>

      {/* Resolve Confirmation Dialog */}
      <ConfirmationDialog
        open={openResolveConfirm}
        onClose={() => setOpenResolveConfirm(false)}
        onConfirm={handleConfirmResolve}
        title="Confirm Resolve Maintenance Request"
        message={`Are you sure you want to resolve the maintenance request "${title}"?`}
        confirmText="Resolve"
        cancelText="Cancel"
        confirmColor="success"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={openDeleteConfirm}
        onClose={() => setOpenDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Delete Maintenance Request"
        message={`Are you sure you want to permanently delete the maintenance request "${title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />

      {/* Reopen Confirmation Dialog */}
      <ConfirmationDialog
        open={openReopenConfirm}
        onClose={() => setOpenReopenConfirm(false)}
        onConfirm={handleConfirmReopen}
        title="Confirm Reopen Maintenance Request"
        message={`Are you sure you want to reopen the maintenance request "${title}"?`}
        confirmText="Reopen"
        cancelText="Cancel"
        confirmColor="success"
      />
    </MainCard>
  );
}

MaintenanceCard.propTypes = {
  request: PropTypes.shape({
    id: PropTypes.number,
    title: PropTypes.string,
    propertyName: PropTypes.string,
    unitName: PropTypes.string,
    propertyType: PropTypes.string,
    status: PropTypes.string,
    priority: PropTypes.string,
    createdAt: PropTypes.string
  }).isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onPreview: PropTypes.func,
  onResolve: PropTypes.func
};

MaintenanceCard.defaultProps = {
  onEdit: () => {},
  onDelete: () => {},
  onPreview: () => {},
  onResolve: () => {}
};
