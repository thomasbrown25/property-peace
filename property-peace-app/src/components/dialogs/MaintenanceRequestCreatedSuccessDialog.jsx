import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

// material-ui
import {
  Dialog,
  DialogContent,
  Box,
  Button,
  Typography,
  Stack,
  Card,
  CardContent,
  IconButton,
  Link
} from '@mui/material';
import { CheckCircleOutlined, CloseOutlined, EyeOutlined, CloudUploadOutlined, ToolOutlined } from '@ant-design/icons';

const MaintenanceRequestCreatedSuccessDialog = ({
  open,
  onClose,
  maintenanceRequest,
  propertyName,
  unitName
}) => {
  const navigate = useNavigate();

  const handleViewRequest = () => {
    if (maintenanceRequest?.id) {
      navigate(`/tenant/maintenance/${maintenanceRequest.id}`);
      onClose();
    }
  };

  const handleAddMorePhotos = () => {
    if (maintenanceRequest?.id) {
      navigate(`/tenant/maintenance/${maintenanceRequest.id}`);
      onClose();
      // Could add state or hash to open photo upload section
    }
  };

  const handleViewAllRequests = () => {
    navigate('/tenant/maintenance');
    onClose();
  };

  const message = `Your maintenance request #${maintenanceRequest?.id || ''} has been submitted successfully. Your landlord will be notified and will respond soon.`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 1
        }
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {/* Close button */}
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1
          }}
        >
          <CloseOutlined />
        </IconButton>

        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          {/* Success icon */}
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'success.lighter',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2
            }}
          >
            <CheckCircleOutlined
              style={{
                fontSize: 48,
                color: 'var(--mui-palette-success-main)'
              }}
            />
          </Box>

          {/* Title */}
          <Typography variant="h4" fontWeight={600} sx={{ mb: 2 }}>
            Request Submitted!
          </Typography>

          {/* Message */}
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {message}
          </Typography>

          {/* View Request Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleViewRequest}
              startIcon={<EyeOutlined />}
              sx={{
                textTransform: 'none',
                fontWeight: 600
              }}
            >
              View Request
            </Button>
          </Box>

          {/* Or separator */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
            <Typography variant="body2" color="text.secondary" sx={{ mx: 2 }}>
              Or
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
          </Box>

          {/* Secondary action cards */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            {/* Add More Photos Card */}
            <Card
              variant="outlined"
              sx={{
                flex: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: 2,
                  borderColor: 'primary.main'
                }
              }}
              onClick={handleAddMorePhotos}
            >
              <CardContent sx={{ p: 2.5, textAlign: 'left' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CloudUploadOutlined style={{ fontSize: 20, marginRight: 8, color: 'var(--mui-palette-text-secondary)' }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Add Photos
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Add more photos to help your landlord understand the issue better.
                </Typography>
                <Link
                  component="button"
                  variant="body2"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddMorePhotos();
                  }}
                  sx={{
                    textDecoration: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  Upload photos
                </Link>
              </CardContent>
            </Card>

            {/* View All Requests Card */}
            <Card
              variant="outlined"
              sx={{
                flex: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: 2,
                  borderColor: 'primary.main'
                }
              }}
              onClick={handleViewAllRequests}
            >
              <CardContent sx={{ p: 2.5, textAlign: 'left' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ToolOutlined style={{ fontSize: 20, marginRight: 8, color: 'var(--mui-palette-text-secondary)' }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    All Requests
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  View and track all your maintenance requests in one place.
                </Typography>
                <Link
                  component="button"
                  variant="body2"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewAllRequests();
                  }}
                  sx={{
                    textDecoration: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  View all
                </Link>
              </CardContent>
            </Card>
          </Stack>
        </DialogContent>
      </Box>
    </Dialog>
  );
};

MaintenanceRequestCreatedSuccessDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  maintenanceRequest: PropTypes.object,
  propertyName: PropTypes.string,
  unitName: PropTypes.string
};

export default MaintenanceRequestCreatedSuccessDialog;
