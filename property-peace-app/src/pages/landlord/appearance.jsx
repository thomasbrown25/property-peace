import { useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Stack,
  Paper,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  alpha
} from '@mui/material';
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import useConfig from 'hooks/useConfig';
import { ThemeMode } from 'config';

// Customization components
import ThemeLayout from 'layout/Dashboard/Header/HeaderContent/Customization/ThemeLayout';
import DefaultThemeMode from 'layout/Dashboard/Header/HeaderContent/Customization/ThemeMode';
import ColorScheme from 'layout/Dashboard/Header/HeaderContent/Customization/ColorScheme';
import ThemeWidth from 'layout/Dashboard/Header/HeaderContent/Customization/ThemeWidth';
import ThemeFont from 'layout/Dashboard/Header/HeaderContent/Customization/ThemeFont';
import ThemeMenuDirection from 'layout/Dashboard/Header/HeaderContent/Customization/ThemeMenuDirection';

// Icons
import LayoutOutlined from '@ant-design/icons/LayoutOutlined';
import HighlightOutlined from '@ant-design/icons/HighlightOutlined';
import BorderInnerOutlined from '@ant-design/icons/BorderInnerOutlined';
import BgColorsOutlined from '@ant-design/icons/BgColorsOutlined';
import FontColorsOutlined from '@ant-design/icons/FontColorsOutlined';
import DownOutlined from '@ant-design/icons/DownOutlined';

// ==============================|| APPEARANCE PAGE ||============================== //

export default function Appearance() {
  const { mode } = useConfig();

  const themeLayout = useMemo(() => <ThemeLayout />, []);
  const themeMenuDirection = useMemo(() => <ThemeMenuDirection />, []);
  const themeMode = useMemo(() => <DefaultThemeMode />, []);
  const themeColor = useMemo(() => <ColorScheme />, []);
  const themeWidth = useMemo(() => <ThemeWidth />, []);
  const themeFont = useMemo(() => <ThemeFont />, []);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Appearance
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Customize the look and feel of your application
        </Typography>
      </Box>

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        <Box
          sx={{
            '& .MuiAccordion-root': {
              borderColor: 'divider',
              boxShadow: 'none',
              '&:before': {
                display: 'none'
              },
              '& .MuiAccordionSummary-root': {
                bgcolor: 'transparent',
                flexDirection: 'row',
                pl: 2,
                pr: 2,
                minHeight: 72,
                '&.Mui-expanded': {
                  minHeight: 72
                }
              },
              '& .MuiAccordionDetails-root': {
                border: 'none',
                pt: 0,
                pb: 3,
                px: 2
              },
              '& .Mui-expanded': {
                '& .MuiAccordionSummary-content': {
                  '& .MuiTypography-root': {
                    color: 'text.primary'
                  }
                },
                '& .MuiAvatar-root': {
                  bgcolor: 'primary.lighter',
                  color: 'primary.main'
                }
              }
            }
          }}
        >
          <Accordion defaultExpanded sx={{ borderTop: 'none' }}>
            <AccordionSummary
              expandIcon={<DownOutlined />}
              aria-controls="panel1d-content"
              id="panel1d-header"
            >
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', width: '100%' }}>
                <Avatar variant="rounded" sx={{ bgcolor: 'transparent' }}>
                  <LayoutOutlined />
                </Avatar>
                <Stack sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Theme Layout
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Choose your preferred layout style
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>{themeLayout}</AccordionDetails>
          </Accordion>

          <Divider />

          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<DownOutlined />}
              aria-controls="panel2d-content"
              id="panel2d-header"
            >
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', width: '100%' }}>
                <Avatar variant="rounded" sx={{ bgcolor: 'transparent' }}>
                  <BorderInnerOutlined />
                </Avatar>
                <Stack sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Menu Direction
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Choose RTL or LTR menu direction
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>{themeMenuDirection}</AccordionDetails>
          </Accordion>

          <Divider />

          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<DownOutlined />}
              aria-controls="panel3d-content"
              id="panel3d-header"
            >
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', width: '100%' }}>
                <Avatar variant="rounded" sx={{ bgcolor: 'transparent' }}>
                  <HighlightOutlined />
                </Avatar>
                <Stack sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Theme Mode
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Choose light or dark mode
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>{themeMode}</AccordionDetails>
          </Accordion>

          <Divider />

          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<DownOutlined />}
              aria-controls="panel4d-content"
              id="panel4d-header"
            >
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', width: '100%' }}>
                <Avatar variant="rounded" sx={{ bgcolor: 'transparent' }}>
                  <BgColorsOutlined />
                </Avatar>
                <Stack sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Color Scheme
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Choose your primary theme color
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>{themeColor}</AccordionDetails>
          </Accordion>

          <Divider />

          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<DownOutlined />}
              aria-controls="panel5d-content"
              id="panel5d-header"
            >
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', width: '100%' }}>
                <Avatar variant="rounded" sx={{ bgcolor: 'transparent' }}>
                  <BorderInnerOutlined />
                </Avatar>
                <Stack sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Layout Width
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Choose fluid or container layout
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>{themeWidth}</AccordionDetails>
          </Accordion>

          <Divider />

          <Accordion defaultExpanded sx={{ borderBottom: 'none' }}>
            <AccordionSummary
              expandIcon={<DownOutlined />}
              aria-controls="panel6d-content"
              id="panel6d-header"
            >
              <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', width: '100%' }}>
                <Avatar variant="rounded" sx={{ bgcolor: 'transparent' }}>
                  <FontColorsOutlined />
                </Avatar>
                <Stack sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    Font Family
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Choose your preferred font family
                  </Typography>
                </Stack>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>{themeFont}</AccordionDetails>
          </Accordion>
        </Box>
      </MainCard>
    </Box>
  );
}

