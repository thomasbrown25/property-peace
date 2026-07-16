import { useState } from 'react';
import {
  Box, Typography, Grid, Stack, TextField, Button, Divider, Alert,
  CircularProgress, Card, CardActionArea, useTheme, alpha,
  Chip, InputAdornment
} from '@mui/material';
import {
  MailOutlined, PhoneOutlined, SendOutlined,
  CustomerServiceOutlined, ClockCircleOutlined, PlayCircleOutlined,
  CommentOutlined, BugOutlined, LikeOutlined, BulbOutlined, SearchOutlined
} from '@ant-design/icons';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { motion, AnimatePresence } from 'framer-motion';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import VideoPlayer from 'components/videos/VideoPlayer';
import { getAllVideos, VIDEO_CATEGORIES } from 'data/videos';

// ==============================|| HELP & SUPPORT PAGE ||============================== //

const QUICK_ACTIONS = [
  { key: 'ticket',    title: 'Submit a Ticket',  description: 'Report an issue or get technical help',  Icon: CustomerServiceOutlined },
  { key: 'feedback',  title: 'Send Feedback',    description: 'Share ideas, bugs, or feature requests', Icon: CommentOutlined },
  { key: 'tutorials', title: 'Browse Tutorials', description: 'Watch video guides and walkthroughs',    Icon: PlayCircleOutlined }
];

const CONTACT_ITEMS = [
  { Icon: MailOutlined,        label: 'Email',         value: 'support@brownstonehub.com',       color: '#1890ff', bgcolor: 'primary.lighter' },
  { Icon: PhoneOutlined,       label: 'Phone',         value: '(864) 324-7107',                  color: '#52c41a', bgcolor: 'success.lighter' },
  { Icon: ClockCircleOutlined, label: 'Response Time', value: 'Typically within 5 - 30 minutes', color: '#722ed1', bgcolor: 'secondary.lighter' }
];

const FEEDBACK_TYPES = [
  {
    value: 'feedback',
    label: 'General Feedback',
    description: 'Share your thoughts about the product',
    Icon: LikeOutlined,
    color: '#1890ff',
    lightBg: '#e6f7ff'
  },
  {
    value: 'bug',
    label: 'Report a Bug',
    description: "Something isn't working as expected",
    Icon: BugOutlined,
    color: '#f5222d',
    lightBg: '#fff1f0'
  },
  {
    value: 'feature',
    label: 'Feature Request',
    description: 'Suggest a new feature or improvement',
    Icon: BulbOutlined,
    color: '#52c41a',
    lightBg: '#f6ffed'
  }
];

const FEEDBACK_PLACEHOLDERS = {
  feedback: 'Share your overall experience — what you love, what could be better, or anything else on your mind...',
  bug: 'Describe the issue in detail — steps to reproduce it, what you expected to happen, and what actually happened...',
  feature: 'Describe the feature you have in mind, the problem it would solve, and how you would use it...'
};

const TAB_ORDER = { ticket: 0, tutorials: 1, feedback: 2 };

const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir * -48 })
};

