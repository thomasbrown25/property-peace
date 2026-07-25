import { useMemo, useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  OutlinedInput,
  InputAdornment,
  CircularProgress,
  alpha,
  useTheme,
  Grid,
  useMediaQuery,
  Checkbox,
  FormControl,
  Select,
  MenuItem,
  Menu,
  LinearProgress
} from '@mui/material';
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  HomeOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  MoreOutlined,
  SendOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { openSnackbar } from 'api/snackbar';
import useFetchTenants from 'hooks/useFetchTenants';
import { selectTenants } from 'store/tenant/tenant.selector';
import { setProperty } from 'store/property/property.action';
import { deleteTenant } from 'store/tenant/tenant.action';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import AddToLeaseDrawer from 'components/drawers/AddToLeaseDrawer';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import TenantCard from 'components/cards/TenantCard';
import { tenantInviteAPI } from 'api';
import { createTenantInvite } from 'api/tenantInvite';
import { useDrawer } from 'contexts/DrawerContext';
import { formatPhoneInput } from 'utils/formatters';
import AnimateIn from 'components/AnimateIn';
import { TenantCsvImportButton } from 'components/import/CsvImportButtons';

// Helper function to get invites by tenant ID
const getInvitesByTenantId = async (tenantId) => {
  try {
    const response = await tenantInviteAPI.getInvitesByTenantId(tenantId);
    return response;
  } catch (error) {
    console.error('Error getting invites:', error);
    return { success: false, data: [] };
  }
};


const darkAwareBorder = (theme, opacity = 0.14) =>
  theme.palette.mode === 'dark' ? alpha('#cbd5e1', opacity) : 'rgba(0,0,0,0.09)';

const sidebarHeaderColor = (theme) => (theme.palette.mode === 'dark' ? theme.palette.text.primary : alpha('#061e35', 0.58));

const sectionCardSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: 'background.paper',
  border: (t) => `1px solid ${darkAwareBorder(t)}`,
  boxShadow: (t) => t.palette.mode === 'dark'
    ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
    : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
};

function SidebarMetric({ label, value, color = 'success.main', progress = 0, note, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 1.25,
        p: onClick ? 0.75 : 0,
        mx: onClick ? -0.75 : 0,
        transition: 'background-color 0.15s ease',
        '&:hover': onClick ? { bgcolor: (t) => alpha(t.palette.action.hover, t.palette.mode === 'dark' ? 0.5 : 0.7) } : undefined
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>{value}</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, progress))}
        sx={{ height: 5, borderRadius: 99, bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.14 : 0.07), '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: color } }}
      />
      {note && <Typography sx={{ mt: 0.35, fontSize: '0.68rem', color, fontWeight: 700 }}>{note}</Typography>}
    </Box>
  );
}

