import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import * as AntIcons from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { landlordUpcomingFeaturesAPI } from 'api/landlord/upcoming-features';
import { openSnackbar } from 'api/snackbar';

export default function UpcomingFeatures() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      const response = await landlordUpcomingFeaturesAPI.getActive();

      if (response.success) {
        setFeatures(response.data || []);
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to load upcoming features',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error loading features:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load upcoming features',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getIconComponent = (iconName) => {
    if (!iconName) return AntIcons.RocketOutlined;
    
    // Try to get the icon from Ant Design icons
    const IconComponent = AntIcons[iconName];
    if (IconComponent) {
      return IconComponent;
    }
    
    // Fallback to RocketOutlined if icon not found
    return AntIcons.RocketOutlined;
  };

  const getIconColor = (index) => {
    const colors = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.info.main,
      theme.palette.warning.main
    ];
    return colors[index % colors.length];
  };


  return (
    <Container maxWidth="lg">
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Upcoming Features' }
        ]}
      />
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
          Upcoming Features
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Here's what we're working on to make your experience even better
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress size={48} />
        </Box>
      ) : features.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Alert 
              severity="info" 
              sx={{ 
                maxWidth: 500, 
                mx: 'auto',
                '& .MuiAlert-icon': {
                  fontSize: 32
                }
              }}
            >
              <Typography variant="h6" sx={{ mb: 1 }}>
                No upcoming features yet
              </Typography>
              <Typography variant="body2">
                Check back soon for exciting new features we're working on!
              </Typography>
            </Alert>
          </Box>
        </MainCard>
      ) : (
        <Grid container spacing={3}>
          {features.map((feature, index) => {
            const IconComponent = getIconComponent(feature.icon);
            const iconColor = getIconColor(index);
            
            return (
              <Grid item xs={12} md={6} key={feature.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    overflow: 'hidden',
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: theme.shadows[8],
                      borderColor: alpha(iconColor, 0.3)
                    },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: `linear-gradient(90deg, ${iconColor} 0%, ${alpha(iconColor, 0.5)} 100%)`,
                      opacity: 0,
                      transition: 'opacity 0.3s'
                    },
                    '&:hover::before': {
                      opacity: 1
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 2.5,
                            background: `linear-gradient(135deg, ${alpha(iconColor, 0.15)} 0%, ${alpha(iconColor, 0.05)} 100%)`,
                            border: `1.5px solid ${alpha(iconColor, 0.2)}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.3s',
                            '&:hover': {
                              transform: 'scale(1.05) rotate(5deg)',
                              background: `linear-gradient(135deg, ${alpha(iconColor, 0.2)} 0%, ${alpha(iconColor, 0.1)} 100%)`
                            }
                          }}
                        >
                          <IconComponent 
                            style={{ 
                              fontSize: 28, 
                              color: iconColor 
                            }} 
                          />
                        </Box>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Typography 
                            variant="h5" 
                            fontWeight="bold" 
                            sx={{ 
                              mb: 1,
                              color: theme.palette.text.primary,
                              lineHeight: 1.3
                            }}
                          >
                            {feature.title}
                          </Typography>
                          {feature.expectedDate && (
                            <Chip
                              icon={<AntIcons.CalendarOutlined style={{ fontSize: 14 }} />}
                              label={`Expected: ${formatDate(feature.expectedDate)}`}
                              size="small"
                              sx={{ 
                                mt: 0.5,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.primary.main,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                fontWeight: 500,
                                '& .MuiChip-icon': {
                                  color: theme.palette.primary.main
                                }
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                      {feature.description && (
                        <Typography 
                          variant="body1" 
                          color="text.secondary" 
                          sx={{ 
                            lineHeight: 1.7,
                            fontSize: '0.95rem',
                            color: theme.palette.text.secondary
                          }}
                        >
                          {feature.description}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
            })}
          </Grid>
      )}
    </Container>
  );
}

