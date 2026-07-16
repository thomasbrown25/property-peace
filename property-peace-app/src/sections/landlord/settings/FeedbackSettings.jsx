import { useState } from 'react';
import { Box, Typography, Stack, Paper, TextField, Button, alpha, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { CommentOutlined, BugOutlined, LikeOutlined, DislikeOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

// ==============================|| FEEDBACK SETTINGS ||============================== //

export default function FeedbackSettings() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    type: 'feedback',
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    
    try {
      const response = await axiosServices.post('/api/user/feedback', {
        type: formData.type,
        subject: formData.subject,
        message: formData.message
      });
      
      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: response.data?.message || 'Thank you for your feedback! We\'ll review it and get back to you if needed.',
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });
        
        setSuccess(true);
        setFormData({
          type: 'feedback',
          subject: '',
          message: ''
        });
        setTimeout(() => setSuccess(false), 5000);
      } else {
        throw new Error(response.data?.message || 'Failed to submit feedback');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to submit feedback',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CommentOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Share Your Feedback
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            We value your opinion! Share your feedback, report bugs, or suggest new features.
          </Typography>

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
              Thank you for your feedback! We'll review it and get back to you if needed.
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Feedback Type</InputLabel>
                <Select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  label="Feedback Type"
                >
                  <MenuItem value="feedback">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LikeOutlined />
                      <Typography>General Feedback</Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="bug">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <BugOutlined />
                      <Typography>Report a Bug</Typography>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="feature">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CommentOutlined />
                      <Typography>Feature Request</Typography>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                required
                placeholder="Brief description of your feedback"
              />

              <TextField
                label="Message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                fullWidth
                multiline
                rows={6}
                variant="outlined"
                required
                placeholder="Please provide as much detail as possible..."
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
                <Button 
                  variant="outlined" 
                  onClick={() => setFormData({ type: 'feedback', subject: '', message: '' })}
                >
                  Clear
                </Button>
                <Button type="submit" variant="contained" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </Box>
            </Stack>
          </form>

          <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight="medium" sx={{ mb: 1 }}>
              Alternative Ways to Provide Feedback
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CommentOutlined style={{ fontSize: 16, color: '#666' }} />
                <Typography variant="body2" color="text.secondary">
                  Visit our{' '}
                  <a 
                    href="https://codedthemes.support-hub.io/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#1890ff', textDecoration: 'none' }}
                  >
                    Support Hub
                  </a>
                  {' '}for more options
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}

