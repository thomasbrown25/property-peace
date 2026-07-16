import { useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  alpha
} from '@mui/material';
import Avatar from 'components/@extended/Avatar';
import useConfig from 'hooks/useConfig';

// Customization components (only colors and theme mode)
import DefaultThemeMode from 'layout/Dashboard/Header/HeaderContent/Customization/ThemeMode';
import ColorScheme from 'layout/Dashboard/Header/HeaderContent/Customization/ColorScheme';

// Icons
import HighlightOutlined from '@ant-design/icons/HighlightOutlined';
import BgColorsOutlined from '@ant-design/icons/BgColorsOutlined';
import DownOutlined from '@ant-design/icons/DownOutlined';

// ==============================|| TENANT APPEARANCE SETTINGS ||============================== //

export default function AppearanceSettings() {
  const { mode } = useConfig();

  const themeMode = useMemo(() => <DefaultThemeMode />, []);
  const themeColor = useMemo(() => <ColorScheme />, []);

  return (
    <Box>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
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

            <Accordion defaultExpanded sx={{ borderBottom: 'none' }}>
              <AccordionSummary
                expandIcon={<DownOutlined />}
                aria-controls="panel2d-content"
                id="panel2d-header"
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
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
}

