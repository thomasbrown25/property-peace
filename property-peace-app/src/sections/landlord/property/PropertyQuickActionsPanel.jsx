import { isDetachedSingleUnitType } from 'utils/propertyType';
import { useMemo, useState } from 'react';
import { alpha, Box, Button, Collapse, Stack, Typography, useTheme } from '@mui/material';
import {
  DollarOutlined, ToolOutlined,
  FileTextOutlined, UploadOutlined, PlusOutlined, ThunderboltOutlined, DownOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';
import LeasePreviewModal from 'components/dialogs/LeasePreviewModal';
import { rentalMode } from 'utils/rentalMode';
import { darkModeActionButtonSx, propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyQuickActionsPanel({ property, propertyId, mobile = false }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [leasePreviewOpen, setLeasePreviewOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const units = property?.units || property?.Units || [];
  const hasLongTermUnits = units.some(unit => rentalMode(unit) !== 'shortTerm');
  const canCreateLease = hasLongTermUnits || (units.length === 0 && isDetachedSingleUnitType(property?.propertyType));

  const activeLease = useMemo(() => {
    const units = property?.units || property?.Units || [];
    for (const unit of units.filter(unit => rentalMode(unit) !== 'shortTerm')) {
      const lease = unit.lease || unit.Lease;
      if (lease && (lease.isActive || lease.IsActive)) return lease;
    }
    return null;
  }, [property]);

  const ACTIONS = [
    ...(canCreateLease ? [{
      label: 'Create a lease',
      icon: <PlusOutlined style={{ fontSize: 13 }} />,
      onClick: () => drawer.openLeaseAddDrawer(null, property)
    }] : []),
    ...(hasLongTermUnits ? [
      ...(activeLease ? [{ label: 'View lease', icon: <FileTextOutlined style={{ fontSize: 13 }} />, onClick: () => setLeasePreviewOpen(true) }] : []),
      { label: 'Record payment', icon: <DollarOutlined style={{ fontSize: 13 }} />, onClick: () => drawer.openPaymentAddDrawer({ property: property || { id: propertyId } }) }
    ] : []),
    { label: 'New maintenance ticket', icon: <ToolOutlined     style={{ fontSize: 13 }} />, onClick: () => drawer.openMaintenanceAddDrawer({ propertyId, propertyName: property?.name }) },
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
      {mobile ? (
        <Box>
          <Button
            id="mobile-property-quick-actions-button"
            fullWidth
            variant="outlined"
            startIcon={<ThunderboltOutlined />}
            endIcon={<DownOutlined />}
            onClick={() => setMobileActionsOpen((open) => !open)}
            aria-controls={mobileActionsOpen ? 'mobile-property-quick-actions-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={mobileActionsOpen}
            sx={{
              minHeight: 52,
              justifyContent: 'flex-start',
              px: 2,
              borderRadius: 1.75,
              borderColor: alpha(theme.palette.brand.forest, 0.14),
              bgcolor: 'background.paper',
              color: theme.palette.brand.forest,
              fontWeight: 800,
              textTransform: 'none',
              boxShadow: `0 10px 26px ${alpha(theme.palette.brand.forest, 0.09)}`,
              transition: 'border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
              '& .MuiButton-endIcon': {
                ml: 'auto',
                transform: mobileActionsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)'
              },
              '&:hover': {
                borderColor: alpha(theme.palette.brand.forest, 0.24),
                bgcolor: 'background.paper',
                boxShadow: `0 12px 30px ${alpha(theme.palette.brand.forest, 0.12)}`
              }
            }}
          >
            Actions
          </Button>

          <Collapse in={mobileActionsOpen} timeout={320} unmountOnExit>
            <Box
              id="mobile-property-quick-actions-menu"
              role="menu"
              aria-labelledby="mobile-property-quick-actions-button"
              sx={{
                mt: 1,
                p: 0.75,
                borderRadius: 2,
                bgcolor: '#f8fafc',
                border: `1px solid ${alpha(theme.palette.brand.forest, 0.1)}`,
                boxShadow: `0 14px 34px ${alpha(theme.palette.brand.forest, 0.1)}`
              }}
            >
              <Stack spacing={0.75}>
                {ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    role="menuitem"
                    variant="outlined"
                    fullWidth
                    startIcon={action.icon}
                    onClick={() => {
                      setMobileActionsOpen(false);
                      action.onClick();
                    }}
                    sx={{
                      minHeight: 50,
                      justifyContent: 'flex-start',
                      px: 1.5,
                      borderRadius: 1.5,
                      borderColor: alpha(theme.palette.brand.forest, 0.1),
                      bgcolor: 'background.paper',
                      color: theme.palette.brand.forest,
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: `0 4px 12px ${alpha(theme.palette.brand.forest, 0.045)}`,
                      '&:hover': { borderColor: alpha(theme.palette.brand.forest, 0.22), bgcolor: 'background.paper' }
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            </Box>
          </Collapse>
        </Box>
      ) : (
        <Box sx={propertyAccentCardSx(theme.palette.primary.main, { p: 1.5, borderRadius: 1.5, height: '100%' })}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Actions
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
      )}

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
