import { useMemo } from 'react';
import { Typography, Stack, Button, Chip, Paper, Divider, IconButton, CircularProgress, alpha } from '@mui/material';
import { HomeOutlined, DollarOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
import { formatCurrency } from 'utils/formatters';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import { useNavigate } from 'react-router';
import { normalizeRentBalance } from 'utils/rentBalance';

/**
 * HouseholdCard Component
 * Displays all tenants for a single property (or unit if multi-unit)
 */
export default function HouseholdCard({ property, tenants = [], onViewLease, onEditHousehold }) {
  const navigate = useNavigate();
  const isSingleUnitPortfolio = property?.isSingleUnitPortfolio || property?.propertyType === 'singleFamily';

  // Fetch rent collection data for this property
  const { rentRecords, loading } = useFetchRentCollection(property?.id);

  // Compute display info - use street address if name is null
  const propertyDisplayName = property.name?.trim() || property.streetAddress?.trim() || 'Property';
  const propertyDisplay = isSingleUnitPortfolio ? propertyDisplayName : `${propertyDisplayName} – ${property.unitName}`;

  const balanceDue = useMemo(() => {
    const records = Array.isArray(rentRecords) ? rentRecords : rentRecords ? [rentRecords] : [];
    const record = records.find((item) =>
      Number(item.propertyId ?? item.PropertyId) === Number(property?.id) &&
      (!property?.unitId || Number(item.unitId ?? item.UnitId) === Number(property.unitId))
    );
    return normalizeRentBalance(record).rentDue;
  }, [rentRecords, property?.id, property?.unitId]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        height: '100%',
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
      }}
    >
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HomeOutlined style={{ fontSize: 20, color: '#722ed1' }} />
          <Typography variant="h6" fontWeight="bold">
            {propertyDisplay}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={property.isActive ? 'Active' : 'Inactive'} color={property.isActive ? 'success' : 'default'} size="small" />
        </Stack>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Tenants List */}
      <Stack spacing={1.2} mb={2}>
        {tenants.length > 0 ? (
          tenants.map((tenant) => (
            <Stack key={tenant.id} direction="row" spacing={1} alignItems="center">
              <UserOutlined style={{ color: '#1890ff' }} />
              <Typography variant="body2">
                {tenant.firstname} {tenant.lastname}
              </Typography>
            </Stack>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No tenants assigned to this household.
          </Typography>
        )}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Balance Info */}
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <DollarOutlined style={{ color: '#cf1322' }} />
        {loading ? <CircularProgress size={14} /> : <Typography variant="body2">Balance Due: {formatCurrency(balanceDue)}</Typography>}
      </Stack>

      {/* Actions */}
      <Stack direction="row" justifyContent="center">
        <Button size="small" variant="outlined" onClick={() => navigate(`${property.id}`)}>
          View Household
        </Button>
      </Stack>
    </Paper>
  );
}