function TenantAccessCard({ tenants, tenantInvites, onFilter }) {
  const metrics = useMemo(() => {
    const total = tenants.length || 0;
    const withAccounts = tenants.filter((tenant) => tenant.userId || tenant.UserId).length;
    const pendingInvites = tenants.filter((tenant) => !(tenant.userId || tenant.UserId) && tenant.email && tenantInvites[tenant.id]).length;
    const needsInvite = tenants.filter((tenant) => !(tenant.userId || tenant.UserId) && tenant.email && !tenantInvites[tenant.id]).length;
    const missingEmail = tenants.filter((tenant) => !(tenant.userId || tenant.UserId) && !tenant.email).length;
    const accessRate = total ? Math.round((withAccounts / total) * 100) : 100;
    const level = accessRate >= 80 ? 'healthy' : accessRate >= 50 ? 'watch' : 'needs invites';
    const levelColor = level === 'healthy' ? 'success.main' : level === 'watch' ? 'warning.main' : 'error.main';
    return { total, withAccounts, pendingInvites, needsInvite, missingEmail, accessRate, level, levelColor };
  }, [tenants, tenantInvites]);

  return (
    <Box sx={sectionCardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.8, color: sidebarHeaderColor, textTransform: 'uppercase' }}>
          Tenant Access
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: metrics.levelColor, fontWeight: 700 }}>• {metrics.level}</Typography>
      </Stack>
      <Stack spacing={1.45}>
        <SidebarMetric label="Account coverage" value={`${metrics.accessRate}%`} progress={metrics.accessRate} color={metrics.levelColor} note={`${metrics.withAccounts} of ${metrics.total} tenants active`} onClick={() => onFilter('withAccounts')} />
        <SidebarMetric label="Pending invites" value={metrics.pendingInvites} progress={metrics.total ? (metrics.pendingInvites / metrics.total) * 100 : 0} color={metrics.pendingInvites ? 'warning.main' : 'success.main'} note={metrics.pendingInvites ? 'waiting on tenant signup' : 'no pending invites'} onClick={metrics.pendingInvites ? () => onFilter('pendingInvites') : undefined} />
        <SidebarMetric label="Ready to invite" value={metrics.needsInvite} progress={metrics.total ? (metrics.needsInvite / metrics.total) * 100 : 0} color={metrics.needsInvite ? 'primary.main' : 'success.main'} note={metrics.needsInvite ? 'email on file, no account' : 'no invite work queued'} onClick={metrics.needsInvite ? () => onFilter('withoutAccounts') : undefined} />
        <SidebarMetric label="Missing email" value={metrics.missingEmail} progress={metrics.total ? (metrics.missingEmail / metrics.total) * 100 : 0} color={metrics.missingEmail ? 'error.main' : 'success.main'} note={metrics.missingEmail ? 'add email to invite' : 'contact info complete'} />
      </Stack>
    </Box>
  );
}

