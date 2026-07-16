import { Box, Typography, Stack, useTheme, alpha } from '@mui/material';
import { RocketOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';

export default function ComingSoon({ title = 'Coming Soon', message = 'This feature is under development and will be available soon.' }) {
  const theme = useTheme();

  return (
    <MainCard
      sx={{
        mt: 3,
        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
        boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        borderRadius: 2
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          px: 4,
          textAlign: 'center'
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3
          }}
        >
          <RocketOutlined style={{ fontSize: 40, color: theme.palette.primary.main }} />
        </Box>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
          {message}
        </Typography>
      </Box>
    </MainCard>
  );
}
