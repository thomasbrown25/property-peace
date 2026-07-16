import { Box, Typography, Stack, Paper, Button, alpha, Link, Divider } from '@mui/material';
import { QuestionCircleOutlined, BookOutlined, MessageOutlined, MailOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

// ==============================|| SUPPORT SETTINGS ||============================== //

export default function SupportSettings() {
  const navigate = useNavigate();

  return (
    <Box>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <QuestionCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Get Support
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Need help? We're here to assist you with any questions or issues you may have.
          </Typography>

          <Stack spacing={2}>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: (t) => alpha(t.palette.background.paper, 0.3),
                '&:hover': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  cursor: 'pointer'
                }
              }}
              onClick={() => navigate('/landlord/help')}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <PlayCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Video Tutorials
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Watch step-by-step video guides for all features
                  </Typography>
                </Box>
                <Button variant="outlined" size="small" onClick={(e) => { e.stopPropagation(); navigate('/landlord/help'); }}>
                  Watch Tutorials
                </Button>
              </Stack>
            </Paper>

            <Divider />

            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: (t) => alpha(t.palette.background.paper, 0.3),
                '&:hover': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  cursor: 'pointer'
                }
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Documentation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Browse our comprehensive documentation and guides
                  </Typography>
                </Box>
                <Link 
                  href="https://codedthemes.support-hub.io/" 
                  target="_blank" 
                  underline="none"
                  sx={{ color: 'primary.main' }}
                >
                  <Button variant="outlined" size="small">
                    Visit Docs
                  </Button>
                </Link>
              </Stack>
            </Paper>

            <Divider />

            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: (t) => alpha(t.palette.background.paper, 0.3),
                '&:hover': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  cursor: 'pointer'
                }
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <MessageOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Support Hub
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Get help from our support team
                  </Typography>
                </Box>
                <Link 
                  href="https://codedthemes.support-hub.io/" 
                  target="_blank" 
                  underline="none"
                  sx={{ color: 'primary.main' }}
                >
                  <Button variant="outlined" size="small">
                    Open Support
                  </Button>
                </Link>
              </Stack>
            </Paper>

            <Divider />

            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: (t) => alpha(t.palette.background.paper, 0.3),
                '&:hover': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                  cursor: 'pointer'
                }
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <MailOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Contact Support
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Send us an email and we'll get back to you soon
                  </Typography>
                </Box>
                <Link 
                  href="mailto:support@brownstonehub.com" 
                  underline="none"
                  sx={{ color: 'primary.main' }}
                >
                  <Button variant="outlined" size="small">
                    Email Us
                  </Button>
                </Link>
              </Stack>
            </Paper>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}

