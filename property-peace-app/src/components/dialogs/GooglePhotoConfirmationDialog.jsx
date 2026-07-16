import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  alpha,
  useTheme
} from '@mui/material';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';

export default function GooglePhotoConfirmationDialog({ open, photoUrl, onConfirm, onCancel, loading }) {
  const theme = useTheme();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (open && photoUrl) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [open, photoUrl]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h5" fontWeight={600}>
          Use Property Image?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          We found an image for this property. Would you like to use it?
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            minHeight: 300,
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: alpha(theme.palette.grey[500], 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {loading && (
            <CircularProgress />
          )}
          
          {!loading && photoUrl && !imageError && (
            <>
              {!imageLoaded && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.grey[500], 0.1)
                  }}
                >
                  <CircularProgress size={40} />
                </Box>
              )}
              <Box
                component="img"
                src={photoUrl}
                alt="Property photo from Google Maps"
                onLoad={handleImageLoad}
                onError={handleImageError}
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 400,
                  objectFit: 'contain',
                  display: imageLoaded ? 'block' : 'none'
                }}
              />
            </>
          )}

          {imageError && (
            <Typography variant="body2" color="error">
              Failed to load image
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          onClick={onCancel}
          variant="outlined"
          startIcon={<CloseOutlined />}
          disabled={loading}
        >
          No, Skip
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
          startIcon={<CheckOutlined />}
          disabled={loading || imageError}
          sx={{
            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
            '&:hover': {
              boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
            }
          }}
        >
          Yes, Use This Photo
        </Button>
      </DialogActions>
    </Dialog>
  );
}

