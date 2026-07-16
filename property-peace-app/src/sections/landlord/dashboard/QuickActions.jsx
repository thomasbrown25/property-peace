// material-ui
import { alpha, Grid } from '@mui/material';
import { Typography } from '@mui/material';
import { Stack, Box } from '@mui/material';
import { useState } from 'react';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';

//asset
import FileTextFilled from '@ant-design/icons/FileTextFilled';
import { DollarCircleOutlined, HomeFilled, ToolOutlined } from '@ant-design/icons';
import { useDrawer } from 'contexts/DrawerContext';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { useNavigate } from 'react-router';

// ==============================|| QuickActions - ICONS ||============================== //

export default function QuickActions() {
  const drawer = useDrawer();
  const navigate = useNavigate();
  const selectedProperty = useSelector(selectProperty);

  const handlePropertyAddClick = () => {
    drawer.openPropertyAddWorkflowDrawer();
  };

  const handleLeaseAddClick = () => {
    navigate('/landlord/leases/selection');
  };

  const handleRecordPaymentClick = () => {
    drawer.openPaymentAddDrawer();
  };

  return (
    <Box>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 6, sm: 6, lg: 3 }}>
          <MainCard
            className="add-property-quick-action"
            boxShadow
            sx={{
              cursor: 'pointer',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
            onClick={handlePropertyAddClick}
          >
            <Stack sx={{ gap: 2, alignItems: 'center' }}>
              <Avatar size="md" type="filled" color="success">
                <HomeFilled />
              </Avatar>
              <Typography variant="subtitle1">Add Property</Typography>
            </Stack>
          </MainCard>
        </Grid>
        <Grid size={{ xs: 6, sm: 6, lg: 3 }}>
          <MainCard
            boxShadow
            sx={{
              cursor: 'pointer',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
            onClick={handleRecordPaymentClick}
          >
            <Stack sx={{ gap: 2, alignItems: 'center' }}>
              <Avatar size="md" type="filled" color="success">
                <DollarCircleOutlined />
              </Avatar>
              <Typography variant="subtitle1">Record Payment</Typography>
            </Stack>
          </MainCard>
        </Grid>
        <Grid size={{ xs: 6, sm: 6, lg: 3 }}>
          <MainCard
            boxShadow
            sx={{
              cursor: 'pointer',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
            onClick={drawer.openMaintenanceAddDrawer}
          >
            <Stack sx={{ gap: 2, alignItems: 'center' }}>
              <Avatar size="md" type="filled" color="info">
                <ToolOutlined />
              </Avatar>
              <Typography variant="subtitle1">Add Maintenance</Typography>
            </Stack>
          </MainCard>
        </Grid>
        <Grid size={{ xs: 6, sm: 6, lg: 3 }}>
          {' '}
          <MainCard
            className="add-lease-quick-action"
            boxShadow
            sx={{
              cursor: 'pointer',
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
            onClick={handleLeaseAddClick}
          >
            <Stack sx={{ gap: 2, alignItems: 'center' }}>
              <Avatar size="md" type="filled" color="warning">
                <FileTextFilled />
              </Avatar>
              <Typography variant="subtitle1">Add Lease</Typography>
            </Stack>
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
