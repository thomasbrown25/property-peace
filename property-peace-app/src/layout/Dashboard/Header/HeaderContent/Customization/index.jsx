import { useMemo, useState } from 'react';

// material-ui
import { Box, Accordion, AccordionDetails, AccordionSummary, Drawer, Stack, Typography } from '@mui/material';

// project imports
import ThemeLayout from './ThemeLayout';
import DefaultThemeMode from './ThemeMode';
import ColorScheme from './ColorScheme';
import ThemeWidth from './ThemeWidth';
import ThemeFont from './ThemeFont';
import ThemeMenuDirection from './ThemeMenuDirection';

import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import IconButton from 'components/@extended/IconButton';
import SimpleBar from 'components/third-party/SimpleBar';

import { ThemeMode } from 'config';
import useConfig from 'hooks/useConfig';

// assets
import LayoutOutlined from '@ant-design/icons/LayoutOutlined';
import HighlightOutlined from '@ant-design/icons/HighlightOutlined';
import BorderInnerOutlined from '@ant-design/icons/BorderInnerOutlined';
import BgColorsOutlined from '@ant-design/icons/BgColorsOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined';
import FontColorsOutlined from '@ant-design/icons/FontColorsOutlined';

// ==============================|| HEADER CONTENT - CUSTOMIZATION ||============================== //

export default function Customization() {
  const { mode } = useConfig();

  const themeLayout = useMemo(() => <ThemeLayout />, []);
  const themeMenuDirection = useMemo(() => <ThemeMenuDirection />, []);
  const themeMode = useMemo(() => <DefaultThemeMode />, []);
  const themeColor = useMemo(() => <ColorScheme />, []);
  const themeWidth = useMemo(() => <ThemeWidth />, []);
  const themeFont = useMemo(() => <ThemeFont />, []);

  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    setOpen(!open);
  };

  const closeIcon = { color: mode === ThemeMode.DARK ? 'text.primary' : 'background.paper' };

  return (
    <>
      <Box sx={{ flexShrink: 0, ml: 0.75 }}>
        <IconButton
          color="secondary"
          variant="light"
          sx={(theme) => ({
            color: 'text.primary',
            bgcolor: open ? 'grey.100' : 'transparent',
            ...theme.applyStyles('dark', { bgcolor: open ? 'background.default' : 'transparent' }),
            '& svg': {
              animation: 'spin 2s linear infinite',
              '@keyframes spin': {
                from: { transform: 'rotate(0deg)' },
                to: { transform: 'rotate(360deg)' }
              }
            }
          })}
          onClick={handleToggle}
          aria-label="settings toggler"
        >
          <SettingOutlined />
        </IconButton>
      </Box>
      <Drawer sx={{ zIndex: 2001 }} anchor="right" onClose={handleToggle} open={open} slotProps={{ paper: { sx: { width: 340 } } }}>
        {open && (
          <MainCard
            title="Theme Customization"
            sx={{
              border: 'none',
              borderRadius: 0,
              height: '100vh',
              '& .MuiCardHeader-root': { ...closeIcon, bgcolor: 'primary.main', '& .MuiTypography-root': { fontSize: '1rem' } }
            }}
            content={false}
            secondary={
              <IconButton
                color="secondary"
                shape="rounded"
                size="small"
                onClick={handleToggle}
                sx={{ ...closeIcon, '&:hover': { bgcolor: 'transparent', color: 'error.main' } }}
              >
                <CloseCircleOutlined style={{ fontSize: '1.15rem' }} />
              </IconButton>
            }
          >
            <SimpleBar sx={{ height: 'calc(100vh - 70px)', '& .simplebar-content': { display: 'flex', flexDirection: 'column' } }}>
              <Box
                sx={{
                  '& .MuiAccordion-root': {
                    borderColor: 'divider',
                    '& .MuiAccordionSummary-root': { bgcolor: 'transparent', flexDirection: 'row', pl: 1 },
                    '& .MuiAccordionDetails-root': { border: 'none' },
                    '& .Mui-expanded': { color: 'primary.main' }
                  }
                }}
              >
                <Accordion defaultExpanded sx={{ borderTop: 'none' }}>
                  <AccordionSummary aria-controls="panel1d-content" id="panel1d-header">
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar alt="settings toggler" variant="rounded">
                        <LayoutOutlined />
                      </Avatar>
                      <Stack>
                        <Typography variant="subtitle1" color="text.primary">
                          Theme Layout
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Choose your layout
                        </Typography>
                      </Stack>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>{themeLayout}</AccordionDetails>
                </Accordion>
                <Accordion defaultExpanded>
                  <AccordionSummary aria-controls="panel4d-content" id="panel4d-header">
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar alt="settings toggler" variant="rounded">
                        <BorderInnerOutlined />
                      </Avatar>
                      <Stack>
                        <Typography variant="subtitle1" color="text.primary">
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
                <Accordion defaultExpanded>
                  <AccordionSummary aria-controls="panel2d-content" id="panel2d-header">
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar alt="settings toggler" variant="rounded">
                        <HighlightOutlined />
                      </Avatar>
                      <Stack>
                        <Typography variant="subtitle1" color="text.primary">
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
                <Accordion defaultExpanded>
                  <AccordionSummary aria-controls="panel3d-content" id="panel3d-header">
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar alt="settings toggler" variant="rounded">
                        <BgColorsOutlined />
                      </Avatar>
                      <Stack>
                        <Typography variant="subtitle1" color="text.primary">
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
                <Accordion defaultExpanded>
                  <AccordionSummary aria-controls="panel4d-content" id="panel4d-header">
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar alt="settings toggler" variant="rounded">
                        <BorderInnerOutlined />
                      </Avatar>
                      <Stack>
                        <Typography variant="subtitle1" color="text.primary">
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
                <Accordion defaultExpanded sx={{ borderBottom: 'none' }}>
                  <AccordionSummary aria-controls="panel4d-content" id="panel4d-header">
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar alt="settings toggler" variant="rounded">
                        <FontColorsOutlined />
                      </Avatar>
                      <Stack>
                        <Typography variant="subtitle1" color="text.primary">
                          Font Family
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Choose your font family.
                        </Typography>
                      </Stack>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>{themeFont}</AccordionDetails>
                </Accordion>
              </Box>
            </SimpleBar>
          </MainCard>
        )}
      </Drawer>
    </>
  );
}
