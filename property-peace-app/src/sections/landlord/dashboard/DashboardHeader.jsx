import { Box, Typography, Stack, Button, useMediaQuery, useTheme, Fade } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export default function DashboardHeader({ userName, onCreateNew, summaryText = null, stats = [] }) {
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
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: { xs: 2.5, md: 3 },
            px: { xs: 2.25, sm: 3, md: 3.5 },
            pt: { xs: 2.5, md: 3 },
            pb: { xs: 2.25, md: 2.5 },
            color: '#fff',
            bgcolor: '#061e35',
            backgroundImage: `radial-gradient(circle at 88% 10%, ${alpha(theme.palette.success.main, 0.22)} 0, transparent 28%), linear-gradient(135deg, #061e35 0%, #0a2a47 100%)`,
            boxShadow: `0 22px 55px ${alpha('#061e35', 0.18)}`,
            '&::after': {
              content: '""',
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: '50%',
              right: -90,
              bottom: -150,
              border: `1px solid ${alpha('#ffffff', 0.12)}`
            }
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2.5}>
            <Box sx={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <CalendarOutlined style={{ fontSize: 13, color: alpha('#ffffff', 0.72) }} />
                <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.72), fontWeight: 600, letterSpacing: 0.25 }}>
                  {today}
                </Typography>
              </Stack>
              <Typography
                variant={isXs ? 'h3' : 'h2'}
                fontWeight={750}
                sx={{ lineHeight: 1.1, letterSpacing: '-0.035em', color: '#fff' }}
              >
                {greeting}{userName ? `, ${userName.split(' ')[0]}` : ''}
              </Typography>
              <Typography variant="body2" sx={{ color: alpha('#ffffff', 0.72), mt: 0.9, maxWidth: 560 }}>
                {summaryText || 'Your portfolio is up to date. Here is what is happening today.'}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={1}
              sx={{
                position: 'relative',
                zIndex: 1,
                width: { sm: 'auto' },
                display: { xs: 'none', sm: 'flex' }
              }}
            >
              {onCreateNew && (
                <Button
                  variant="contained"
                  startIcon={<PlusOutlined />}
                  onClick={onCreateNew}
                  sx={{
                    minHeight: 42,
                    flex: { xs: 1, sm: 'initial' },
                    px: 2,
                    color: '#061e35',
                    bgcolor: theme.palette.success.main,
                    fontWeight: 800,
                    textTransform: 'none',
                    boxShadow: `0 10px 25px ${alpha(theme.palette.success.main, 0.28)}`,
                    '&:hover': { bgcolor: theme.palette.success.dark }
                  }}
                >
                  Create new
                </Button>
              )}
            </Stack>
          </Stack>

          {stats.length > 0 && (
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${stats.length}, minmax(0, 1fr))` },
                mt: { xs: 2.5, md: 3 },
                pt: 2,
                borderTop: `1px solid ${alpha('#ffffff', 0.13)}`
              }}
            >
              {stats.map((stat, index) => (
                <Box
                  key={stat.label}
                  sx={{
                    minWidth: 0,
                    px: { xs: index % 2 === 0 ? 0 : 1.5, md: index === 0 ? 0 : 2 },
                    py: { xs: 0.75, md: 0 },
                    borderLeft: { xs: index % 2 === 1 ? `1px solid ${alpha('#ffffff', 0.12)}` : 'none', md: index > 0 ? `1px solid ${alpha('#ffffff', 0.12)}` : 'none' }
                  }}
                >
                  <Typography sx={{ color: '#fff', fontSize: { xs: '1.15rem', md: '1.35rem' }, fontWeight: 800, lineHeight: 1.15 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.62), fontWeight: 500 }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Fade>
    </>
  );
}