export default function SubmitSupportTicket() {
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState('ticket');
  const [slideDir, setSlideDir] = useState(0);

  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', message: '' });

  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ type: 'feedback', subject: '', message: '' });

  const [tutorialSearch, setTutorialSearch] = useState('');
  const [tutorialCategory, setTutorialCategory] = useState(null);

  const allVideos = getAllVideos();
  const videoCategories = Object.values(VIDEO_CATEGORIES);

  const filteredVideos = allVideos.filter((v) => {
    const matchesSearch =
      !tutorialSearch ||
      v.title.toLowerCase().includes(tutorialSearch.toLowerCase()) ||
      v.description?.toLowerCase().includes(tutorialSearch.toLowerCase()) ||
      v.tags?.some((t) => t.toLowerCase().includes(tutorialSearch.toLowerCase()));
    const matchesCategory = !tutorialCategory || VIDEO_CATEGORIES[v.category] === tutorialCategory;
    return matchesSearch && matchesCategory;
  });


  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    setSlideDir(TAB_ORDER[newTab] > TAB_ORDER[activeTab] ? 1 : -1);
    setActiveTab(newTab);
  };

  const handleTicketChange = (e) => setTicketForm({ ...ticketForm, [e.target.name]: e.target.value });
  const handleTicketClear = () => setTicketForm({ subject: '', message: '' });
  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      openSnackbar({ open: true, message: 'Please fill in all required fields', variant: 'alert', alert: { color: 'error' } });
      return;
    }
    setTicketSubmitting(true);
    setTicketSuccess(false);
    try {
      const response = await axiosServices.post('/api/support/submit-request', {
        type: 'tech-support',
        subject: ticketForm.subject.trim(),
        message: ticketForm.message.trim()
      });
      if (response.data?.success) {
        openSnackbar({ open: true, message: 'Your support request has been submitted!', variant: 'alert', alert: { color: 'success' } });
        setTicketSuccess(true);
        setTicketForm({ subject: '', message: '' });
        setTimeout(() => setTicketSuccess(false), 5000);
      } else {
        throw new Error(response.data?.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('[SubmitSupportTicket] Error:', error);
      openSnackbar({ open: true, message: error?.response?.data?.message || error?.message || 'Failed to submit. Please try again.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleFeedbackChange = (e) => setFeedbackForm({ ...feedbackForm, [e.target.name]: e.target.value });
  const handleFeedbackClear = () => setFeedbackForm({ type: 'feedback', subject: '', message: '' });
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackForm.subject.trim() || !feedbackForm.message.trim()) {
      openSnackbar({ open: true, message: 'Please fill in all required fields', variant: 'alert', alert: { color: 'error' } });
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackSuccess(false);
    try {
      const response = await axiosServices.post('/api/user/feedback', {
        type: feedbackForm.type,
        subject: feedbackForm.subject.trim(),
        message: feedbackForm.message.trim()
      });
      if (response.data?.success) {
        openSnackbar({ open: true, message: response.data?.message || "Thank you for your feedback!", variant: 'alert', alert: { color: 'success' } });
        setFeedbackSuccess(true);
        setFeedbackForm({ type: 'feedback', subject: '', message: '' });
        setTimeout(() => setFeedbackSuccess(false), 5000);
      } else {
        throw new Error(response.data?.message || 'Failed to submit feedback');
      }
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || error?.message || 'Failed to submit. Please try again.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
      <Box>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Help & Support' }
          ]}
        />

        {/* Hero Banner */}
        <Box
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            borderRadius: 2,
            p: { xs: 3, md: 4 },
            mb: 3
          }}
        >
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CustomerServiceOutlined style={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color: 'white', mb: 0.75 }}>
                Help & Support
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                Have a question or running into an issue? Our team is here to help.
              </Typography>
            </Box>
          </Stack>
        </Box>

        {/* Quick Action Tabs */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {QUICK_ACTIONS.map(({ key, title, description, Icon }) => {
            const active = activeTab === key;
            return (
              <Grid size={{ xs: 12, sm: 4 }} key={key}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: active ? 'primary.main' : 'divider',
                    bgcolor: active ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                    ...(!active && {
                      '&:hover': { borderColor: 'primary.light', boxShadow: theme.shadows[3] }
                    })
                  }}
                >
                  <CardActionArea
                    onClick={() => handleTabChange(key)}
                    disableRipple={active}
                    sx={{ p: 2, cursor: active ? 'default' : 'pointer' }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 40, height: 40,
                          bgcolor: active ? 'primary.main' : 'primary.lighter',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}
                      >
                        <Icon style={{ fontSize: 18, color: active ? 'white' : theme.palette.primary.main }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600} color={active ? 'primary.main' : 'text.primary'}>
                          {title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {description}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* Sliding Tab Content */}
        <Box sx={{ overflow: 'hidden' }}>
          <AnimatePresence mode="wait" custom={slideDir}>
            <motion.div
              key={activeTab}
              custom={slideDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >

              {/* ── TICKET TAB ── */}
              {activeTab === 'ticket' && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <MainCard>
                      <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>Submit a Support Request</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                        Describe your issue in detail and we'll follow up as soon as possible.
                      </Typography>
                      <Divider sx={{ mb: 3 }} />

                      {ticketSuccess && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setTicketSuccess(false)}>
                            Thank you! Our support team will review your request and get back to you shortly.
                          </Alert>
                        </motion.div>
                      )}

                      <form onSubmit={handleTicketSubmit}>
                        <Stack spacing={2.5}>
                          <TextField
                            name="subject"
                            label="Subject"
                            value={ticketForm.subject}
                            onChange={handleTicketChange}
                            fullWidth
                            required
                            placeholder="Brief description of your issue"
                            sx={{ '& .MuiOutlinedInput-root': {  } }}
                          />
                          <TextField
                            name="message"
                            label="Describe your issue"
                            value={ticketForm.message}
                            onChange={handleTicketChange}
                            fullWidth
                            required
                            multiline
                            rows={7}
                            placeholder="Please provide as much detail as possible — steps to reproduce, what you expected, and what actually happened..."
                            sx={{ '& .MuiOutlinedInput-root': {  } }}
                          />
                          <Box display="flex" justifyContent="flex-end" gap={1.5} sx={{ pt: 0.5 }}>
                            <Button variant="outlined" onClick={handleTicketClear} disabled={ticketSubmitting}>
                              Clear
                            </Button>
                            <Button
                              type="submit"
                              variant="contained"
                              startIcon={ticketSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendOutlined />}
                              disabled={ticketSubmitting}
                            >
                              {ticketSubmitting ? 'Submitting...' : 'Submit Request'}
                            </Button>
                          </Box>
                        </Stack>
                      </form>
                    </MainCard>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <MainCard sx={{ height: '100%' }}>
                      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Contact Information</Typography>
                      <Divider sx={{ mb: 3 }} />
                      <Stack spacing={2.5}>
                        {CONTACT_ITEMS.map(({ Icon, label, value, color, bgcolor }) => (
                          <Stack key={label} direction="row" spacing={2} alignItems="flex-start">
                            <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon style={{ fontSize: 16, color }} />
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                              <Typography variant="body2" fontWeight={500} sx={{ whiteSpace: 'pre-line' }}>{value}</Typography>
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    </MainCard>
                  </Grid>
                </Grid>
              )}

              {/* ── TUTORIALS TAB ── */}
              {activeTab === 'tutorials' && (
                <Box>
                  {/* Search */}
                  <TextField
                    fullWidth
                    placeholder="Search tutorials..."
                    value={tutorialSearch}
                    onChange={(e) => setTutorialSearch(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchOutlined style={{ color: theme.palette.text.secondary }} />
                          </InputAdornment>
                        )
                      }
                    }}
                    sx={{ mb: 2 }}
                  />

                  {/* Category chips + count */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip
                        label="All"
                        size="small"
                        onClick={() => setTutorialCategory(null)}
                        color={tutorialCategory === null ? 'primary' : 'default'}
                        sx={{ cursor: 'pointer' }}
                      />
                      {videoCategories.map((cat) => (
                        <Chip
                          key={cat}
                          label={cat}
                          size="small"
                          onClick={() => setTutorialCategory(cat)}
                          color={tutorialCategory === cat ? 'primary' : 'default'}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {filteredVideos.length} tutorial{filteredVideos.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>

                  {/* Grid */}
                  {filteredVideos.length === 0 ? (
                    <MainCard>
                      <Box sx={{ textAlign: 'center', py: 8 }}>
                        <PlayCircleOutlined style={{ fontSize: 40, color: theme.palette.text.disabled, marginBottom: 12 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 0.5 }}>No tutorials found</Typography>
                        <Typography variant="body2" color="text.secondary">Try a different search term or category</Typography>
                      </Box>
                    </MainCard>
                  ) : (
                    <Grid container spacing={2.5}>
                      {filteredVideos.map((video) => (
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={video.key}>
                          <Card
                            sx={{
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              overflow: 'hidden',
                              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                              '&:hover': { transform: 'translateY(-3px)', boxShadow: theme.shadows[6], borderColor: 'primary.light' }
                            }}
                          >
                            {/* Thumbnail with category badge */}
                            <Box sx={{ position: 'relative', bgcolor: 'grey.900', overflow: 'hidden', flexShrink: 0 }}>
                              <VideoPlayer videoId={video.id} title={video.title} thumbnailUrl={null} />
                              {VIDEO_CATEGORIES[video.category] && (
                                <Chip
                                  label={VIDEO_CATEGORIES[video.category]}
                                  size="small"
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                    bgcolor: alpha(theme.palette.primary.main, 0.9),
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.68rem',
                                    height: 20,
                                    backdropFilter: 'blur(4px)',
                                    '& .MuiChip-label': { px: 1 }
                                  }}
                                />
                              )}
                            </Box>

                            {/* Card content */}
                            <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <Typography
                                variant="subtitle2"
                                fontWeight={700}
                                sx={{ mb: 0.75, lineHeight: 1.4 }}
                              >
                                {video.title}
                              </Typography>
                              {video.description && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{
                                    lineHeight: 1.55,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {video.description}
                                </Typography>
                              )}
                            </Box>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              )}

              {/* ── FEEDBACK TAB ── */}
              {activeTab === 'feedback' && (
                <Box>
                  {/* Type selector cards */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    {FEEDBACK_TYPES.map(({ value, label, description, Icon, color, lightBg }) => {
                      const selected = feedbackForm.type === value;
                      return (
                        <Grid size={{ xs: 12, sm: 4 }} key={value}>
                          <Card
                            onClick={() => setFeedbackForm((prev) => ({ ...prev, type: value }))}
                            sx={{
                              border: '2px solid',
                              borderColor: selected ? color : 'divider',
                              bgcolor: selected ? lightBg : 'background.paper',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s ease, background-color 0.2s ease',
                              '&:hover': !selected ? { borderColor: color, bgcolor: lightBg } : {}
                            }}
                          >
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                              <Box
                                sx={{
                                  width: 52, height: 52, borderRadius: '50%',
                                  bgcolor: selected ? color : lightBg,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  mx: 'auto', mb: 1.5,
                                  transition: 'background-color 0.2s ease'
                                }}
                              >
                                <Icon style={{ fontSize: 22, color: selected ? 'white' : color }} />
                              </Box>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: selected ? color : 'text.primary' }}>
                                {label}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: 'block' }}>
                                {description}
                              </Typography>
                            </Box>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>

                  {/* Form */}
                  <MainCard>
                    {feedbackSuccess && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setFeedbackSuccess(false)}>
                          Thank you for your feedback! We'll review it and get back to you if needed.
                        </Alert>
                      </motion.div>
                    )}

                    <form onSubmit={handleFeedbackSubmit}>
                      <Stack spacing={2.5}>
                        <TextField
                          name="subject"
                          label="Subject"
                          value={feedbackForm.subject}
                          onChange={handleFeedbackChange}
                          fullWidth
                          required
                          placeholder="Brief description of your feedback"
                          sx={{ '& .MuiOutlinedInput-root': {  } }}
                        />
                        <Box sx={{ position: 'relative' }}>
                          <TextField
                            name="message"
                            label="Message"
                            value={feedbackForm.message}
                            onChange={handleFeedbackChange}
                            fullWidth
                            required
                            multiline
                            rows={6}
                            placeholder={FEEDBACK_PLACEHOLDERS[feedbackForm.type]}
                            slotProps={{ htmlInput: { maxLength: 2000 } }}
                            sx={{ '& .MuiOutlinedInput-root': {  } }}
                          />
                          <Typography
                            variant="caption"
                            color="text.disabled"
                            sx={{ position: 'absolute', bottom: 10, right: 12, pointerEvents: 'none' }}
                          >
                            {feedbackForm.message.length}/2000
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="flex-end" gap={1.5} sx={{ pt: 0.5 }}>
                          <Button variant="outlined" onClick={handleFeedbackClear} disabled={feedbackSubmitting}>
                            Clear
                          </Button>
                          <Button
                            type="submit"
                            variant="contained"
                            startIcon={feedbackSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
                            disabled={feedbackSubmitting}
                          >
                            {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                          </Button>
                        </Box>
                      </Stack>
                    </form>
                  </MainCard>
                </Box>
              )}

            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </motion.div>
  );
}
