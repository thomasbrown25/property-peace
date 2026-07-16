import { useState } from 'react';
import { Box, TextField, IconButton, InputAdornment } from '@mui/material';
import { SendOutlined, LoadingOutlined } from '@ant-design/icons';
import { alpha } from '@mui/system';

export default function CopilotInput({ onCommand, loading = false, disabled = false, placeholder = "Ask me to do something..." }) {
  const [command, setCommand] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (command.trim() && !loading && !disabled && onCommand) {
      onCommand(command.trim());
      setCommand('');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <TextField
        fullWidth
        size="small"
        placeholder={disabled ? "AI Copilot is disabled" : placeholder}
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        disabled={loading || disabled}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="submit"
                disabled={!command.trim() || loading}
                sx={{
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08)
                  }
                }}
              >
                {loading ? <LoadingOutlined /> : <SendOutlined />}
              </IconButton>
            </InputAdornment>
          )
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.8),
            '&:hover': {
              bgcolor: (theme) => alpha(theme.palette.background.paper, 0.9)
            },
            '&.Mui-focused': {
              bgcolor: (theme) => alpha(theme.palette.background.paper, 1)
            }
          }
        }}
      />
    </Box>
  );
}