function TenantPortfolioCard({ tenants }) {
  const items = useMemo(() => {
    const assigned = tenants.filter((tenant) => tenant.leaseId || tenant.propertyName).length;
    const unassigned = tenants.length - assigned;
    const uniqueProperties = new Set(tenants.map((tenant) => tenant.propertyId || tenant.propertyName).filter(Boolean)).size;
    const withPhone = tenants.filter((tenant) => tenant.phoneNumber || tenant.phone).length;
    return { assigned, unassigned, uniqueProperties, withPhone, total: tenants.length || 0 };
  }, [tenants]);

  return (
    <Box sx={sectionCardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.8, color: sidebarHeaderColor, textTransform: 'uppercase' }}>
          Tenant Snapshot
        </Typography>
      </Stack>
      <Stack spacing={1.25}>
        {[
          { label: 'Assigned to a home', value: `${items.assigned} tenant${items.assigned === 1 ? '' : 's'}` },
          { label: 'Unassigned tenants', value: `${items.unassigned} tenant${items.unassigned === 1 ? '' : 's'}` },
          { label: 'Properties represented', value: items.uniqueProperties || '—' },
          { label: 'Phone numbers on file', value: `${items.withPhone} of ${items.total}` }
        ].map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', fontWeight: 500 }}>{item.label}</Typography>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>{item.value}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export default function TenantsContent() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const tenants = useSelector(selectTenants);
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  // Reset Redux property/unit on mount/unmount so the filter starts clean.
  useEffect(() => {
    dispatch(setProperty(null));
    dispatch(setUnit(null));
    return () => {
      dispatch(setProperty(null));
      dispatch(setUnit(null));
    };
  }, [dispatch]);

  const previousPropertyIdRef = useRef(null);
  useEffect(() => {
    const currentPropertyId = selectedProperty?.id;
    if (previousPropertyIdRef.current !== null && previousPropertyIdRef.current !== currentPropertyId) {
      dispatch(setUnit(null));
    }
    previousPropertyIdRef.current = currentPropertyId;
  }, [selectedProperty?.id, dispatch]);

  // Default layout: cards on xs, table on other widths
  const defaultLayout = isXs ? 'cards' : 'table';
  const [tenantLayout, setTenantLayout] = useState(defaultLayout);

  // Reset to default when screen size changes
  useEffect(() => {
    const newDefault = isXs ? 'cards' : 'table';
    setTenantLayout(newDefault);
  }, [isXs]);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [tenantToRemove, setTenantToRemove] = useState(null);
  const [sendingInvite, setSendingInvite] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTenantForEdit, setSelectedTenantForEdit] = useState(null);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [activeFilter, setActiveFilter] = useState('all');
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [actionMenuTenant, setActionMenuTenant] = useState(null);
  const [addToLeaseDrawerOpen, setAddToLeaseDrawerOpen] = useState(false);
  const [addToLeaseTenant, setAddToLeaseTenant] = useState(null);
  const [selectedTenantIds, setSelectedTenantIds] = useState(new Set());

  const { refetch, isLoading: loading } = useFetchTenants();
  const [tenantInvites, setTenantInvites] = useState({});

  // Check for invites sent to tenants
  useEffect(() => {
    const checkTenantInvites = async () => {
      if (!tenants || tenants.length === 0) return;
      
      const inviteChecks = tenants
        .filter(t => !t.userId && t.email)
        .map(async (tenant) => {
          try {
            const response = await tenantInviteAPI.getInvitesByTenantId(tenant.id);
            const hasInvite = response.success && response.data && response.data.length > 0;
            return {
              tenantId: tenant.id,
              hasInviteSent: hasInvite
            };
          } catch (error) {
            console.error(`Error checking invites for tenant ${tenant.id}:`, error);
            return { tenantId: tenant.id, hasInviteSent: false };
          }
        });
      
      const results = await Promise.all(inviteChecks);
      const inviteMap = {};
      results.forEach(({ tenantId, hasInviteSent }) => {
        if (hasInviteSent) {
          inviteMap[tenantId] = true;
        }
      });
      setTenantInvites(inviteMap);
    };

    checkTenantInvites();
  }, [tenants]);

  // Filter by selected property
  const filteredByProperty = useMemo(() => {
    if (!selectedProperty?.id) return tenants || [];
    return (tenants || []).filter((t) => t.propertyId === selectedProperty.id);
  }, [tenants, selectedProperty]);

  // Filter by search (tenant name) + active stat filter
  const filteredTenants = useMemo(() => {
    if (!filteredByProperty) return [];
    let list = filteredByProperty;
    if (activeFilter === 'withAccounts') list = list.filter((t) => t.userId);
    else if (activeFilter === 'withoutAccounts') list = list.filter((t) => !t.userId);
    else if (activeFilter === 'pendingInvites') list = list.filter((t) => !t.userId && tenantInvites[t.id]);
    if (!search.trim()) return list;
    const searchLower = search.toLowerCase();
    return list.filter((t) => {
      const fullName = `${t.firstname || ''} ${t.lastname || ''}`.trim().toLowerCase();
      return (
        fullName.includes(searchLower) ||
        t.email?.toLowerCase().includes(searchLower) ||
        t.phoneNumber?.toLowerCase().includes(searchLower) ||
        t.propertyName?.toLowerCase().includes(searchLower)
      );
    });
  }, [filteredByProperty, search, activeFilter, tenantInvites]);

  // Handle layout change
  const handleLayoutChange = (newLayout) => {
    if (newLayout === null) return;
    setTenantLayout(newLayout);
  };

  // Handle sort column click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sort filtered tenants
  const sortedTenants = useMemo(() => {
    if (!filteredTenants || filteredTenants.length === 0) return [];

    return [...filteredTenants].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name': {
          const aName = `${a.firstname || ''} ${a.lastname || ''}`.trim().toLowerCase();
          const bName = `${b.firstname || ''} ${b.lastname || ''}`.trim().toLowerCase();
          comparison = aName.localeCompare(bName);
          break;
        }
        case 'property': {
          const aDisplay = a.propertyType?.toLowerCase() === 'singlefamily'
            ? a.propertyName || ''
            : a.unitName
            ? `${a.propertyName || ''} – ${a.unitName}`
            : a.propertyName || '';
          const bDisplay = b.propertyType?.toLowerCase() === 'singlefamily'
            ? b.propertyName || ''
            : b.unitName
            ? `${b.propertyName || ''} – ${b.unitName}`
            : b.propertyName || '';
          comparison = aDisplay.toLowerCase().localeCompare(bDisplay.toLowerCase());
          break;
        }
        case 'email':
          comparison = (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase());
          break;
        case 'phone':
          comparison = (a.phoneNumber || '').toLowerCase().localeCompare((b.phoneNumber || '').toLowerCase());
          break;
        default:
          return 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredTenants, sortField, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedTenants.length / itemsPerPage);
  const paginatedTenants = useMemo(() => {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedTenants.slice(startIndex, endIndex);
  }, [sortedTenants, page, itemsPerPage]);

  // Reset to first page when items per page changes
  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  // Handle delete click
  const handleRemoveClick = (tenant) => {
    setTenantToRemove(tenant);
    setRemoveConfirmOpen(true);
  };

  // Handle confirm remove
  const handleConfirmRemove = async () => {
    if (!tenantToRemove) return;
    
    setRemoveConfirmOpen(false);
    try {
      await dispatch(deleteTenant(tenantToRemove.id));
      await refetch();
      
      const fullName = `${tenantToRemove.firstname || ''} ${tenantToRemove.lastname || ''}`.trim() || 'Tenant';
      
      openSnackbar({
        open: true,
        message: `Tenant "${fullName}" has been removed from your portfolio`,
        variant: 'alert',
        alert: { 
          color: 'success',
          variant: 'filled'
        },
        close: true,
        actionButton: false,
        anchorOrigin: {
          vertical: 'bottom',
          horizontal: 'right'
        },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
      
      setTenantToRemove(null);
    } catch (error) {
      console.error('Error removing tenant:', error);
      
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to remove tenant',
        variant: 'alert',
        alert: { 
          color: 'error',
          variant: 'filled'
        },
        close: true,
        actionButton: false,
        anchorOrigin: {
          vertical: 'bottom',
          horizontal: 'right'
        },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    }
  };

  // Handle send reminder email
  const handleSendReminder = async (tenant) => {
    if (!tenant.email) {
      openSnackbar({
        open: true,
        message: 'Tenant does not have an email address',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setSendingInvite(prev => ({ ...prev, [tenant.id]: true }));

    try {
      const hasAccount = !!(tenant.userId || tenant.UserId);
      const hasInviteSent = !hasAccount && tenant.email && tenantInvites[tenant.id];

      if (hasInviteSent) {
        const response = await tenantInviteAPI.createTenantInvite({
          tenantId: tenant.id,
          email: tenant.email
        });

        if (response.success) {
          const refreshResponse = await tenantInviteAPI.getInvitesByTenantId(tenant.id);
          if (refreshResponse.success && refreshResponse.data && refreshResponse.data.length > 0) {
            setTenantInvites(prev => ({ ...prev, [tenant.id]: true }));
          }
          openSnackbar({
            open: true,
            message: 'Invite email sent successfully!',
            variant: 'alert',
            alert: { color: 'success' }
          });
          return;
        } else {
          openSnackbar({
            open: true,
            message: response.message || 'Failed to send invite email',
            variant: 'alert',
            alert: { color: 'error' }
          });
          return;
        }
      }

      const response = await createTenantInvite({
        tenantId: tenant.id,
        email: tenant.email
      });

      if (response.success) {
        setTenantInvites(prev => ({ ...prev, [tenant.id]: true }));
        openSnackbar({
          open: true,
          message: 'Reminder email sent successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to send reminder email',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error sending reminder email:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to send reminder email',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSendingInvite(prev => ({ ...prev, [tenant.id]: false }));
    }
  };

  // Handle bulk invite
  const handleBulkInvite = async () => {
    const toInvite = sortedTenants.filter((t) => selectedTenantIds.has(t.id) && t.email && !t.userId);
    for (const tenant of toInvite) {
      await handleSendReminder(tenant);
    }
    setSelectedTenantIds(new Set());
  };

  const toggleTenantSelection = (e, tenantId) => {
    e.stopPropagation();
    setSelectedTenantIds((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId);
      else next.add(tenantId);
      return next;
    });
  };

  const eligibleOnPage = paginatedTenants?.filter((t) => !t.userId && t.email) || [];
  const allEligibleSelected = eligibleOnPage.length > 0 && eligibleOnPage.every((t) => selectedTenantIds.has(t.id));

  const toggleSelectAll = (e) => {
    e.stopPropagation();
    if (allEligibleSelected) {
      setSelectedTenantIds(new Set());
    } else {
      setSelectedTenantIds(new Set(eligibleOnPage.map((t) => t.id)));
    }
  };


  return (
    <Box>
      {/* Search + Filters + Add Button */}
      <AnimateIn direction="bottom" delay={300} distance={120}>
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          flexDirection: { xs: 'column', sm: 'row' }
        }}
      >
        <OutlinedInput
          size="small"
          placeholder="Search tenants, properties..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startAdornment={
            <InputAdornment position="start">
              <SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} />
            </InputAdornment>
          }
          sx={{ flex: 1, width: '100%', minWidth: 0, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
        />

        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'flex-end', sm: 'initial' }, flexWrap: 'wrap' }}>
          {selectedTenantIds.size > 0 && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<SendOutlined style={{ fontSize: 14 }} />}
              onClick={handleBulkInvite}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, height: 34 }}
            >
              Send Invites ({selectedTenantIds.size})
            </Button>
          )}
          <TenantCsvImportButton
            buttonProps={{
              sx: { textTransform: 'none', fontWeight: 600, borderRadius: 1.5, borderColor: (t) => darkAwareBorder(t, 0.22), height: 34 }
            }}
          />
          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<PlusOutlined />}
            onClick={() => drawer.openTenantAddDrawer()}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, height: 34 }}
          >
            Add Tenant
          </Button>
        </Stack>
      </Box>
      </AnimateIn>

      {/* Tenants Display */}
      <AnimateIn direction="bottom" delay={500} distance={120}>
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 9 }}>
          {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <CircularProgress />
                  </Box>
                ) : sortedTenants.length > 0 ? (
                  <>
                  {/* Table View - Hidden on sm or smaller */}
                  <Box sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }}>
                  {tenantLayout === 'table' && (
                    <TableContainer 
                      component={Paper} 
                      variant="outlined" 
                      sx={{ 
                        ...sectionCardSx,
                        p: 0,
                        width: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      <Table size="small" sx={{ minWidth: 920 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 42, pl: 1.5, pr: 0, py: 0.5 }} onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                size="small"
                                indeterminate={selectedTenantIds.size > 0 && !allEligibleSelected}
                                checked={allEligibleSelected}
                                onChange={toggleSelectAll}
                                disabled={eligibleOnPage.length === 0}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Name</span>
                                {sortField === 'name' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('property')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Property / Unit</span>
                                {sortField === 'property' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('email')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Email</span>
                                {sortField === 'email' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('phone')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Phone</span>
                                {sortField === 'phone' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 12 }} /> : <ArrowDownOutlined style={{ fontSize: 12 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="center">Account</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right" />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedTenants.map((tenant) => {
                            const propertyDisplay =
                              tenant.propertyType?.toLowerCase() === 'singlefamily'
                                ? tenant.propertyName
                                : tenant.unitName
                                ? `${tenant.propertyName} – ${tenant.unitName}`
                                : tenant.propertyName;
                            const fullName = `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || 'Unnamed Tenant';
                            const hasAccount = !!(tenant.userId || tenant.UserId);
                            const hasInviteSent = !hasAccount && tenant.email && tenantInvites[tenant.id];
                            const isEligible = !hasAccount && !!tenant.email;
          
                            return (
                              <TableRow
                                key={tenant.id}
                                hover
                                onClick={() => navigate(`/landlord/tenants/${tenant.id}`)}
                                sx={{ cursor: 'pointer' }}
                              >
                                <TableCell sx={{ width: 42, pl: 1.5, pr: 0, py: 0.5 }} onClick={(e) => e.stopPropagation()}>
                                  <Tooltip title={!tenant.email ? 'Add an email address to send an invite' : hasAccount ? 'Tenant already has an account' : ''} disableHoverListener={isEligible}>
                                    <span>
                                      <Checkbox
                                        size="small"
                                        checked={selectedTenantIds.has(tenant.id)}
                                        onChange={(e) => toggleTenantSelection(e, tenant.id)}
                                        disabled={!isEligible}
                                      />
                                    </span>
                                  </Tooltip>
                                </TableCell>
                                <TableCell>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <UserOutlined style={{ fontSize: 16, color: '#061e35' }} />
                                    <Typography variant="body2" fontWeight={500}>{fullName}</Typography>
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  {propertyDisplay ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <HomeOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                                      <Typography variant="body2" color="text.secondary">{propertyDisplay}</Typography>
                                    </Stack>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">—</Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {tenant.email ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <MailOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                                      <Typography variant="body2" color="text.secondary">{tenant.email}</Typography>
                                    </Stack>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">—</Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {(tenant.phoneNumber || tenant.phone) ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <PhoneOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                                      <Typography variant="body2" color="text.secondary">{formatPhoneInput(tenant.phoneNumber || tenant.phone)}</Typography>
                                    </Stack>
                                  ) : (
                                    <Typography variant="body2" color="text.disabled">—</Typography>
                                  )}
                                </TableCell>
                                <TableCell align="center">
                                  {hasAccount ? (
                                    <Chip label="Account Created" color="success" size="small" sx={{ fontWeight: 600 }} />
                                  ) : hasInviteSent ? (
                                    <Chip label="Invite Sent" color="warning" size="small" sx={{ fontWeight: 600 }} />
                                  ) : (
                                    <Chip
                                      label="No account"
                                      size="small"
                                      variant="outlined"
                                      sx={{ color: 'text.disabled', borderColor: 'divider', fontWeight: 400 }}
                                    />
                                  )}
                                </TableCell>
                                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); setActionMenuAnchor(e.currentTarget); setActionMenuTenant(tenant); }}
                                  >
                                    <MoreOutlined />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  </Box>
                  
                  {/* Card View - Always show on xs/sm, show on md+ when layout is 'cards' */}
                  <Box sx={{ display: { xs: 'block', sm: 'block', md: tenantLayout === 'cards' ? 'block' : 'none' } }}>
                    <Grid container spacing={3}>
                      {paginatedTenants.map((tenant) => (
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={tenant.id}>
                          <TenantCard
                            tenant={{ ...tenant, hasInviteSent: tenantInvites[tenant.id] }}
                            onEdit={() => {
                              setSelectedTenantForEdit(tenant);
                              setEditModalOpen(true);
                            }}
                            onDelete={() => handleRemoveClick(tenant)}
                            onClick={() => navigate(`/landlord/tenants/${tenant.id}`)}
                            refetch={refetch}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
          
                  {/* Pagination */}
                  {sortedTenants.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 3,
                        pt: 2,
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                      }}
                    >
                      {/* Items per page dropdown */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Items per page:
                        </Typography>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                          <Select
                            value={itemsPerPage}
                            onChange={(e) => setItemsPerPage(Number(e.target.value))}
                            sx={{ height: 32 }}
                          >
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={20}>20</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
          
                      {/* Page navigation */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Page {page + 1} of {totalPages}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LeftOutlined />}
                            onClick={() => handlePageChange(Math.max(0, page - 1))}
                            disabled={page === 0}
                            sx={{ minWidth: 100 }}
                          >
                            Previous
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            endIcon={<RightOutlined />}
                            onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            sx={{ minWidth: 100 }}
                          >
                            Next
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  </>
                ) : (
                  <Box
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      bgcolor: (theme) => theme.palette.background.paper,
                      borderRadius: 2,
                      border: (theme) => `1px dashed ${theme.palette.divider}`
                    }}
                  >
                    <UserOutlined style={{ fontSize: 48, color: theme.palette.text.disabled, marginBottom: 16 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No tenants found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {search.trim() !== '' || selectedProperty
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Get started by adding your first tenant.'}
                    </Typography>
                  </Box>
                )}
          
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
            <TenantAccessCard tenants={tenants || []} tenantInvites={tenantInvites} onFilter={(filter) => { setActiveFilter(filter); setPage(0); }} />
            <TenantPortfolioCard tenants={tenants || []} />
          </Stack>
        </Grid>
      </Grid>
      </AnimateIn>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={removeConfirmOpen}
        onClose={() => {
          setRemoveConfirmOpen(false);
          setTenantToRemove(null);
        }}
        onConfirm={handleConfirmRemove}
        title="Confirm Remove Tenant"
        message={`Are you sure you want to remove tenant "${tenantToRemove ? `${tenantToRemove.firstname || ''} ${tenantToRemove.lastname || ''}`.trim() || 'this tenant' : 'this tenant'}" from your portfolio? The tenant's account and historical documents will be preserved.`}
        confirmText="Remove Tenant"
        confirmColor="error"
      />

      <TenantEditDrawer
        tenant={selectedTenantForEdit}
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedTenantForEdit(null);
        }}
        onUpdateSuccess={async () => {
          await refetch();
        }}
      />

      {/* Row action menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => { setActionMenuAnchor(null); setActionMenuTenant(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setSelectedTenantForEdit(actionMenuTenant);
            setEditModalOpen(true);
            setActionMenuAnchor(null);
            setActionMenuTenant(null);
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <EditOutlined style={{ fontSize: 14 }} />
            <span>Edit</span>
          </Stack>
        </MenuItem>
        {actionMenuTenant?.leaseId ? (
          <MenuItem
            onClick={() => {
              navigate(`/landlord/leases/${actionMenuTenant.leaseId}`);
              setActionMenuAnchor(null);
              setActionMenuTenant(null);
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <SendOutlined style={{ fontSize: 14 }} />
              <span>View Lease</span>
            </Stack>
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              setAddToLeaseTenant(actionMenuTenant);
              setAddToLeaseDrawerOpen(true);
              setActionMenuAnchor(null);
              setActionMenuTenant(null);
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <SendOutlined style={{ fontSize: 14 }} />
              <span>Add to Lease</span>
            </Stack>
          </MenuItem>
        )}
        {actionMenuTenant && !actionMenuTenant.userId && actionMenuTenant.email && (
          <MenuItem
            disabled={sendingInvite[actionMenuTenant?.id]}
            onClick={() => {
              handleSendReminder(actionMenuTenant);
              setActionMenuAnchor(null);
              setActionMenuTenant(null);
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <MailOutlined style={{ fontSize: 14 }} />
              <span>{tenantInvites[actionMenuTenant?.id] ? 'Resend Invite' : 'Send Invite'}</span>
            </Stack>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            handleRemoveClick(actionMenuTenant);
            setActionMenuAnchor(null);
            setActionMenuTenant(null);
          }}
          sx={{ color: 'error.main' }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <DeleteOutlined style={{ fontSize: 14 }} />
            <span>Remove</span>
          </Stack>
        </MenuItem>
      </Menu>

      <AddToLeaseDrawer
        open={addToLeaseDrawerOpen}
        tenant={addToLeaseTenant}
        onClose={() => { setAddToLeaseDrawerOpen(false); setAddToLeaseTenant(null); }}
        onSuccess={refetch}
      />
    </Box>
  );
}

