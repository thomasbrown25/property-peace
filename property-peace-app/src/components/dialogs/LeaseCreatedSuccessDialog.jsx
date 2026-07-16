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
  Link,
  Grid,
  useTheme,
  alpha
} from '@mui/material';
import { 
  CloseOutlined, 
  FileTextOutlined, 
  EditOutlined, 
  CloudUploadOutlined, 
  DollarOutlined 
} from '@ant-design/icons';

const LeaseCreatedSuccessDialog = ({
  open,
  onClose,
  lease,
  leaseCount,
  propertyName,
  propertyId,
  unitId,
  isBulk = false,
  onActionClick
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  // Get property ID from lease or props
  const finalPropertyId = propertyId || lease?.propertyId || lease?.PropertyId;

  const handleGetLeaseAgreement = () => {
    if (onActionClick) onActionClick();
    if (isBulk || !lease?.id) {
      navigate('/landlord/leases/builder');
    } else {
      const finalUnitId = unitId || lease?.unitId || lease?.UnitId;
      const lid = lease.id || lease.Id;
      if (finalPropertyId) {
        const query = `leaseId=${lid}&propertyId=${finalPropertyId}${finalUnitId ? `&unitId=${finalUnitId}` : ''}`;
        navigate(`/landlord/leases/build-lease-agreement?${query}`);
      } else {
        navigate(`/landlord/leases/build-lease-agreement?leaseId=${lid}`);
      }
    }
    onClose();
  };

  const handleESign = () => {
    if (onActionClick) onActionClick();
    if (finalPropertyId) {
      navigate(`/landlord/property/${finalPropertyId}/e-sign`);
    } else if (lease?.id) {
      // If we have lease but no property, try to get property from lease
      navigate(`/landlord/leases/${lease.id}`);
    } else {
      navigate('/landlord/properties');
    }
    onClose();
  };

  const handleStoreDocument = () => {
    if (onActionClick) onActionClick();
    if (finalPropertyId) {
      navigate(`/landlord/property/${finalPropertyId}?tab=documents`);
    } else if (lease?.id) {
      navigate(`/landlord/leases/${lease.id}`);
    } else {
      navigate('/landlord/properties');
    }
    onClose();
  };

  const handleCollectRent = () => {
    if (onActionClick) onActionClick();
    if (finalPropertyId) {
      navigate(`/landlord/property/${finalPropertyId}`);
    } else if (lease?.id) {
      navigate(`/landlord/leases/${lease.id}`);
    } else {
      navigate('/landlord/properties');
    }
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 0
        }
      }}
    >
      <Box sx={{ position: 'relative', bgcolor: 'background.paper' }}>
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

        <DialogContent sx={{ p: 4 }}>
          {/* Header */}
          <Typography 
            variant="h4" 
            fontWeight={600} 
            sx={{ 
              mb: 4, 
              textAlign: 'center',
              color: 'text.primary'
            }}
          >
            What do you want to do first?
          </Typography>

          {/* Cards Grid */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Get a Lease Agreement */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 4,
                    borderColor: 'primary.main'
                  }
                }}
                onClick={handleGetLeaseAgreement}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    <FileTextOutlined 
                      style={{ 
                        fontSize: 32, 
                        color: theme.palette.primary.main 
                      }} 
                    />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                    Get a Lease Agreement
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 2, minHeight: 40 }}
                  >
                    Be prepared for new tenants. Our lease agreement keeps you compliant and covered!
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGetLeaseAgreement();
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1
                    }}
                  >
                    GET A LEASE AGREEMENT
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Get a Document E-Signed */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 4,
                    borderColor: 'primary.main'
                  }
                }}
                onClick={handleESign}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    <EditOutlined 
                      style={{ 
                        fontSize: 32, 
                        color: theme.palette.primary.main 
                      }} 
                    />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                    Get a Document E-Signed
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 2, minHeight: 40 }}
                  >
                    Make signing documents convenient for everyone involved in a fraction of the time!
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      handleESign();
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1
                    }}
                  >
                    SET UP E-SIGNATURES
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Store a Lease Document */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 4,
                    borderColor: 'primary.main'
                  }
                }}
                onClick={handleStoreDocument}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    <CloudUploadOutlined 
                      style={{ 
                        fontSize: 32, 
                        color: theme.palette.primary.main 
                      }} 
                    />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                    Store a Lease Document
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 2, minHeight: 40 }}
                  >
                    Keep organized by storing all completed lease documents in one place.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStoreDocument();
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1
                    }}
                  >
                    UPLOAD A DOCUMENT
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Collect Rent Online */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 4,
                    borderColor: 'primary.main'
                  }
                }}
                onClick={handleCollectRent}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    <DollarOutlined 
                      style={{ 
                        fontSize: 32, 
                        color: theme.palette.primary.main 
                      }} 
                    />
                  </Box>
                  <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                    Collect Rent Online
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 2, minHeight: 40 }}
                  >
                    Forget the hassle of checks! Make it easy to get paid when you set up rent payments.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCollectRent();
                    }}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1
                    }}
                  >
                    SET UP RENT PAYMENTS
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Skip Link */}
          <Box sx={{ textAlign: 'center' }}>
            <Link
              component="button"
              variant="body2"
              onClick={handleSkip}
              sx={{
                textDecoration: 'none',
                fontWeight: 600,
                color: 'primary.main',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              SKIP FOR NOW
            </Link>
          </Box>
        </DialogContent>
      </Box>
    </Dialog>
  );
};

LeaseCreatedSuccessDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  lease: PropTypes.object,
  leaseCount: PropTypes.number,
  propertyName: PropTypes.string,
  propertyId: PropTypes.number,
  unitId: PropTypes.number,
  isBulk: PropTypes.bool,
  onActionClick: PropTypes.func
};

export default LeaseCreatedSuccessDialog;
