import { useCallback, useEffect, useState } from 'react';

// material-ui
import { Tooltip } from '@mui/material';
import { Box } from '@mui/material';

// project imports
import IconButton from 'components/@extended/IconButton';

// assets
import FullscreenOutlined from '@ant-design/icons/FullscreenOutlined';
import FullscreenExitOutlined from '@ant-design/icons/FullscreenExitOutlined';

// ==============================|| HEADER CONTENT - FULLSCREEN ||============================== //

export default function FullScreen() {
  const [open, setOpen] = useState(false);
  const handleToggle = useCallback(() => {
    if (document && !document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setOpen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <Tooltip title={open ? 'Exit Fullscreen' : 'Fullscreen'}>
        <IconButton
          color="secondary"
          variant="light"
          sx={(theme) => ({
            color: 'text.primary',
            bgcolor: open ? 'action.selected' : 'transparent',
            transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
              duration: theme.transitions.duration.shorter
            }),
            '&:hover': {
              bgcolor: 'action.hover',
              boxShadow: 'none',
              transform: 'translateY(-1px)'
            },
            ...theme.applyStyles('dark', { bgcolor: open ? 'action.selected' : 'transparent' })
          })}
          aria-label="fullscreen toggler"
          onClick={handleToggle}
        >
          {open ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
