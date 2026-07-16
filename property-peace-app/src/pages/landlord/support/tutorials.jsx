import { useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Stack, 
  InputAdornment,
  TextField,
  Chip,
  alpha,
  useTheme
} from '@mui/material';
import { SearchOutlined, PlayCircleOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import VideoPlayer from 'components/videos/VideoPlayer';
import { getAllVideos, VIDEO_CATEGORIES } from 'data/videos';
import { motion } from 'framer-motion';

// ==============================|| TUTORIALS PAGE ||============================== //

export default function Tutorials() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const theme = useTheme();

  const allVideos = getAllVideos();
  const categories = Object.values(VIDEO_CATEGORIES);

  // Filter videos based on search and category
  const filteredVideos = allVideos.filter(video => {
    const matchesSearch = searchQuery === '' || 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = !selectedCategory || 
      VIDEO_CATEGORIES[video.category] === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group videos by category for display
  const videosByCategory = filteredVideos.reduce((acc, video) => {
    const categoryName = VIDEO_CATEGORIES[video.category] || 'Other';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(video);
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Box>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
              Tutorials
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Watch step-by-step video tutorials to learn how to use Property Peace
            </Typography>
          </Box>
        </motion.div>

        {/* Search and Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
        >
          <MainCard sx={{ mb: 4 }}>
            <Stack spacing={3}>
              {/* Search Bar */}
              <TextField
                fullWidth
                placeholder="Search tutorials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined />
                    </InputAdornment>
                  )
                }}
              />

              {/* Category Chips */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  Filter by Category
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label="All"
                    onClick={() => setSelectedCategory(null)}
                    color={selectedCategory === null ? 'primary' : 'default'}
                    sx={{ cursor: 'pointer' }}
                  />
                  {categories.map((category) => (
                    <Chip
                      key={category}
                      label={category}
                      onClick={() => setSelectedCategory(category)}
                      color={selectedCategory === category ? 'primary' : 'default'}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Box>
            </Stack>
          </MainCard>
        </motion.div>

        {/* Video Grid */}
        {Object.keys(videosByCategory).length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
          >
            <MainCard>
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  No tutorials found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search or filter criteria
                </Typography>
              </Box>
            </MainCard>
          </motion.div>
        ) : (
          Object.entries(videosByCategory).map(([categoryName, videos], categoryIndex) => (
            <motion.div
              key={categoryName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 + categoryIndex * 0.1 }}
            >
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
                  {categoryName}
                </Typography>
                <Grid container spacing={3}>
                  {videos.map((video, videoIndex) => (
                    <Grid item xs={12} md={6} lg={4} key={video.key}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, ease: "easeOut", delay: 0.4 + categoryIndex * 0.1 + videoIndex * 0.05 }}
                      >
                        <Paper
                          sx={{
                            p: 2,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              boxShadow: 4,
                              transform: 'translateY(-2px)'
                            },
                            cursor: 'pointer',
                            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                            overflow: 'hidden'
                          }}
                          onClick={() => setSelectedVideo(selectedVideo?.key === video.key ? null : video)}
                        >
                          <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                            <VideoPlayer 
                              videoId={video.id}
                              title={video.title}
                              thumbnailUrl={null}
                            />
                          </Box>
                          <Box sx={{ mt: 2, flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
                              {video.title}
                            </Typography>
                            {video.description && (
                              <Typography variant="body2" color="text.secondary">
                                {video.description}
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      </motion.div>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </motion.div>
          ))
        )}

        {/* Quick Tips Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.5 }}
        >
          <MainCard sx={{ mt: 4 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Quick Tips
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    💡 Tip: Contextual Help
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Look for the question mark icon (?) on pages where video tutorials are available.
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    📚 Tip: New User?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start with the "Setup & Account" category to get your account configured properly.
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </MainCard>
        </motion.div>
      </Box>
    </motion.div>
  );
}
