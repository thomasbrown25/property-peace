import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Stack, 
  InputAdornment,
  TextField,
  Chip,
  alpha,
  Tabs,
  Tab,
  Button,
  Divider,
  Container,
  useTheme,
  Alert
} from '@mui/material';
import { SearchOutlined, PlayCircleOutlined, CustomerServiceOutlined, SendOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import VideoPlayer from 'components/videos/VideoPlayer';
import { getAllVideos, VIDEO_CATEGORIES } from 'data/videos';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';

// ==============================|| HELP & TUTORIALS PAGE ||============================== //

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`help-tabpanel-${index}`}
      aria-labelledby={`help-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function HelpPage() {
  // Check if user is a tenant
  const { user } = useAuth();
  const userRoles = Array.isArray(user?.Roles) ? user?.Roles : Array.isArray(user?.roles) ? user?.roles : [];
  const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
  const isTenant = normalizedRoles.includes('tenant');
  
  // For tenants, default to Contact Tech Support tab (index 0 since Video Tutorials is hidden)
  // For landlords, default to Video Tutorials tab (index 0)
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const theme = useTheme();

  // Tech support form state
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportForm, setSupportForm] = useState({
    subject: '',
    message: ''
  });

  const allVideos = getAllVideos();
  const categories = Object.values(VIDEO_CATEGORIES);

  // Filter videos based on search and category
  const filteredVideos = allVideos.filter(video => {
    const matchesSearch = searchQuery === '' || 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory || 
      VIDEO_CATEGORIES[video.category] === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group videos by category for display
  const videosByCategory = filteredVideos.reduce((acc, video) => {
    const categoryName = VIDEO_CATEGORIES[video.category] || 'Other';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(video);
    return acc;
  }, {});

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSupportChange = (e) => {
    setSupportForm({
      ...supportForm,
      [e.target.name]: e.target.value
    });
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setSupportLoading(true);
    setSupportSuccess(false);
    
    try {
      const response = await axiosServices.post('/api/user/feedback', {
        type: 'tech-support',
        subject: supportForm.subject.trim(),
        message: supportForm.message.trim()
      });
      
      if (response.data?.success) {
        openSnackbar({
          open: true,
          message: response.data?.message || 'Thank you for contacting us! Our support team will get back to you soon.',
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });
        
        setSupportSuccess(true);
        setSupportForm({
          subject: '',
          message: ''
        });
        setTimeout(() => setSupportSuccess(false), 5000);
      } else {
        throw new Error(response.data?.message || 'Failed to submit support request');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || error.message || 'Failed to submit support request',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });
    } finally {
      setSupportLoading(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={(t) => ({
          mb: 4,
          p: 2.5,
          borderRadius: 2.25,
          border: `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.22) : alpha(t.palette.divider, 0.14)}`,
          bgcolor: 'background.paper',
          boxShadow: `0 4px 20px ${alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.07)}`,
          ...(t.palette.mode === 'dark' && {
            backgroundColor: '#111827',
            backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.035)} 0%, ${alpha('#ffffff', 0.005)} 100%)`
          })
        })}
      >
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
          {isTenant ? 'Help & Support' : 'Help and Tutorials'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isTenant ? 'Get technical support and assistance' : 'Watch step-by-step video tutorials and get technical support'}
        </Typography>
      </Box>

      <MainCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="help and tutorials tabs"
          >
            {!isTenant && (
              <Tab 
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PlayCircleOutlined />
                    <Typography>Video Tutorials</Typography>
                  </Stack>
                } 
                id="help-tab-0"
                aria-controls="help-tabpanel-0"
              />
            )}
            <Tab 
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <CustomerServiceOutlined />
                  <Typography>Contact Tech Support</Typography>
                </Stack>
              } 
              id={isTenant ? "help-tab-0" : "help-tab-1"}
              aria-controls={isTenant ? "help-tabpanel-0" : "help-tabpanel-1"}
            />
          </Tabs>
        </Box>

        {!isTenant && (
          <TabPanel value={tabValue} index={0}>
            <>
              {/* Search and Filter */}
              <MainCard sx={{ mb: 4 }}>
                <Stack spacing={3}>
                  {/* Search Bar */}
                  <TextField
                    fullWidth
                    placeholder="Search tutorials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchOutlined />
                        </InputAdornment>
                      )
                    }}
                  />

                  {/* Category Chips */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Filter by Category
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        label="All"
                        onClick={() => setSelectedCategory(null)}
                        color={selectedCategory === null ? 'primary' : 'default'}
                        sx={{ cursor: 'pointer' }}
                      />
                      {categories.map((category) => (
                        <Chip
                          key={category}
                          label={category}
                          onClick={() => setSelectedCategory(category)}
                          color={selectedCategory === category ? 'primary' : 'default'}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </MainCard>

              {/* Video Grid */}
              {Object.keys(videosByCategory).length === 0 ? (
                <MainCard>
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                      No tutorials found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your search or filter criteria
                    </Typography>
                  </Box>
                </MainCard>
              ) : (
                Object.entries(videosByCategory).map(([categoryName, videos]) => (
                  <Box key={categoryName} sx={{ mb: 4 }}>
                    <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                      {categoryName}
                    </Typography>
                    <Grid container spacing={3}>
                      {videos.map((video) => (
                        <Grid item xs={12} md={6} lg={4} key={video.key}>
                          <Paper
                            sx={{
                              p: 2,
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                boxShadow: 4,
                                transform: 'translateY(-2px)'
                              },
                              cursor: 'pointer',
                              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                              overflow: 'hidden'
                            }}
                            onClick={() => setSelectedVideo(selectedVideo?.key === video.key ? null : video)}
                          >
                            <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                              <VideoPlayer 
                                videoId={video.id}
                                title={video.title}
                                thumbnailUrl={null}
                              />
                            </Box>
                            <Box sx={{ mt: 2, flex: 1 }}>
                              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                                {video.title}
                              </Typography>
                              {video.description && (
                                <Typography variant="body2" color="text.secondary">
                                  {video.description}
                                </Typography>
                              )}
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                ))
              )}

              {/* Quick Tips Section */}
              <MainCard sx={{ mt: 4 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                  Quick Tips
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        💡 Tip: Contextual Help
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Look for the question mark icon (?) on pages where video tutorials are available.
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        📚 Tip: New User?
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Start with the "Setup & Account" category to get your account configured properly.
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </MainCard>
            </>
          </TabPanel>
        )}

        <TabPanel value={tabValue} index={isTenant ? 0 : 1}>
          <Container maxWidth="md">
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <CustomerServiceOutlined 
                style={{ 
                  fontSize: 64, 
                  color: theme.palette.primary.main,
                  marginBottom: 16
                }} 
              />
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                Need Technical Support?
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Our support team is here to help! Describe your issue and we'll get back to you as soon as possible.
              </Typography>
            </Box>

            {supportSuccess && (
              <Alert 
                severity="success" 
                sx={{ mb: 3 }}
                onClose={() => setSupportSuccess(false)}
              >
                Thank you for contacting us! Our support team will review your request and get back to you soon.
              </Alert>
            )}

            <Paper 
              variant="outlined" 
              sx={{ 
                p: 4,
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
              }}
            >
              <form onSubmit={handleSupportSubmit}>
                <Stack spacing={3}>
                  <TextField
                    label="Subject"
                    name="subject"
                    value={supportForm.subject}
                    onChange={handleSupportChange}
                    fullWidth
                    variant="outlined"
                    required
                    placeholder="Brief description of your issue"
                    helperText="Give your support request a clear, descriptive title"
                  />

                  <TextField
                    label="Message"
                    name="message"
                    value={supportForm.message}
                    onChange={handleSupportChange}
                    fullWidth
                    multiline
                    rows={8}
                    variant="outlined"
                    required
                    placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce the problem, and what you were trying to do when it occurred."
                    helperText="The more detail you provide, the faster we can help resolve your issue"
                  />

                  {user?.Email || user?.email ? (
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Reply to:</strong> {user?.Email || user?.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        We'll send our response to this email address
                      </Typography>
                    </Box>
                  ) : null}

                  <Divider />

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 1 }}>
                    <Button 
                      variant="outlined" 
                      onClick={() => setSupportForm({ subject: '', message: '' })}
                      disabled={supportLoading}
                    >
                      Clear
                    </Button>
                    <Button 
                      type="submit" 
                      variant="contained" 
                      disabled={supportLoading}
                      startIcon={<SendOutlined />}
                      size="large"
                    >
                      {supportLoading ? 'Sending...' : 'Send Support Request'}
                    </Button>
                  </Box>
                </Stack>
              </form>
            </Paper>

            <Box sx={{ mt: 4, p: 3, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
              <Stack direction="row" spacing={2}>
                <CustomerServiceOutlined style={{ fontSize: 24, color: theme.palette.info.main, flexShrink: 0 }} />
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                    What to Expect
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Our support team typically responds within minutes. For urgent issues, please include 
                    "URGENT" in your subject line. Make sure to check your email (including spam folder) for our response.
                  </Typography>
                  {!isTenant && (
                    <>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                        Before Contacting Support
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Check our video tutorials above - you might find a quick answer! Also, make sure you've tried 
                        refreshing the page and clearing your browser cache if you're experiencing technical issues.
                      </Typography>
                    </>
                  )}
                  {isTenant && (
                    <>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                        Before Contacting Support
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Make sure you've tried refreshing the page and clearing your browser cache if you're experiencing technical issues.
                      </Typography>
                    </>
                  )}
                </Box>
              </Stack>
            </Box>
          </Container>
        </TabPanel>
      </MainCard>
    </Box>
  );
}
