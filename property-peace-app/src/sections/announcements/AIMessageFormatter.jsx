import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Stack,
  Grid,
  CircularProgress,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import { CheckCircleOutlined, EditOutlined } from '@ant-design/icons';

// project imports
import { announcementAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

// ==============================|| AI MESSAGE FORMATTER ||============================== //

export default function AIMessageFormatter({ open, onClose, originalMessage, onMessageAccepted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [originalText, setOriginalText] = useState(originalMessage);
  const [formattedText, setFormattedText] = useState('');
  const [hasAutoFormatted, setHasAutoFormatted] = useState(false);

  // Update originalText when originalMessage prop changes
  useEffect(() => {
    setOriginalText(originalMessage);
    setFormattedText(''); // Reset formatted text when original changes
    setHasAutoFormatted(false);
  }, [originalMessage]);

  // Auto-format when dialog opens if there's a message
  useEffect(() => {
    if (open && originalMessage.trim() && !formattedText && !loading && !hasAutoFormatted) {
      setHasAutoFormatted(true);
      handleFormat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, originalMessage]);

  const handleFormat = async () => {
    if (!originalText.trim()) {
      setError('Please enter a message to format');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await announcementAPI.formatMessageWithAI(originalText);
      if (response.success && response.data) {
        setFormattedText(response.data);
        openSnackbar({
          open: true,
          message: 'Message enhanced successfully',
          variant: 'alert',
          alert: { color: 'success' },
          autoHideDuration: 3000
        });
      } else {
        setError(response.message || 'Failed to format message');
        openSnackbar({
          open: true,
          message: response.message || 'Failed to enhance message',
          variant: 'alert',
          alert: { color: 'error' },
          autoHideDuration: 3000
        });
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to format message';
      setError(errorMsg);
      openSnackbar({
        open: true,
        message: errorMsg,
        variant: 'alert',
        alert: { color: 'error' },
        autoHideDuration: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseOriginal = () => {
    onMessageAccepted(originalText);
  };

  const handleUseFormatted = () => {
    if (!formattedText.trim()) {
      setError('No formatted message available. Please format the message first.');
      return;
    }
    onMessageAccepted(formattedText);
  };

  // Reset when dialog opens/closes
  const handleClose = () => {
    setError(null);
    setFormattedText('');
    setOriginalText(originalMessage);
    setHasAutoFormatted(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <EditOutlined />
          <Typography variant="h6">Enhance Message with AI</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            AI will enhance your message to be professional and clear while maintaining your original intent.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Original Message</Typography>
                  <Chip label="Editable" size="small" variant="outlined" />
                </Stack>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={10}
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                placeholder="Type your message here..."
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    
                  }
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Box sx={{ mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Enhanced Message</Typography>
                  {formattedText && <Chip label="AI Enhanced" size="small" color="success" />}
                </Stack>
              </Box>
              {loading ? (
                <Box
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                  alignItems="center"
                  sx={{ height: '100%', minHeight: 250 }}
                >
                  <CircularProgress sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    AI is enhancing your message...
                  </Typography>
                </Box>
              ) : (
                <TextField
                  fullWidth
                  multiline
                  rows={10}
                  value={formattedText}
                  onChange={(e) => setFormattedText(e.target.value)}
                  placeholder="AI formatted message will appear here..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      
                    }
                  }}
                />
              )}
            </Grid>
          </Grid>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={handleFormat}
              disabled={loading || !originalText.trim()}
              startIcon={loading ? <CircularProgress size={16} /> : <EditOutlined />}
            >
              {loading ? 'Enhancing...' : 'Enhance with AI'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        {formattedText && (
          <Button 
            onClick={handleUseFormatted} 
            variant="contained" 
            color="primary"
            startIcon={<CheckCircleOutlined />}
          >
            Accept
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

AIMessageFormatter.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  originalMessage: PropTypes.string.isRequired,
  onMessageAccepted: PropTypes.func.isRequired
};
