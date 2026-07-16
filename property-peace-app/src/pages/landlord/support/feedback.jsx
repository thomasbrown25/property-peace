import { useState } from 'react';
import { Box, Typography, Stack, TextField, Button, Alert, Select, MenuItem, FormControl, InputLabel, Paper } from '@mui/material';
import { CommentOutlined, BugOutlined, LikeOutlined, BulbOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import MainCard from 'components/MainCard';
import { motion } from 'framer-motion';

// ==============================|| SUBMIT FEEDBACK REQUEST PAGE ||============================== //

export default function SubmitFeedbackRequest() {
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
        subject: formData.subject.trim(),
        message: formData.message.trim()
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Box>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" fontWeight="bold">
              Submit Feedback Request
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Share your feedback, report bugs, or suggest new features
            </Typography>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
        >
          <MainCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <BulbOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Typography variant="h6" fontWeight="bold">
                Share Your Feedback
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              We value your opinion! Share your feedback, report bugs, or suggest new features.
            </Typography>

            {success && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
                  Thank you for your feedback! We'll review it and get back to you if needed.
                </Alert>
              </motion.div>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                >
                  <FormControl fullWidth>
                    <InputLabel>Feedback Type</InputLabel>
                    <Select
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      label="Feedback Type"
                      size="medium"
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
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.4 }}
                >
                  <TextField
                    label="Subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    fullWidth
                    variant="outlined"
                    size="medium"
                    required
                    placeholder="Brief description of your feedback"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.5 }}
                >
                  <TextField
                    label="Message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    fullWidth
                    multiline
                    rows={6}
                    variant="outlined"
                    size="medium"
                    required
                    placeholder="Please provide as much detail as possible..."
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.6 }}
                >
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
                </motion.div>
              </Stack>
            </form>
          </MainCard>
        </motion.div>
      </Box>
    </motion.div>
  );
}
