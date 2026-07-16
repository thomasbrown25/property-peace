import { useState } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  FormControlLabel,
  Checkbox,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { ThunderboltOutlined, SendOutlined } from '@ant-design/icons';

// project imports
import AIMessageFormatter from './AIMessageFormatter';

// ==============================|| MESSAGE COMPOSER ||============================== //

export default function MessageComposer({
  message,
  onMessageChange,
  deliveryMethods,
  onDeliveryMethodsChange,
  selectedPropertiesCount,
  selectedUnitsCount,
  onSend,
  sending,
  aiFormatting,
  onAIFormatting
}) {
  const [showAIFormatter, setShowAIFormatter] = useState(false);

  const recipientCount = selectedUnitsCount;

  const handleSend = () => {
    if (!message.trim()) {
      return;
    }
    if (recipientCount === 0) {
      return;
    }
    if (!deliveryMethods.inApp && !deliveryMethods.email) {
      return;
    }
    onSend();
  };

  const canSend = message.trim() && recipientCount > 0 && (deliveryMethods.inApp || deliveryMethods.email) && !sending;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Compose Announcement
      </Typography>

      <TextField
        fullWidth
        multiline
        rows={8}
        value={message}
        onChange={(e) => onMessageChange(e.target.value)}
        placeholder="Type your announcement message here..."
        sx={{ mb: 2 }}
        helperText={`${message.length} characters`}
      />

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ThunderboltOutlined />}
          onClick={() => setShowAIFormatter(true)}
          disabled={!message.trim() || aiFormatting}
        >
          {aiFormatting ? 'Enhancing...' : 'Enhance Message with AI'}
        </Button>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Delivery Methods
        </Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Checkbox
                checked={deliveryMethods.inApp}
                onChange={(e) => onDeliveryMethodsChange({ ...deliveryMethods, inApp: e.target.checked })}
              />
            }
            label="Send as in-app notification"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={deliveryMethods.email}
                onChange={(e) => onDeliveryMethodsChange({ ...deliveryMethods, email: e.target.checked })}
              />
            }
            label="Send as email"
          />
        </Stack>
        {!deliveryMethods.inApp && !deliveryMethods.email && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Please select at least one delivery method.
          </Alert>
        )}
      </Box>

      <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Recipients
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`${selectedPropertiesCount} property(ies)`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`${selectedUnitsCount} unit(s)`}
            size="small"
            color="secondary"
            variant="outlined"
          />
        </Stack>
      </Box>

      <Button
        variant="contained"
        fullWidth
        size="large"
        startIcon={sending ? <CircularProgress size={20} /> : <SendOutlined />}
        onClick={handleSend}
        disabled={!canSend}
      >
        {sending ? 'Sending...' : 'Send Announcement'}
      </Button>

      {showAIFormatter && (
        <AIMessageFormatter
          open={showAIFormatter}
          onClose={() => setShowAIFormatter(false)}
          originalMessage={message}
          onMessageAccepted={(newMessage) => {
            onMessageChange(newMessage);
            setShowAIFormatter(false);
          }}
        />
      )}
    </Box>
  );
}

MessageComposer.propTypes = {
  message: PropTypes.string.isRequired,
  onMessageChange: PropTypes.func.isRequired,
  deliveryMethods: PropTypes.shape({
    inApp: PropTypes.bool.isRequired,
    email: PropTypes.bool.isRequired
  }).isRequired,
  onDeliveryMethodsChange: PropTypes.func.isRequired,
  selectedPropertiesCount: PropTypes.number.isRequired,
  selectedUnitsCount: PropTypes.number.isRequired,
  onSend: PropTypes.func.isRequired,
  sending: PropTypes.bool.isRequired,
  aiFormatting: PropTypes.bool,
  onAIFormatting: PropTypes.func
};
