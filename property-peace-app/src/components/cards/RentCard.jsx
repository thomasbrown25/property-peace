import { Box, Typography, Grid, Stack, TextField, Button, Chip, Paper, Divider, Tabs, Tab, IconButton, alpha } from '@mui/material';
import {
  UserOutlined,
  HomeOutlined,
  CalendarOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  MailOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { formatCurrency } from 'utils/formatters';
import { useModal } from 'contexts/ModalContext';
import { Link } from 'react-router-dom';
import { formatRentStatus, getRentStatusColor } from '../../utils/formatters';

export default function RentCard({ rent, onSendReminder }) {
  const modal = useModal();
  const propertyDisplay =
    rent.propertyType?.toLowerCase() === 'singlefamily' ? rent.propertyName : `${rent.propertyName} – ${rent.unitName}`;

  // Handle multiple tenants - join with commas
  const tenantsDisplay = () => {
    if (!rent.tenants || !Array.isArray(rent.tenants) || rent.tenants.length === 0) {
      return 'No Tenant';
    }
    return rent.tenants
      .map((tenant) => `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim())
      .filter((name) => name) // Remove empty names
      .join(', ');
  };

  const handleMarkPaid = () => {
    modal.openPaymentModal(rent);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
      }}
    >
      {/* Tenant + Status */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HomeOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Typography variant="h6">{propertyDisplay}</Typography>
        </Stack>
        <Chip label={formatRentStatus(rent.status)} color={getRentStatusColor(rent.status)} size="small" />
      </Stack>

      {/* Property Info */}
      <Stack spacing={1.5} mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <UserOutlined />
          <Typography variant="body2">{tenantsDisplay()}</Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarOutlined />
          <Typography variant="body2">Due: {new Date(rent.dueDate).toLocaleDateString()}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <DollarOutlined style={{ color: '#52c41a' }} />
          <Typography variant="body2">Amount: {formatCurrency(rent.rentAmount)}</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <DollarOutlined style={{ color: '#dd3f27' }} />
          <Typography variant="body2">Overdue: {formatCurrency(rent.overdueAmount)}</Typography>
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Actions */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1}
        mt="auto"
        sx={{ flexWrap: 'wrap' }}
      >
        <Button
          component={Link}
          to={`/landlord/rent-collection?propertyId=${rent.propertyId}`}
          size="small"
          variant="outlined"
          startIcon={<EyeOutlined />}
          sx={{ minHeight: 44 }}
        >
          View Payments
        </Button>
        <Stack direction="row" gap={1}>
          <Button size="small" variant="outlined" color="success" startIcon={<CheckCircleOutlined />} onClick={handleMarkPaid} sx={{ minHeight: 44 }}>
            Record Payment
          </Button>
          <IconButton size="small" color="warning" onClick={() => onSendReminder(rent)} aria-label={`Send rent reminder for ${propertyDisplay}`} sx={{ minWidth: 44, minHeight: 44 }}>
            <MailOutlined />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
}
