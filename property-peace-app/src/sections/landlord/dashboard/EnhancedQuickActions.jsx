// material-ui
import { alpha, Grid, Card, CardContent, Tooltip } from '@mui/material';
import { Typography } from '@mui/material';
import { Stack, Box } from '@mui/material';
import { useState } from 'react';

// project imports
import Avatar from 'components/@extended/Avatar';

//asset
import FileTextFilled from '@ant-design/icons/FileTextFilled';
import { DollarCircleOutlined, HomeFilled, ToolOutlined, PlusOutlined } from '@ant-design/icons';
import { useDrawer } from 'contexts/DrawerContext';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { useNavigate } from 'react-router';
import { useTheme } from '@mui/material/styles';

// ==============================|| Enhanced QuickActions ||============================== //

const ActionCard = ({ icon, label, color, onClick, description }) => {
  const theme = useTheme();
  
  return (
    <Tooltip title={description || ''} arrow placement="top">
      <Card
        onClick={onClick}
        sx={{
          '--card-accent': color,
          cursor: 'pointer',
          height: 'auto',
          minHeight: 64,
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.mode === 'dark' ? alpha(color, 0.28) : alpha(theme.palette.divider, 0.08)}`,
          borderLeft: `3px solid ${color}`,
          borderRadius: 1.5,
          boxShadow: theme.palette.mode === 'dark' ? `0 10px 28px ${alpha(theme.palette.common.black, 0.18)}` : `0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
          backgroundImage: theme.palette.mode === 'dark' ? `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 46%)` : 'none',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            transform: 'translateY(-2px) scale(1.02)',
            boxShadow: `0 4px 12px ${alpha(color, 0.15)}`,
            borderLeftWidth: '4px',
            borderColor: color,
            '& .action-icon': {
              transform: 'scale(1.1)',
              bgcolor: alpha(color, 0.12)
            },
            '& .action-label': {
              color: color
            }
          }
        }}
      >
        <CardContent sx={{ p: 1.5, py: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
            <Box
              className="action-icon"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(color, 0.08),
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <Avatar size="sm" type="filled" sx={{ bgcolor: color, width: 28, height: 28 }}>
                {icon}
              </Avatar>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography 
                className="action-label"
                variant="subtitle2" 
                fontWeight={600}
                sx={{ 
                  transition: 'color 0.2s ease',
                  fontSize: '0.875rem',
                  lineHeight: 1.3,
                  fontFamily: "'Host Grotesk', sans-serif"
                }}
              >
                {label}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Tooltip>
  );
};

export default function EnhancedQuickActions() {
  const drawer = useDrawer();
  const navigate = useNavigate();
  const theme = useTheme();

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

  const actions = [
    {
      icon: <HomeFilled style={{ fontSize: 18 }} />,
      label: 'Add Property',
      description: 'Register a new property',
      color: theme.palette.primary.main,
      onClick: handlePropertyAddClick,
      className: 'add-property-quick-action'
    },
    {
      icon: <DollarCircleOutlined style={{ fontSize: 18 }} />,
      label: 'Record Payment',
      description: 'Log rent payment',
      color: theme.palette.success.main,
      onClick: handleRecordPaymentClick,
      className: 'record-payment-quick-action'
    },
    {
      icon: <ToolOutlined style={{ fontSize: 18 }} />,
      label: 'Add Maintenance',
      description: 'Create work order',
      color: theme.palette.info.main,
      onClick: () => navigate('/landlord/maintenances/add'),
      className: 'add-maintenance-quick-action'
    },
    {
      icon: <FileTextFilled style={{ fontSize: 18 }} />,
      label: 'Add Lease',
      description: 'Create new lease',
      color: theme.palette.warning.main,
      onClick: handleLeaseAddClick,
      className: 'add-lease-quick-action'
    }
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography 
          variant="h6" 
          fontWeight={600} 
          sx={{ 
            fontSize: '1rem',
            fontFamily: "'Host Grotesk', sans-serif"
          }}
        >
          Quick Actions
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          Common tasks at your fingertips
        </Typography>
      </Stack>
      <Grid container spacing={1.5}>
        {actions.map((action, index) => (
          <Grid size={{ xs: 6, sm: 6, lg: 3 }} key={index}>
            <ActionCard {...action} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

