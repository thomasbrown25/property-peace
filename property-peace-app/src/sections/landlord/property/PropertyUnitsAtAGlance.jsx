import { useState, useMemo } from 'react';
import {
  alpha, Avatar, Box, Button, Chip, Divider, IconButton,
  InputAdornment, OutlinedInput, Stack, Typography, useTheme
} from '@mui/material';
import { PlusOutlined, SearchOutlined, ArrowRightOutlined, MoreOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import unitIcon from 'assets/images/icons/unit.png';
import { formatCurrency } from 'utils/formatters';
import { differenceInDays, differenceInMonths, format } from 'date-fns';
import UnitDetailDrawer from 'components/drawers/UnitDetailDrawer';
import BulkUnitCreateDrawer from 'components/drawers/BulkUnitCreateDrawer';
import { darkModeActionButtonSx, propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyUnitsAtAGlance({ property, propertyId }) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [addUnitOpen, setAddUnitOpen] = useState(false);

  const units = property?.units || property?.Units || [];

  const filteredUnits = useMemo(() => {
    if (!search.trim()) return units;
    const q = search.toLowerCase();
    return units.filter((u) => {
      const name = (u.name || u.Name || '').toLowerCase();
      const tenants = u.lease?.tenants || u.lease?.Tenants || [];
      const tenantNames = tenants
        .map((t) => `${t.firstname || t.Firstname || ''} ${t.lastname || t.Lastname || ''}`.trim())
        .join(' ')
        .toLowerCase();
      return name.includes(q) || tenantNames.includes(q);
    });
  }, [units, search]);

  return (
    <>
      <MainCard
        title={
          <Box>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.8, color: 'text.secondary', textTransform: 'uppercase', mb: 0.25 }}>
              Units
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              Units at a glance
            </Typography>
          </Box>
        }
        secondary={
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlusOutlined />}
            onClick={() => setAddUnitOpen(true)}
            sx={darkModeActionButtonSx(theme.palette.primary.main, { textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem' })}
          >
            Add unit
          </Button>
        }
        contentSX={{ p: 0 }}
        sx={propertyAccentCardSx(theme.palette.primary.main)}
      >
        {/* Search */}
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <OutlinedInput
            size="small"
            fullWidth
            placeholder="Search by unit name or tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startAdornment={
              <InputAdornment position="start">
                <SearchOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
              </InputAdornment>
            }
            sx={{
              bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.035 : 0.02),
              borderRadius: 1.5,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.2) }
            }}
          />
        </Box>

        {/* Unit rows — fixed to ~3 rows, scroll for more */}
        <Box sx={{ height: 219, overflowY: 'auto' }}>
          {filteredUnits.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No units match your search</Typography>
            </Box>
          ) : (
            filteredUnits.map((unit, idx) => {
              const lease = unit.lease || unit.Lease;
              const hasLease = Boolean(lease?.id || lease?.Id);
              const status = (unit.status || unit.Status || '').toLowerCase();
              const isPaid = hasLease && status === 'occupied';
              const isLate = hasLease && status === 'overdue';

              const unitName = unit.name || unit.Name || `Unit ${idx + 1}`;
              const firstLetter = unitName.charAt(0).toUpperCase();

              const dotColor = isLate
                ? theme.palette.error.main
                : isPaid
                ? theme.palette.success.main
                : theme.palette.warning.main;

              const statusChipLabel = isLate ? 'late' : isPaid ? 'on time' : 'vacant';
              const statusChipColor = isLate ? 'error' : isPaid ? 'success' : 'warning';

              const tenants = lease?.tenants || lease?.Tenants || [];
              const primaryTenant = tenants[0];
              const firstName = primaryTenant?.firstname || primaryTenant?.Firstname || '';
              const lastName = primaryTenant?.lastname || primaryTenant?.Lastname || '';
              const tenantName = primaryTenant ? `${firstName} ${lastName}`.trim() : null;
              const tenantInitials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();

              const leaseStart = lease?.startDate || lease?.StartDate;
              const leaseEnd = lease?.endDate || lease?.EndDate;
              const rentAmount = lease?.rentAmount || lease?.RentAmount || unit.rentAmount || unit.RentAmount || 0;

              const beds = unit.bedrooms || unit.Bedrooms;
              const baths = unit.baths || unit.Baths;
              const sqft = unit.squareFeet || unit.SquareFeet;

              const specParts = [];
              if (beds || baths) specParts.push(`${beds || '—'}bd / ${baths || '—'}ba`);
              if (sqft) specParts.push(`${Number(sqft).toLocaleString()} sqft`);

              const leaseEndDate = leaseEnd ? new Date(leaseEnd) : null;
              const leaseStartDate = leaseStart ? new Date(leaseStart) : null;
              const monthsLeft = leaseEndDate ? differenceInMonths(leaseEndDate, new Date()) : null;
              const daysLeft = leaseEndDate ? differenceInDays(leaseEndDate, new Date()) : null;

              const leaseEndStr = leaseEndDate ? `ends ${format(leaseEndDate, 'MMM d, yyyy')}` : null;
              const timeLeftStr =
                monthsLeft !== null && monthsLeft > 0
                  ? `${monthsLeft}mo left`
                  : daysLeft !== null && daysLeft > 0
                  ? `${daysLeft}d left`
                  : null;
              const tenantSinceStr = leaseStartDate ? `since ${format(leaseStartDate, 'MMM yyyy')}` : null;

              return (
                <Box key={unit.id || idx}>
                  {idx > 0 && <Divider sx={{ borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.12) : alpha(t.palette.divider, 0.14) }} />}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      transition: 'background 0.12s',
                      '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, t.palette.mode === 'dark' ? 0.5 : 0.7) }
                    }}
                  >
                    {/* Unit icon */}
                    <Box sx={{ width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={unitIcon} alt="unit" style={{ width: 32, height: 32, objectFit: 'contain', opacity: 0.7 }} />
                    </Box>

                    {/* Unit name + status chip + specs */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.2 }}>
                        <Typography fontWeight={700} sx={{ fontSize: '0.88rem' }}>{unitName}</Typography>
                        <Chip
                          label={statusChipLabel}
                          size="small"
                          color={statusChipColor}
                          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, '& .MuiChip-label': { px: 0.6 }, flexShrink: 0 }}
                        />
                      </Stack>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }} noWrap>
                        {specParts.join(' · ') || '—'}
                      </Typography>
                    </Box>

                    {/* Tenant */}
                    <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}>
                      {tenantName ? (
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar
                            sx={{ width: 30, height: 30, bgcolor: theme.palette.primary.main, fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}
                          >
                            {tenantInitials}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={600} noWrap sx={{ fontSize: '0.8rem', lineHeight: 1.2 }}>{tenantName}</Typography>
                            {tenantSinceStr && (
                              <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{tenantSinceStr}</Typography>
                            )}
                          </Box>
                        </Stack>
                      ) : (
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>No tenant</Typography>
                      )}
                    </Box>

                    {/* Rent + lease end */}
                    <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', md: 'block' } }}>
                      {rentAmount > 0 ? (
                        <>
                          <Typography fontWeight={700} sx={{ fontSize: '0.88rem', lineHeight: 1.2 }}>
                            {formatCurrency(rentAmount)}/mo
                          </Typography>
                          {leaseEndStr && (
                            <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                              {leaseEndStr}{timeLeftStr ? ` · ${timeLeftStr}` : ''}
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>
                      )}
                    </Box>

                    {/* Actions — pushed to far right */}
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0, ml: 'auto' }}>
                      <Button
                        variant="contained"
                        size="small"
                        endIcon={<ArrowRightOutlined />}
                        onClick={() => setSelectedUnit(unit)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          borderRadius: 1.5,
                          fontSize: '0.78rem',
                          px: 1.5
                        }}
                      >
                        Open
                      </Button>
                      <IconButton size="small" sx={{ color: 'text.disabled' }}>
                        <MoreOutlined style={{ fontSize: 15 }} />
                      </IconButton>
                    </Stack>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </MainCard>

      <UnitDetailDrawer
        open={Boolean(selectedUnit)}
        unit={selectedUnit}
        property={property}
        onClose={() => setSelectedUnit(null)}
      />

      <BulkUnitCreateDrawer
        property={property}
        open={addUnitOpen}
        onClose={() => setAddUnitOpen(false)}
        onSuccess={() => setAddUnitOpen(false)}
      />
    </>
  );
}
