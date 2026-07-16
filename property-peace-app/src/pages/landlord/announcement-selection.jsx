import { useNavigate } from 'react-router-dom';

// material-ui
import { Box, Grid, Typography, Button, Stack, Chip, alpha, useTheme } from '@mui/material';
import { AppstoreOutlined, SelectOutlined, ArrowRightOutlined, NotificationOutlined, TeamOutlined } from '@ant-design/icons';

// project imports
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

// ==============================|| ANNOUNCEMENT SELECTION PAGE ||============================== //

const OPTIONS = [
  {
    key: 'all',
    title: 'All properties',
    eyebrow: 'Fast broadcast',
    description: 'Send one update to every tenant across your portfolio. Best for company-wide notices, policy updates, and general reminders.',
    icon: <AppstoreOutlined />,
    action: 'Continue to message',
    route: '/landlord/announcements/create-all',
    chips: ['All tenants', 'All properties', 'Fastest path']
  },
  {
    key: 'select',
    title: 'Specific properties or units',
    eyebrow: 'Targeted notice',
    description: 'Pick the exact properties or units that should receive the announcement. Best for building-specific work, unit notices, or segmented updates.',
    icon: <SelectOutlined />,
    action: 'Choose recipients',
    route: '/landlord/announcements/create-select',
    chips: ['Property targeting', 'Unit targeting', 'More control']
  }
];

export default function AnnouncementSelectionPage() {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box sx={{ overflow: 'visible' }}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Announcements', path: '/landlord/announcements' },
          { label: 'Create' }
        ]}
      />

      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Create announcement
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
            Start with the audience. You can send a quick portfolio-wide update or target only the properties and units that need the message.
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={() => navigate('/landlord/announcements')} sx={{ textTransform: 'none', borderRadius: 1.5 }}>
          Back to announcements
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        {OPTIONS.map((option) => (
          <Grid key={option.key} size={{ xs: 12, md: 6 }}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => navigate(option.route)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(option.route);
                }
              }}
              sx={{
                height: '100%',
                bgcolor: 'background.paper',
                border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                borderRadius: 2,
                p: 2.5,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.45),
                  bgcolor: alpha(theme.palette.primary.main, 0.025)
                },
                '&:focus-visible': {
                  outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                  outlineOffset: 2
                }
              }}
            >
              <Stack spacing={2.25} sx={{ height: '100%' }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '& .anticon': { fontSize: 20 }
                      }}
                    >
                      {option.icon}
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.7 }}>
                        {option.eyebrow}
                      </Typography>
                      <Typography variant="h5" fontWeight={700}>
                        {option.title}
                      </Typography>
                    </Box>
                  </Stack>
                  <ArrowRightOutlined style={{ color: theme.palette.text.disabled, marginTop: 8 }} />
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {option.description}
                </Typography>

                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 'auto' }}>
                  {option.chips.map((chip) => (
                    <Chip
                      key={chip}
                      size="small"
                      label={chip}
                      sx={{ height: 22, fontSize: '0.68rem', bgcolor: alpha(theme.palette.primary.main, 0.06), color: 'text.secondary', fontWeight: 600 }}
                    />
                  ))}
                </Stack>

                <Button variant={option.key === 'all' ? 'outlined' : 'contained'} endIcon={<ArrowRightOutlined />} sx={{ alignSelf: 'flex-start', textTransform: 'none', borderRadius: 1.5 }}>
                  {option.action}
                </Button>
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box
        sx={{
          mt: 2.5,
          p: 2,
          borderRadius: 2,
          border: `1px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.035)
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <NotificationOutlined style={{ color: theme.palette.primary.main }} />
          <Typography variant="body2" color="text.secondary">
            Announcements are sent to tenants with portal accounts. Email delivery can be selected in the next step when available.
          </Typography>
          <Chip icon={<TeamOutlined />} label="Audience first workflow" size="small" sx={{ ml: { sm: 'auto' }, fontWeight: 600 }} />
        </Stack>
      </Box>
    </Box>
  );
}
