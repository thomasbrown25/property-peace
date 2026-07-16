import { Dialog, DialogTitle, DialogContent, IconButton, Typography, Box } from '@mui/material';
import { CloseOutlined } from '@ant-design/icons';
import VideoPlayer from './VideoPlayer';

/**
 * VideoDialog Component
 * 
 * A dialog/modal that displays a video player.
 * 
 * @param {boolean} open - Whether dialog is open
 * @param {function} onClose - Close handler
 * @param {string} videoId - YouTube video ID
 * @param {string} title - Video title
 * @param {string} description - Optional description
 */
export default function VideoDialog({ 
  open, 
  onClose, 
  videoId, 
  title, 
  description 
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h6" component="span">
          {title || 'Video Tutorial'}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseOutlined />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 3, pt: 1 }}>
        <VideoPlayer 
          videoId={videoId}
          title={title}
          description={description}
          autoPlay={true}
        />
      </DialogContent>
    </Dialog>
  );
}
