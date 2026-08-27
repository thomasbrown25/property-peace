import { Box, Stack, Typography, Chip, alpha, useTheme, Avatar, Divider } from '@mui/material';
import { DollarOutlined, UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { formatRentStatus, getRentStatusColor } from 'utils/formatters';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function RentCollectionSingleHeader({ rent }) {
  const theme = useTheme();

  // Determine display name
  const displayName =
    rent?.propertyType?.toLowerCase() === 'singlefamily'
      ? rent?.propertyName
      : rent?.unitName
      ? `${rent?.propertyName} - ${rent?.unitName}`
      : rent?.propertyName;

  // Get tenants
  const tenants = rent?.tenants || [];

  return (
    <Box sx={{ mb: 4 }}>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Leases', path: '/landlord/leases' },
          { label: displayName || 'Rent Details' }
        ]}
      />

      {/* Header Row */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
        sx={{
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          gap: 2
        }}
      >
        {/* Left Side - Title and Info */}
        <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <DollarOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h3" fontWeight={700} sx={{ mb: 0.5 }} noWrap>
                {displayName || 'Rent Details'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rent payment history and details
              </Typography>
            </Box>
          </Stack>

          {/* Status Chip */}
          {rent?.status && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={formatRentStatus(rent.status)}
                color={getRentStatusColor(rent.status)}
                size="medium"
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          )}

          {/* Tenant Information */}
          {tenants && tenants.length > 0 && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <UserOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                  Tenant{tenants.length > 1 ? 's' : ''}
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                {tenants.map((tenant, index) => (
                  <Box key={tenant.id || index}>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                          fontSize: 14,
                          fontWeight: 600
                        }}
                      >
                        {tenant.firstname?.[0]?.toUpperCase() || tenant.lastname?.[0]?.toUpperCase() || 'T'}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {tenant.firstname} {tenant.lastname}
                        </Typography>
                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 1 }}>
                          {tenant.email && (
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <MailOutlined style={{ fontSize: 12, color: theme.palette.text.secondary }} />
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {tenant.email}
                              </Typography>
                            </Stack>
                          )}
                          {tenant.phoneNumber && (
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <PhoneOutlined style={{ fontSize: 12, color: theme.palette.text.secondary }} />
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {tenant.phoneNumber}
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                    {index < tenants.length - 1 && (
                      <Divider sx={{ mt: 1.5, opacity: 0.5 }} />
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

