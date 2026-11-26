import PropTypes from 'prop-types';
import { Box, FormControl, MenuItem, Select, Stack, Typography, alpha, useMediaQuery } from '@mui/material';
import MainCard from 'components/MainCard';
import { HEADER_HEIGHT } from 'layout/Dashboard/Header';

export default function SettingsLayout({ tabs, selectedIndex, onTabChange }) {
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const activeTab = tabs[selectedIndex] ?? tabs[0];
  const ActiveIcon = activeTab.icon;
  const ActiveSettingsPanel = activeTab.component;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '224px minmax(0, 1fr)', lg: '240px minmax(0, 1fr)' },
        gridTemplateRows: { xs: 'auto 1fr', md: 'auto' },
        flex: 1
      }}
    >
      <Box
        component="nav"
        aria-label="Settings"
        sx={(theme) => ({
          bgcolor: 'background.paper',
          borderRight: { md: `1px solid ${theme.palette.divider}` },
          borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 0 }
        })}
      >
        <Box
          sx={{
            position: { md: 'sticky' },
            top: { md: HEADER_HEIGHT.sm },
            maxHeight: { md: `calc(100dvh - ${HEADER_HEIGHT.sm}px)` },
            overflowY: { md: 'auto' }
          }}
        >
          <Typography component="h2" variant="h6" fontWeight={800} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            Settings
          </Typography>

          {isMobile ? (
            <FormControl fullWidth sx={{ p: 2 }}>
              <Select value={selectedIndex} onChange={(event) => onTabChange(event.target.value)} displayEmpty aria-label="Settings menu">
                {tabs.map(({ key, label, icon: Icon }, index) => (
                  <MenuItem key={key} value={index}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Icon style={{ fontSize: 18 }} />
                      <Typography>{label}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            tabs.map(({ key, label, icon: Icon }, index) => {
              const selected = selectedIndex === index;

              return (
                <Box
                  key={key}
                  component="button"
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => onTabChange(index)}
                  sx={(theme) => ({
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    border: 0,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                    borderLeft: `3px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
                    bgcolor: selected ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.07) : 'transparent',
                    color: 'text.primary',
                    textAlign: 'left',
                    p: 1.5,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, selected ? 0.16 : 0.05) },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }
                  })}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      color: selected ? 'primary.main' : 'text.secondary'
                    }}
                  >
                    <Icon style={{ fontSize: 16 }} />
                  </Box>
                  <Typography variant="body2" fontWeight={selected ? 800 : 700}>
                    {label}
                  </Typography>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      <Box sx={{ minWidth: 0, p: { xs: 2.5, sm: 3.5, md: 2.5 } }}>
        <MainCard content={false} sx={{ borderRadius: 2, border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.16)}`, overflow: 'hidden' }}>
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={(theme) => ({
              p: { xs: 2, md: 2.5 },
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}`,
              bgcolor: alpha(theme.palette.background.paper, 0.86)
            })}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                color: 'primary.main'
              }}
            >
              <ActiveIcon style={{ fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800}>{activeTab.label}</Typography>
              <Typography variant="body2" color="text.secondary">{activeTab.description}</Typography>
            </Box>
          </Stack>
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            <ActiveSettingsPanel />
          </Box>
        </MainCard>
      </Box>
    </Box>
  );
}

SettingsLayout.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    component: PropTypes.elementType.isRequired
  })).isRequired,
  selectedIndex: PropTypes.number.isRequired,
  onTabChange: PropTypes.func.isRequired
};
