import { useMemo, useState } from 'react';
import { Box, Button, Stack, Typography, useTheme } from '@mui/material';
import {
  DollarOutlined, ToolOutlined, CalendarOutlined,
  FileTextOutlined, UploadOutlined, PlusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';
import LeasePreviewModal from 'components/dialogs/LeasePreviewModal';
import { darkModeActionButtonSx, propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyQuickActionsPanel({ property, propertyId }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [leasePreviewOpen, setLeasePreviewOpen] = useState(false);

  const activeLease = useMemo(() => {
    const units = property?.units || property?.Units || [];
    for (const unit of units) {
      const lease = unit.lease || unit.Lease;
      if (lease && (lease.isActive || lease.IsActive)) return lease;
    }
    return null;
  }, [property]);

  const leaseAction = activeLease
    ? { label: 'View lease',   icon: <FileTextOutlined style={{ fontSize: 13 }} />, onClick: () => setLeasePreviewOpen(true) }
    : { label: 'Create lease', icon: <PlusOutlined    style={{ fontSize: 13 }} />, onClick: () => navigate('/landlord/leases/selection') };

  const ACTIONS = [
    { label: 'Record payment',         icon: <DollarOutlined   style={{ fontSize: 13 }} />, onClick: () => drawer.openPaymentAddDrawer() },
    { label: 'New maintenance ticket', icon: <ToolOutlined     style={{ fontSize: 13 }} />, onClick: () => drawer.openMaintenanceAddDrawer({ propertyId, propertyName: property?.name }) },
    { label: 'Schedule inspection',    icon: <CalendarOutlined style={{ fontSize: 13 }} />, onClick: () => drawer.openScheduleInspectionDrawer(propertyId) },
    leaseAction,
    { label: 'Upload document',        icon: <UploadOutlined   style={{ fontSize: 13 }} />, onClick: () => navigate('/landlord/documents') },
  ];

  const btnSx = {
    ...darkModeActionButtonSx(theme.palette.primary.main),
    justifyContent: 'flex-start',
    textTransform: 'none',
    borderRadius: 1.25,
    fontWeight: 600,
    fontSize: '0.8rem',
    py: 0.75,
  };

  return (
    <>
      <Box sx={propertyAccentCardSx(theme.palette.primary.main, { p: 1.5, borderRadius: 1.5 })}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Quick actions
        </Typography>
        <Stack spacing={0.75} sx={{ mt: 1 }}>
          {ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="outlined"
              size="small"
              fullWidth
              startIcon={action.icon}
              onClick={action.onClick}
              sx={btnSx}
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </Box>

      {activeLease && (
        <LeasePreviewModal
          open={leasePreviewOpen}
          onClose={() => setLeasePreviewOpen(false)}
          leaseId={activeLease.id || activeLease.Id}
        />
      )}
    </>
  );
}
