import { Box, Typography, Stack, Chip, useMediaQuery, useTheme, Fade } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CalendarOutlined } from '@ant-design/icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TrialBanner from 'components/subscription/TrialBanner';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function DashboardHeader({ userName, onCreateNew, subscription = null, subscriptionLoading = false, summaryText = null }) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const greeting = getGreeting();
  const today = format(new Date(), 'EEEE, MMMM d');
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeIn(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Fade in={fadeIn} timeout={500}>
        <Box sx={{ mb: 0 }}>
          {/* Date chip — sits above, separate from the flex row */}
          <Chip
            icon={<CalendarOutlined style={{ fontSize: 13 }} />}
            label={today}
            size="small"
            variant="outlined"
            sx={{
              height: 26,
              mb: 1,
              borderColor: alpha(theme.palette.divider, 0.2),
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              '& .MuiChip-label': { fontSize: '0.72rem', fontWeight: 500 }
            }}
          />

          {/* Greeting row — buttons centered against greeting + summary block */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant={isXs ? 'h3' : 'h2'}
                fontWeight={700}
                sx={{ lineHeight: 1.15, letterSpacing: '-0.025em', color: 'text.primary' }}
              >
                {greeting}
                {userName ? `, ${userName.split(' ')[0]}.` : '.'}
              </Typography>
              {summaryText && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mt: 0.75 }}>
                  {summaryText}
                </Typography>
              )}
            </Box>

            {onCreateNew && (
              <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0 }}>
                {onCreateNew}
              </Box>
            )}
          </Stack>

        </Box>
      </Fade>
    </>
  );
}
