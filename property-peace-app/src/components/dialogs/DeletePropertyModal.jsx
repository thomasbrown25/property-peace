import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
  Checkbox,
  Box,
  IconButton,
  alpha,
  useTheme,
  CircularProgress
} from '@mui/material';
import { DeleteOutlined, CloseOutlined, FileTextOutlined, DollarOutlined, WarningOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { deleteProperty } from 'store/property/property.action';
import { openSnackbar } from 'api/snackbar';

const deleteCheckboxes = [
  {
    id: 'documents',
    icon: <FileTextOutlined />,
    label: 'Documents, Expenses, and Maintenance Requests for this property and all dependents (units, rooms) will be permanently deleted.'
  },
  {
    id: 'payments',
    icon: <DollarOutlined />,
    label: 'Rent Payments, Leases, and Tenants will remain active and viewable.'
  },
  {
    id: 'irreversible',
    icon: <WarningOutlined />,
    label: 'This action cannot be undone.',
    danger: true
  }
];

export default function DeletePropertyModal({ open, onClose, propertyId, propertyName }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [checkedItems, setCheckedItems] = useState({
    documents: false,
    payments: false,
    irreversible: false
  });
  const [deleting, setDeleting] = useState(false);

  const allChecked = Object.values(checkedItems).every(Boolean);

  const handleCheckboxChange = (id) => (event) => {
    setCheckedItems((prev) => ({ ...prev, [id]: event.target.checked }));
  };

  const handleDelete = async () => {
    if (!allChecked) return;
    setDeleting(true);
    try {
      await dispatch(deleteProperty(propertyId));
      openSnackbar({
        open: true,
        message: 'Property deleted successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      navigate('/landlord/properties');
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete property',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
      onClose();
    }
  };

  const handleClose = () => {
    setCheckedItems({ documents: false, payments: false, irreversible: false });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            maxWidth: 460
          }
        }
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={handleClose}
        size="small"
        sx={{
          position: 'absolute',
          right: 12,
          top: 12,
          color: 'text.secondary',
          zIndex: 1,
          '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) }
        }}
      >
        <CloseOutlined />
      </IconButton>

      <DialogTitle sx={{ pt: 4, pb: 1.5, px: 3 }}>
        <Stack alignItems="center" spacing={2} mb={1}>
          {/* Icon badge */}
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.error.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'error.main',
              fontSize: 26
            }}
          >
            <DeleteOutlined />
          </Box>

          <Box textAlign="center">
            <Typography variant="h5" fontWeight={700} color="text.primary" lineHeight={1.3}>
              Delete Property
            </Typography>
            {propertyName && (
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                {propertyName}
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 0.5, pb: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Confirm you understand what will happen before continuing.
        </Typography>

        <Stack spacing={1.5}>
          {deleteCheckboxes.map((item) => (
            <Box
              key={item.id}
              onClick={() => handleCheckboxChange(item.id)({ target: { checked: !checkedItems[item.id] } })}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                borderColor: checkedItems[item.id]
                  ? item.danger
                    ? alpha(theme.palette.error.main, 0.4)
                    : alpha(theme.palette.primary.main, 0.4)
                  : 'divider',
                bgcolor: checkedItems[item.id]
                  ? item.danger
                    ? alpha(theme.palette.error.main, 0.05)
                    : alpha(theme.palette.primary.main, 0.04)
                  : 'background.paper',
                '&:hover': {
                  borderColor: item.danger
                    ? alpha(theme.palette.error.main, 0.5)
                    : alpha(theme.palette.primary.main, 0.5),
                  bgcolor: item.danger
                    ? alpha(theme.palette.error.main, 0.04)
                    : alpha(theme.palette.primary.main, 0.03)
                }
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  mt: 0.25,
                  fontSize: 16,
                  color: item.danger ? 'error.main' : 'text.secondary',
                  flexShrink: 0
                }}
              >
                {item.icon}
              </Box>

              {/* Label */}
              <Typography
                variant="body2"
                color={item.danger ? 'error.main' : 'text.primary'}
                fontWeight={item.danger ? 600 : 400}
                sx={{ flex: 1, lineHeight: 1.5 }}
              >
                {item.label}
              </Typography>

              {/* Checkbox (non-interactive, driven by row click) */}
              <Checkbox
                checked={checkedItems[item.id]}
                color={item.danger ? 'error' : 'primary'}
                size="small"
                tabIndex={-1}
                disableRipple
                sx={{ p: 0, flexShrink: 0, mt: 0.25 }}
                onClick={(e) => e.stopPropagation()}
                onChange={handleCheckboxChange(item.id)}
              />
            </Box>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, gap: 1.5 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          fullWidth
          sx={{ fontWeight: 600, borderRadius: 2 }}
        >
          Go Back
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleDelete}
          disabled={!allChecked || deleting}
          fullWidth
          startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ fontWeight: 600, borderRadius: 2 }}
        >
          {deleting ? 'Deleting...' : 'Delete Property'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
