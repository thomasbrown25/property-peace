import { useState } from 'react';
import { Box, Typography, Stack, Paper, TextField, Button, alpha, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { CommentOutlined, BugOutlined, LikeOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import MainCard from 'components/MainCard';

// ==============================|| FEEDBACK PAGE ||============================== //

export default function Feedback() {
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Feedback
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Share your feedback, report bugs, or suggest new features
        </Typography>
      </Box>

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'transparent' }}>
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
                sx={{ '& .MuiOutlinedInput-root': {  } }}
                placeholder="Please provide as much detail as possible..."
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 2 }}>
                <Button 
                  variant="outlined" 
                  size="medium"
                  onClick={() => setFormData({ type: 'feedback', subject: '', message: '' })}
                >
                  Clear
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  size="medium"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Feedback'}
                </Button>
              </Box>
            </Stack>
          </form>
        </Paper>
      </MainCard>
    </Box>
  );
}

