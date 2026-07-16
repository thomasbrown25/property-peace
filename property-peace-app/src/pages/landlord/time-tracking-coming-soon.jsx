import { Container, Stack, Typography, Box, Card, CardContent, useTheme, alpha } from '@mui/material';
import { ClockCircleOutlined, UserOutlined, HomeOutlined, CheckCircleOutlined } from '@ant-design/icons';

// project imports
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

// ================================|| LANDLORD - TIME TRACKING COMING SOON ||================================ //

export default function TimeTrackingComingSoon() {
  const theme = useTheme();

  return (
    <Box>
      <PageBreadcrumbs title="Time Tracking" />
      
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <MainCard sx={{ borderRadius: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, py: 5, px: 3 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ClockCircleOutlined style={{ fontSize: 48, color: theme.palette.primary.main }} />
            </Box>
            
            <Stack spacing={3} sx={{ textAlign: 'center', maxWidth: 600 }}>
              <Typography variant="h3" fontWeight={700}>
                Coming Soon
              </Typography>
              
              <Typography variant="h6" color="text.secondary" fontWeight={500}>
                Time Tracking
              </Typography>
              
              <Card 
                variant="outlined" 
                sx={{ 
                  mt: 2, 
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                  borderColor: alpha(theme.palette.primary.main, 0.2),
                  borderWidth: 2
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.8 }}>
                    We're working on an exciting new feature that will revolutionize how you track staff time. 
                    The Time Tracking feature will allow you to:
                  </Typography>
                  
                  <Stack spacing={2.5} sx={{ textAlign: 'left', mt: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          mt: 0.5
                        }}
                      >
                        <ClockCircleOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                          Track Work Hours
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                          Monitor how long staff members spend working on each property with accurate time tracking.
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          mt: 0.5
                        }}
                      >
                        <HomeOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                          Property-Specific Tracking
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                          Assign time entries to specific properties to understand where your team spends their time.
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          mt: 0.5
                        }}
                      >
                        <UserOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                          Staff Management
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                          Efficiently manage and review time entries for all your staff members in one centralized location.
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                  
                  <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      Stay tuned for updates! We're working hard to bring you this powerful feature soon.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </MainCard>
      </Container>
    </Box>
  );
}
