import { Box, Stack, Typography, Chip } from '@mui/material';
import { alpha } from '@mui/system';
import { RobotOutlined } from '@ant-design/icons';
import Avatar from 'components/@extended/Avatar';

export default function CopilotHeader({ status = 'active' }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <Avatar
        type="filled"
        color="primary"
        sx={{
          width: 48,
          height: 48,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main'
        }}
      >
        <RobotOutlined style={{ fontSize: 24 }} />
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" fontWeight={600}>
            AI Agent
          </Typography>
          <Chip
            label={status === 'active' ? 'Active' : 'Thinking...'}
            color={status === 'active' ? 'success' : 'warning'}
            size="small"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Your property management assistant
        </Typography>
      </Box>
    </Stack>
  );
}

