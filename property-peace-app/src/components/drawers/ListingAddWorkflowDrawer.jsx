import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { Box, IconButton, Stack, Typography, alpha, useTheme } from '@mui/material';
import { CloseOutlined, RocketOutlined } from '@ant-design/icons';
import { useDrawer } from 'contexts/DrawerContext';
import ListingAddWorkflow from 'pages/landlord/listing-add-workflow';

export default function ListingAddWorkflowDrawer() {
  const drawer = useDrawer();
  const theme = useTheme();

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={drawer.isOpenListingAdd}
      onClose={drawer.closeListingAddDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: '85%', lg: 1080 },
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
          <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex' }}>
            <RocketOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="h6" fontWeight={600}>
            Create Listing
          </Typography>
        </Stack>
        <IconButton onClick={drawer.closeListingAddDrawer} size="small">
          <CloseOutlined />
        </IconButton>
      </Box>

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.paper', p: 3 }}>
        <ListingAddWorkflow onClose={drawer.closeListingAddDrawer} draftListing={drawer.selectedListingDraft} />
      </Box>
    </ThemeAdaptiveDrawer>
  );
}
