import { useState } from 'react';
import PropTypes from 'prop-types';

// material-ui
import { Box, Typography, TextField, Button, Stack, Chip, alpha, useTheme } from '@mui/material';
import { ThunderboltOutlined, FileTextOutlined } from '@ant-design/icons';

// project imports
import AIMessageFormatter from './AIMessageFormatter';

// ==============================|| MESSAGE STEP ||============================== //

export default function MessageStep({ message, onMessageChange }) {
  const theme = useTheme();
  const [showAIFormatter, setShowAIFormatter] = useState(false);

  const handleAcceptFormatted = (formattedMessage) => {
    // When user accepts the AI-formatted message, it goes into the message box
    onMessageChange(formattedMessage);
    setShowAIFormatter(false);
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.75 }}>
            Write the announcement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Keep it clear and direct. You can draft quickly, then use AI to polish the wording.
          </Typography>
        </Box>
        <Chip
          icon={<FileTextOutlined />}
          label={`${message.length} characters`}
          size="small"
          sx={{ fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, 0.06) }}
        />
      </Stack>

      <Stack spacing={2}>
        <TextField
          fullWidth
          multiline
          minRows={9}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Example: Hi everyone — pest control will be onsite Tuesday between 9 AM and noon. Please keep pets secured and make sure maintenance can access common areas."
          helperText="This is what tenants will see. Review names, dates, and instructions before sending."
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
              borderRadius: 2,
              alignItems: 'flex-start'
            },
            '& textarea': {
              lineHeight: 1.65
            }
          }}
        />

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Want a cleaner tone? AI can make the message more professional without changing the core details.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ThunderboltOutlined />}
            onClick={() => setShowAIFormatter(true)}
            disabled={!message.trim()}
            sx={{ textTransform: 'none', borderRadius: 1.5, flexShrink: 0 }}
          >
            Enhance with AI
          </Button>
        </Box>
      </Stack>

      {showAIFormatter && (
        <AIMessageFormatter
          open={showAIFormatter}
          onClose={() => setShowAIFormatter(false)}
          originalMessage={message}
          onMessageAccepted={handleAcceptFormatted}
        />
      )}
    </Box>
  );
}

MessageStep.propTypes = {
  message: PropTypes.string.isRequired,
  onMessageChange: PropTypes.func.isRequired
};
