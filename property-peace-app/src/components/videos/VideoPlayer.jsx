import { Box, Paper, Typography, IconButton } from '@mui/material';
import { PlayCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { useState } from 'react';

/**
 * VideoPlayer Component
 * 
 * Displays a YouTube video embed with optional thumbnail preview.
 * 
 * @param {string} videoId - YouTube video ID (from URL: youtube.com/watch?v=VIDEO_ID)
 * @param {string} title - Video title for display
 * @param {string} description - Optional description
 * @param {boolean} autoPlay - Whether to autoplay video (default: false)
 * @param {string} thumbnailUrl - Optional custom thumbnail URL (defaults to YouTube thumbnail)
 */
export default function VideoPlayer({ 
  videoId, 
  title, 
  description, 
  autoPlay = false,
  thumbnailUrl 
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  if (!videoId) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">Video not available</Typography>
      </Paper>
    );
  }

  // YouTube embed URL - using youtube-nocookie.com for better privacy and to avoid embedding restrictions
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1${autoPlay ? '&autoplay=1' : ''}`;
  
  // YouTube thumbnail URL (using hqdefault for consistent sizing - maxresdefault can be too large)
  const defaultThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      {!isPlaying ? (
        <Paper
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: '100%',
            aspectRatio: '16/9',
            cursor: 'pointer',
            overflow: 'hidden',
            borderRadius: 2,
            '&:hover': {
              '& .play-overlay': {
                opacity: 1,
                transform: 'scale(1.1)'
              }
            }
          }}
          onClick={() => setIsPlaying(true)}
        >
          {/* Thumbnail */}
          <Box
            component="img"
            src={thumbnailUrl || defaultThumbnail}
            alt={title}
            sx={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
            onError={(e) => {
              // Fallback to standard quality thumbnail if hqdefault fails
              e.target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            }}
          />
          
          {/* Play Button Overlay */}
          <Box
            className="play-overlay"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              opacity: 0.8,
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.6)'
              }
            }}
          >
            <PlayCircleOutlined
              style={{
                fontSize: 80,
                color: 'white',
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
              }}
            />
          </Box>

          {/* Video Title Overlay (bottom) */}
          {title && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                p: 2,
                color: 'white'
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                {title}
              </Typography>
            </Box>
          )}
        </Paper>
      ) : (
        <Box sx={{ position: 'relative', width: '100%', maxWidth: '100%' }}>
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: '100%',
              aspectRatio: '16/9',
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <Box
              component="iframe"
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none'
              }}
            />
          </Box>
        </Box>
      )}

      {/* Description */}
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}
