import { useState } from 'react';
import { Box, Typography, Grid, Stack, TextField, Button, Paper, Divider, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import { MailOutlined, PhoneOutlined, ClockCircleOutlined, SendOutlined, CustomerServiceOutlined, BulbOutlined } from '@ant-design/icons';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import MainCard from 'components/MainCard';

export default function ContactUs() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0); // 0 = Tech Support, 1 = Feedback
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    message: ''
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.subject.trim() || !form.message.trim()) {
      openSnackbar({
        open: true,
        message: 'Please fill in all required fields',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setSubmitting(true);
    try {
      const requestType = tab === 0 ? 'tech-support' : 'feedback';
      console.log('[ContactUs] Submitting request:', { type: requestType, subject: form.subject.trim() });
      
      const response = await axiosServices.post('/api/support/submit-request', {
        type: requestType,
        subject: form.subject.trim(),
        message: form.message.trim()
      });

      console.log('[ContactUs] Response received:', response.data);

      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: tab === 0 
            ? 'Your support request has been submitted. We will get back to you soon!'
            : 'Thank you for your feedback! We appreciate your input.',
          variant: 'alert',
          alert: { color: 'success' }
        });
        
        // Reset form
        setForm({ subject: '', message: '' });
      } else {
        throw new Error(response.data?.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('[ContactUs] Error submitting request:', error);
      console.error('[ContactUs] Error details:', {
        message: error?.message,
        response: error?.response,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
        responseHeaders: error?.response?.headers,
        stack: error?.stack
      });
      
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to submit request. Please try again.';
      console.error('[ContactUs] Error message to display:', errorMessage);
      
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainCard title="Get Help">
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Need technical support or have feedback? We're here to help.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Contact Info Section */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <MailOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <Box>
                  <Typography variant="subtitle2">Email</Typography>
                  <Typography variant="body2" color="text.secondary">
                    support@brownstonehub.com
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <PhoneOutlined style={{ fontSize: 20, color: '#41a541' }} />
                <Box>
                  <Typography variant="subtitle2">Phone</Typography>
                  <Typography variant="body2" color="text.secondary">
                    (864) 324-7107
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1.5} alignItems="center">
                <ClockCircleOutlined style={{ fontSize: 20, color: '#722ed1' }} />
                <Box>
                  <Typography variant="subtitle2">Response Time</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Typically within 5 - 30 minutes
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        {/* Contact Form Section */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Tabs value={tab} onChange={(e, newValue) => setTab(newValue)} sx={{ mb: 3 }}>
              <Tab 
                icon={<CustomerServiceOutlined />} 
                iconPosition="start"
                label="Tech Support" 
                sx={{ textTransform: 'none' }}
              />
              <Tab 
                icon={<BulbOutlined />} 
                iconPosition="start"
                label="Feedback & Feature Requests" 
                sx={{ textTransform: 'none' }}
              />
            </Tabs>
            <Divider sx={{ mb: 2 }} />

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  name="subject"
                  label="Subject"
                  value={form.subject}
                  onChange={handleChange}
                  fullWidth
                  required
                  size="small"
                  placeholder={tab === 0 ? "Brief description of your issue" : "Feature or feedback title"}
                />
                <TextField
                  name="message"
                  label={tab === 0 ? "Describe your issue" : "Tell us about your idea or feedback"}
                  value={form.message}
                  onChange={handleChange}
                  fullWidth
                  required
                  multiline
                  rows={6}
                  sx={{ '& .MuiOutlinedInput-root': {  } }}
                  placeholder={
                    tab === 0
                      ? "Please provide as much detail as possible about the technical issue you're experiencing..."
                      : "Share your thoughts, ideas, or suggestions for new features..."
                  }
                />
                <Box display="flex" justifyContent="flex-end">
                  <Button 
                    type="submit" 
                    variant="contained" 
                    startIcon={submitting ? <CircularProgress size={16} /> : <SendOutlined />}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : tab === 0 ? 'Submit Support Request' : 'Submit Feedback'}
                  </Button>
                </Box>
              </Stack>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </MainCard>
  );
}
