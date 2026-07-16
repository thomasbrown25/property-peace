import { IconButton, Tooltip, Badge } from '@mui/material';
import { QuestionCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import VideoDialog from './VideoDialog';

/**
 * VideoHelpButton Component
 * 
 * A button that opens a video dialog when clicked.
 * Use this for contextual help on pages.
 * 
 * @param {string} videoId - YouTube video ID
 * @param {string} title - Video title
 * @param {string} description - Optional description
 * @param {string} tooltip - Tooltip text (default: "Watch tutorial")
 * @param {string} variant - 'icon' or 'button' (default: 'icon')
 */
export default function VideoHelpButton({ 
  videoId, 
  title, 
  description,
  tooltip = 'Watch tutorial',
  variant = 'icon'
}) {
  const [open, setOpen] = useState(false);

  if (!videoId) return null;

  const handleClick = () => {
    setOpen(true);
  };

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip title={tooltip}>
          <IconButton 
            onClick={handleClick}
            size="small"
            sx={{
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <QuestionCircleOutlined />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title={tooltip}>
          <IconButton 
            onClick={handleClick}
            startIcon={<PlayCircleOutlined />}
            variant="outlined"
            size="small"
          >
            {tooltip}
          </IconButton>
        </Tooltip>
      )}

      <VideoDialog
        open={open}
        onClose={() => setOpen(false)}
        videoId={videoId}
        title={title}
        description={description}
      />
    </>
  );
}
