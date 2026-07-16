import { Box, Drawer, Divider, IconButton, Stack, Toolbar, Typography, alpha, useTheme } from '@mui/material';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import { useDrawer } from 'contexts/DrawerContext';
import PropertyAddWorkflow from 'pages/landlord/property-add-workflow';

export default function PropertyAddWorkflowDrawer() {
  const drawer = useDrawer();
  const theme = useTheme();

  return (
    <Drawer
      anchor="right"
      open={drawer.isOpenPropertyAddWorkflow}
      onClose={drawer.closePropertyAddWorkflowDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: '80%', lg: 960 },
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
            <HomeOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="h6" fontWeight={600}>
            Add Property
          </Typography>
        </Stack>
        <IconButton onClick={drawer.closePropertyAddWorkflowDrawer} size="small">
          <CloseOutlined />
        </IconButton>
      </Box>

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.paper' }}>
        <PropertyAddWorkflow onClose={drawer.closePropertyAddWorkflowDrawer} />
      </Box>
    </Drawer>
  );
}
