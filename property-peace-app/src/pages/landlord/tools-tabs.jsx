import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Tabs,
  Tab,
  Fade,
  Slide,
  alpha,
  useTheme
} from '@mui/material';
import {
  CheckSquareOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import ChecklistTab from './tools/ChecklistTab';
import DocumentsTab from './tools/DocumentsTab';

// ==============================|| TOOLS PAGE ||============================== //

function TabPanel({ children, value, index, slideDirection, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && (
        <Slide
          direction={slideDirection}
          in={value === index}
          mountOnEnter
          unmountOnExit
          timeout={300}
        >
          <Box sx={{ pt: 3 }}>{children}</Box>
        </Slide>
      )}
    </div>
  );
}

export default function ToolsTabs() {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [slideDirection, setSlideDirection] = useState('left');
  const [fadeIn, setFadeIn] = useState(false);

  // Trigger fade-in animation on mount
  useEffect(() => {
    setFadeIn(true);
  }, []);

  const handleTabChange = (event, newValue) => {
    // Determine slide direction based on tab movement
    if (newValue > tabValue) {
      // Moving right (e.g., Checklist -> Documents)
      setSlideDirection('left'); // New content comes from right (slides in from right to left)
    } else if (newValue < tabValue) {
      // Moving left (e.g., Documents -> Checklist)
      setSlideDirection('right'); // New content comes from left (slides in from left to right)
    }
    setTabValue(newValue);
  };

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible' }}>
        {/* Header */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h3" sx={{ mb: 0.5 }}>
              Tools
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage checklists and documents for your properties
            </Typography>
          </Box>
        </AnimateIn>

        {/* Modern Tabs */}
        <AnimateIn direction="bottom" delay={200} distance={120}>
          <MainCard
            sx={{
              mb: 0,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2,
              overflow: 'hidden',
              '& .MuiTabs-root': {
                minHeight: 48
              },
              '& .MuiTab-root': {
                minHeight: 48,
                textTransform: 'none',
                fontSize: '0.9375rem',
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
                color: theme.palette.text.secondary,
                px: 3,
                '&:hover': {
                  color: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.04)
                },
                '&.Mui-selected': {
                  color: theme.palette.primary.main,
                  fontWeight: 700
                }
              },
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                backgroundColor: theme.palette.primary.main
              }
            }}
          >
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                '& .MuiTabs-scrollButtons': {
                  '&.Mui-disabled': {
                    opacity: 0.3
                  }
                }
              }}
            >
              <Tab icon={<CheckSquareOutlined />} label="Checklist" iconPosition="start" />
              <Tab icon={<FileTextOutlined />} label="Documents" iconPosition="start" />
            </Tabs>
          </MainCard>
        </AnimateIn>

        {/* Tab Content */}
        <Box>
          {/* Checklist Tab */}
          <TabPanel value={tabValue} index={0} slideDirection={slideDirection}>
            <ChecklistTab />
          </TabPanel>

          {/* Documents Tab */}
          <TabPanel value={tabValue} index={1} slideDirection={slideDirection}>
            <DocumentsTab />
          </TabPanel>
        </Box>
      </Box>
    </Fade>
  );
}
