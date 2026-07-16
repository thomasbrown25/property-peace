import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Stack,
  TextField,
  Button,
  Divider,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  Pagination,
  CircularProgress
} from '@mui/material';
import { PlusOutlined } from '@ant-design/icons';
import { useDrawer } from 'contexts/DrawerContext';
import { useDispatch, useSelector } from 'react-redux';
import { setProperty } from 'store/property/property.action';

import TenantAddDrawer from 'components/drawers/TenantAddDrawer';
import HouseholdCard from 'components/cards/HouseholdCard';
import useFetchAllTenants from 'hooks/useFetchAllTenants';
import { selectTenants } from 'store/tenant/tenant.selector';

export default function HouseholdsPage() {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { isLoading } = useFetchAllTenants();
  const tenants = useSelector(selectTenants);

  // Reset property selection to "All" on mount
  useEffect(() => {
    dispatch(setProperty(null));
  }, [dispatch]);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('current');
  const [sortBy, setSortBy] = useState('Property Name');
  const [page, setPage] = useState(1);

  const PER_PAGE = 6;

  // --- Group tenants by property (and unit if multi-unit) ---
  const allGroupedHouseholds = useMemo(() => {
    if (!tenants) return [];

    const groups = {};
    tenants.forEach((t) => {
      const key = t.propertyId + (t.unitId ? `-${t.unitId}` : '');
      if (!groups[key]) {
        groups[key] = {
          property: {
            id: t.propertyId,
            name: t.propertyName,
            unitName: t.unitName,
            isActive: t.isActive,
            isSingleUnitPortfolio: t.propertyType?.toLowerCase() === 'singlefamily'
          },
          tenants: [],
          createdAt: t.createdAt
        };
      }
      groups[key].tenants.push(t);
    });

    return Object.values(groups);
  }, [tenants]);

  // Calculate counts for tabs
  const currentHouseholdsCount = useMemo(() => {
    return allGroupedHouseholds.filter((h) => h.tenants.some((t) => t.isActive)).length;
  }, [allGroupedHouseholds]);

  const historyHouseholdsCount = useMemo(() => {
    return allGroupedHouseholds.filter((h) => !h.tenants.some((t) => t.isActive)).length;
  }, [allGroupedHouseholds]);

  // Filter by tab
  const groupedHouseholds = useMemo(() => {
    let households = allGroupedHouseholds;

    // Filter by tab
    households = households.filter((h) => {
      const anyActive = h.tenants.some((t) => t.isActive);
      return tab === 'current' ? anyActive : !anyActive;
    });

    // Filter by search
    if (search) {
      const s = search.toLowerCase();
      households = households.filter(
        (h) =>
          h.property.name?.toLowerCase()?.includes(s) ||
          h.property.unitName?.toLowerCase()?.includes(s) ||
          h.tenants.some((t) => t.firstname?.toLowerCase()?.includes(s) || t.lastname?.toLowerCase()?.includes(s))
      );
    }

    // Sort
    households.sort((a, b) => {
      if (sortBy === 'Created Date') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'Property Name') return (a.property.name || '').localeCompare(b.property.name || '');
      if (sortBy === 'Tenant Count') return b.tenants.length - a.tenants.length;
      return 0;
    });

    return households;
  }, [tenants, tab, search, sortBy]);

  // --- Pagination ---
  const count = Math.ceil(groupedHouseholds.length / PER_PAGE);
  const paginated = groupedHouseholds.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <Box>
      {/* Page Title */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Households
        </Typography>
      </Box>

      {/* Search + Tabs + Sort + Add Tenant */}
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 2, alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <TextField
          size="small"
          sx={{ width: { xs: '100%', sm: 400 } }}
          placeholder="Search households, tenants, or properties..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <Box display="flex" gap={2} justifyContent="flex-end" width="100%" alignItems="center">
          <Box>
            <Tabs
              value={tab}
              onChange={(e, newValue) => {
                setTab(newValue);
                setPage(1);
              }}
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab value="current" label={`Current (${currentHouseholdsCount})`} />
              <Tab value="history" label={`History (${historyHouseholdsCount})`} />
            </Tabs>
          </Box>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <MenuItem value="Created Date">Sort by Created Date</MenuItem>
              <MenuItem value="Property Name">Sort by Property Name</MenuItem>
              <MenuItem value="Tenant Count">Sort by Tenant Count</MenuItem>
            </Select>
          </FormControl>

          <Button
            sx={{ maxWidth: 160 }}
            fullWidth
            size="small"
            variant="contained"
            startIcon={<PlusOutlined />}
            onClick={drawer.openTenantAddDrawer}
          >
            Add Tenant
          </Button>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      {/* Households Grid */}
      {isLoading ? (
        <Box textAlign="center" py={5}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Loading households...
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {paginated.length > 0 ? (
            paginated.map((household) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={household.property.id}>
                <HouseholdCard
                  property={household.property}
                  tenants={household.tenants}
                  onViewLease={() => console.log('View household', household)}
                  onEditHousehold={() => console.log('Edit household', household)}
                />
              </Grid>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No {tab === 'current' ? 'active' : 'historical'} households found.
            </Typography>
          )}
        </Grid>
      )}

      {/* Pagination */}
      <Stack spacing={2} sx={{ gap: 2, alignItems: 'flex-end', p: 2.5, my: 0.5 }}>
        <Pagination
          count={count}
          size="medium"
          page={page}
          showFirstButton
          showLastButton
          variant="combined"
          color="primary"
          onChange={(e, p) => setPage(p)}
        />
      </Stack>

      <TenantAddDrawer />
    </Box>
  );
}
