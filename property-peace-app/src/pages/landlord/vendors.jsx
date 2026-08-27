import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  CircularProgress,
  IconButton,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  InputAdornment,
  useTheme,
  alpha,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled,
  Slide,
  Switch,
  Divider
} from '@mui/material';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  PhoneOutlined,
  MailOutlined,
  ShopOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  ContactsOutlined,
  DollarOutlined,
  FileTextOutlined,
  MoreOutlined,
  DownOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { formatPhoneInput } from 'utils/formatters';
import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';
import { VendorCsvImportButton } from 'components/import/CsvImportButtons';
import { useDispatch, useSelector } from 'react-redux';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import { getVendors, addVendor, updateVendor, deleteVendor } from 'store/vendor/vendor.action';
import { selectVendors, selectVendorLoading } from 'store/vendor/vendor.selector';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import useFetchMaintenances from 'hooks/useFetchMaintenances';

const STEPS = ['Basic Info', 'Contact', 'Financial', 'Review'];

const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
  },
  [`&.${stepConnectorClasses.disabled}`]: {
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.grey[300] }
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor: theme.palette.grey[300],
    borderTopWidth: 2,
    borderRadius: 1
  }
}));

const PAGE_SIZE = 10;
const NAVY = '#061e35';

const EMPTY_FORM = {
  name: '',
  businessName: '',
  email: '',
  phone: '',
  category: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  taxId: '',
  licenseNumber: '',
  requires1099: false,
  notes: ''
};

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function SummaryCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 112,
        p: 2,
        borderRadius: 2.5,
        font: 'inherit',
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        border: `1px solid ${active ? alpha(color, 0.5) : alpha(theme.palette.divider, 0.16)}`,
        bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.14 : 0.055) : 'background.paper',
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha(NAVY, 0.05)}`,
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.42), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.25)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Box minWidth={0}>
          <Typography
            sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}
          >
            {label}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: '1.5rem', lineHeight: 1.15, fontWeight: 800 }}>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function VendorRow({ vendor, openRequestCount, onEdit, onActions }) {
  const theme = useTheme();
  const address = [vendor.address, vendor.city, vendor.state, vendor.zipCode].filter(Boolean).join(', ');
  const hasContact = Boolean(vendor.email || vendor.phone);
  const initial = (vendor.businessName || vendor.name || 'V').trim().charAt(0).toUpperCase();

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onEdit(vendor)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit(vendor);
        }
      }}
      sx={{
        width: '100%',
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.6, md: 1.4 },
        border: 0,
        bgcolor: 'transparent',
        color: 'text.primary',
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(230px, 1.45fr) minmax(190px, 1.1fr) minmax(145px, .8fr) minmax(155px, .85fr) 44px',
        gap: { xs: 1.25, md: 2 },
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.07 : 0.025) },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.4)}`, outlineOffset: -2 }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 42, height: 42, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 750 }}>
          {initial}
        </Avatar>
        <Box minWidth={0}>
          <Stack direction="row" spacing={0.7} alignItems="center" minWidth={0}>
            <Typography fontWeight={720} noWrap>
              {vendor.name || 'Unnamed vendor'}
            </Typography>
            {!vendor.isActive && <Chip label="Inactive" size="small" sx={{ height: 20, fontSize: '0.64rem' }} />}
          </Stack>
          <Typography noWrap sx={{ mt: 0.25, fontSize: '0.74rem', color: 'text.secondary' }}>
            {[vendor.businessName, vendor.category].filter(Boolean).join(' · ') || 'Category not set'}
          </Typography>
        </Box>
      </Stack>

      <Box minWidth={0}>
        <Stack spacing={0.4}>
          {vendor.email && (
            <Typography
              component="a"
              href={`mailto:${vendor.email}`}
              onClick={(event) => event.stopPropagation()}
              noWrap
              sx={{ fontSize: '0.76rem', color: 'text.primary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
            >
              <MailOutlined style={{ marginRight: 7, color: theme.palette.text.secondary }} />
              {vendor.email}
            </Typography>
          )}
          {vendor.phone && (
            <Typography
              component="a"
              href={`tel:${vendor.phone}`}
              onClick={(event) => event.stopPropagation()}
              sx={{ fontSize: '0.76rem', color: 'text.primary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
            >
              <PhoneOutlined style={{ marginRight: 7, color: theme.palette.text.secondary }} />
              {formatPhoneInput(vendor.phone)}
            </Typography>
          )}
          {!hasContact && (
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 650, color: 'warning.dark' }}>Contact details needed</Typography>
          )}
          <Typography noWrap sx={{ fontSize: '0.69rem', color: 'text.secondary' }}>
            {address || 'Address not added'}
          </Typography>
        </Stack>
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
          {openRequestCount} open request{openRequestCount === 1 ? '' : 's'}
        </Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>
          {vendor.maintenanceRequestCount || 0} requests all time
        </Typography>
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 750 }}>{formatMoney(vendor.totalExpenseAmount)}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>
          {vendor.expenseCount || 0} expense{vendor.expenseCount === 1 ? '' : 's'}
        </Typography>
        <Stack direction="row" spacing={0.55} sx={{ mt: 0.55 }}>
          {vendor.requires1099 && (
            <Chip label="1099" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.64rem' }} />
          )}
          {vendor.licenseNumber && (
            <Chip label="Licensed" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.64rem' }} />
          )}
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Vendor actions">
          <IconButton
            size="small"
            aria-label={`Actions for ${vendor.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onActions(event, vendor);
            }}
          >
            <MoreOutlined />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default function Vendors() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const vendors = useSelector(selectVendors);
  const loading = useSelector(selectVendorLoading);
  const maintenanceRequests = useSelector(selectMaintenanceRequests);
  useFetchMaintenances();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [workloadFilter, setWorkloadFilter] = useState('all');
  const [sortBy, setSortBy] = useState('workload');
  const [page, setPage] = useState(1);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuVendor, setMenuVendor] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeStep, setActiveStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) dispatch(getVendors(user.id, true));
  }, [dispatch, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, categoryFilter, workloadFilter, sortBy]);

  const openRequestCounts = useMemo(() => {
    const counts = new Map();
    const openStatuses = ['reported', 'open', 'acknowledged', 'pending', 'scheduled', 'inprogress', 'in-progress', 'onhold', 'on-hold'];
    (maintenanceRequests || []).forEach((request) => {
      if (
        !request.vendorId ||
        !openStatuses.includes(
          String(request.status || '')
            .toLowerCase()
            .replace(/\s/g, '')
        )
      )
        return;
      counts.set(request.vendorId, (counts.get(request.vendorId) || 0) + 1);
    });
    return counts;
  }, [maintenanceRequests]);

  const categories = useMemo(
    () => [...new Set((vendors || []).map((vendor) => vendor.category?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [vendors]
  );

  const metrics = useMemo(() => {
    const list = vendors || [];
    const active = list.filter((vendor) => vendor.isActive).length;
    const assigned = list.filter((vendor) => (openRequestCounts.get(vendor.id) || 0) > 0).length;
    const needsSetup = list.filter((vendor) => !vendor.email && !vendor.phone).length;
    const spend = list.reduce((total, vendor) => total + Number(vendor.totalExpenseAmount || 0), 0);
    return { active, assigned, needsSetup, spend };
  }, [openRequestCounts, vendors]);

  const filteredVendors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = (vendors || []).filter((vendor) => {
      const searchable = [
        vendor.name,
        vendor.businessName,
        vendor.category,
        vendor.email,
        vendor.phone,
        vendor.city,
        vendor.state,
        vendor.specialties
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const openCount = openRequestCounts.get(vendor.id) || 0;

      if (query && !searchable.includes(query)) return false;
      if (statusFilter === 'active' && !vendor.isActive) return false;
      if (statusFilter === 'inactive' && vendor.isActive) return false;
      if (categoryFilter !== 'all' && vendor.category !== categoryFilter) return false;
      if (workloadFilter === 'assigned' && openCount === 0) return false;
      if (workloadFilter === 'available' && openCount > 0) return false;
      if (workloadFilter === 'contact' && (vendor.email || vendor.phone)) return false;
      if (workloadFilter === '1099' && !vendor.requires1099) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'spend') return Number(b.totalExpenseAmount || 0) - Number(a.totalExpenseAmount || 0);
      if (sortBy === 'recent') return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
      return (
        (openRequestCounts.get(b.id) || 0) - (openRequestCounts.get(a.id) || 0) || String(a.name || '').localeCompare(String(b.name || ''))
      );
    });
  }, [categoryFilter, openRequestCounts, searchTerm, sortBy, statusFilter, vendors, workloadFilter]);

  const pageCount = Math.ceil(filteredVendors.length / PAGE_SIZE);
  const paginatedVendors = filteredVendors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters =
    searchTerm || statusFilter !== 'active' || categoryFilter !== 'all' || workloadFilter !== 'all' || sortBy !== 'workload';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('active');
    setCategoryFilter('all');
    setWorkloadFilter('all');
    setSortBy('workload');
  };

  // Drawer helpers
  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setActiveStep(newStep);
      setTimeout(() => setIsAnimating(false), 400);
    }, 50);
  };

  const handleOpenDrawer = (vendor = null) => {
    setActiveStep(0);
    setSlideDirection('left');
    setIsAnimating(false);
    if (vendor) {
      setSelectedVendor(vendor);
      setFormData({
        name: vendor.name || '',
        businessName: vendor.businessName || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        category: vendor.category || '',
        address: vendor.address || '',
        city: vendor.city || '',
        state: vendor.state || '',
        zipCode: vendor.zipCode || '',
        taxId: vendor.taxId || '',
        licenseNumber: vendor.licenseNumber || '',
        requires1099: vendor.requires1099 || false,
        notes: vendor.notes || ''
      });
    } else {
      setSelectedVendor(null);
      setFormData(EMPTY_FORM);
    }
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedVendor(null);
    setActiveStep(0);
  };

  const handleNext = () => {
    if (activeStep === 0 && !formData.name.trim()) {
      openSnackbar({
        open: true,
        message: 'Vendor name is required',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    if (activeStep < STEPS.length - 1) {
      transitionToStep(activeStep + 1, 'left');
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      transitionToStep(activeStep - 1, 'right');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      openSnackbar({
        open: true,
        message: 'Vendor name is required',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setSaving(true);
    const vendorData = {
      ...(selectedVendor || {}),
      ...formData,
      isActive: selectedVendor?.isActive ?? true,
      landlordId: user.id
    };

    let result;
    if (selectedVendor) {
      result = await dispatch(updateVendor(selectedVendor.id, { ...vendorData, id: selectedVendor.id }));
    } else {
      result = await dispatch(addVendor(vendorData));
    }
    setSaving(false);

    if (result.success) {
      openSnackbar({
        open: true,
        message: selectedVendor ? 'Vendor updated successfully' : 'Vendor created successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      handleCloseDrawer();
      dispatch(getVendors(user.id, true));
    } else {
      openSnackbar({
        open: true,
        message: result.message || 'Failed to save vendor',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedVendor) return;

    const result = await dispatch(deleteVendor(selectedVendor.id, true));
    if (result.success) {
      openSnackbar({
        open: true,
        message: 'Vendor deleted successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setDeleteDialogOpen(false);
      setSelectedVendor(null);
      dispatch(getVendors(user.id, true));
    } else {
      openSnackbar({
        open: true,
        message: result.message || 'Failed to delete vendor',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleVendorActions = (event, vendor) => {
    setMenuAnchor(event.currentTarget);
    setMenuVendor(vendor);
  };

  const closeVendorMenu = () => {
    setMenuAnchor(null);
    setMenuVendor(null);
  };

  const handleToggleActive = async () => {
    if (!menuVendor) return;
    const vendor = menuVendor;
    closeVendorMenu();
    const result = await dispatch(updateVendor(vendor.id, { ...vendor, id: vendor.id, isActive: !vendor.isActive }));
    if (result.success) {
      openSnackbar({
        open: true,
        message: `${vendor.name} ${vendor.isActive ? 'marked inactive' : 'reactivated'}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
      dispatch(getVendors(user.id, true));
    } else {
      openSnackbar({
        open: true,
        message: result.message || 'Failed to update vendor status',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const field = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5
                }}
              >
                <UserOutlined style={{ fontSize: 26, color: theme.palette.primary.main }} />
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Basic Info
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Who is this vendor?
              </Typography>
            </Box>
            <TextField fullWidth label="Vendor Name *" value={formData.name} onChange={(e) => field('name', e.target.value)} autoFocus />
            <TextField
              fullWidth
              label="Business Name"
              value={formData.businessName}
              onChange={(e) => field('businessName', e.target.value)}
              helperText="DBA or company name (if different)"
            />
            <TextField
              fullWidth
              label="Category"
              placeholder="e.g., Plumber, Electrician, HVAC"
              value={formData.category}
              onChange={(e) => field('category', e.target.value)}
            />
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5
                }}
              >
                <ContactsOutlined style={{ fontSize: 26, color: theme.palette.info.main }} />
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Contact Info
              </Typography>
              <Typography variant="body2" color="text.secondary">
                How do you reach this vendor?
              </Typography>
            </Box>
            <TextField fullWidth label="Email" type="email" value={formData.email} onChange={(e) => field('email', e.target.value)} />
            <TextField fullWidth label="Phone" value={formData.phone} onChange={(e) => field('phone', e.target.value)} />
            <TextField fullWidth label="Address" value={formData.address} onChange={(e) => field('address', e.target.value)} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 5 }}>
                <TextField fullWidth label="City" value={formData.city} onChange={(e) => field('city', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 3 }}>
                <TextField fullWidth label="State" value={formData.state} onChange={(e) => field('state', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField fullWidth label="Zip" value={formData.zipCode} onChange={(e) => field('zipCode', e.target.value)} />
              </Grid>
            </Grid>
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5
                }}
              >
                <DollarOutlined style={{ fontSize: 26, color: theme.palette.warning.main }} />
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Financial Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                For tax reporting and compliance
              </Typography>
            </Box>
            <TextField
              fullWidth
              label="Tax ID (EIN/SSN)"
              value={formData.taxId}
              onChange={(e) => field('taxId', e.target.value)}
              helperText="Required for 1099 reporting"
            />
            <TextField
              fullWidth
              label="License Number"
              value={formData.licenseNumber}
              onChange={(e) => field('licenseNumber', e.target.value)}
            />
            <Box
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                px: 2,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Requires 1099
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Vendor must receive a 1099 form
                </Typography>
              </Box>
              <Switch checked={formData.requires1099} onChange={(e) => field('requires1099', e.target.checked)} color="primary" />
            </Box>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => field('notes', e.target.value)}
              placeholder="Any additional notes about this vendor..."
            />
          </Stack>
        );

      case 3: {
        const rows = [
          { label: 'Name', value: formData.name },
          { label: 'Business Name', value: formData.businessName },
          { label: 'Category', value: formData.category },
          { label: 'Email', value: formData.email },
          { label: 'Phone', value: formData.phone },
          {
            label: 'Address',
            value: [formData.address, formData.city, formData.state, formData.zipCode].filter(Boolean).join(', ')
          },
          { label: 'Tax ID', value: formData.taxId },
          { label: 'License Number', value: formData.licenseNumber },
          { label: 'Requires 1099', value: formData.requires1099 ? 'Yes' : 'No' },
          { label: 'Notes', value: formData.notes }
        ].filter((r) => r.value);

        return (
          <Stack spacing={3}>
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 1.5
                }}
              >
                <FileTextOutlined style={{ fontSize: 26, color: theme.palette.success.main }} />
              </Box>
              <Typography variant="h5" fontWeight={700}>
                Review
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Confirm vendor details before saving
              </Typography>
            </Box>
            <Card variant="outlined">
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack divider={<Divider flexItem />} spacing={0}>
                  {rows.map(({ label, value }, i) => (
                    <Box key={i} sx={{ py: 1, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pt: 0.25 }}>
                        {label}
                      </Typography>
                      <Typography variant="body2" fontWeight={500} sx={{ textAlign: 'right', wordBreak: 'break-word' }}>
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <ManagementPageHeader
        title="Vendors"
        description="Keep your contractor network ready, reachable, and connected to the work in progress."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <VendorCsvImportButton
              buttonProps={{
                variant: 'outlined',
                sx: managementPageHeaderActionSx
              }}
            />
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusOutlined />}
              onClick={() => handleOpenDrawer()}
              sx={managementPageHeaderActionSx}
            >
              Add vendor
            </Button>
          </Stack>
        }
      />

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Active network"
            value={metrics.active}
            helper={`${vendors.length - metrics.active} inactive vendor${vendors.length - metrics.active === 1 ? '' : 's'}`}
            icon={<CheckCircleOutlined />}
            color={theme.palette.success.main}
            active={statusFilter === 'active' && workloadFilter === 'all'}
            onClick={() => {
              setStatusFilter('active');
              setWorkloadFilter('all');
            }}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Working now"
            value={metrics.assigned}
            helper="Assigned to open maintenance"
            icon={<ToolOutlined />}
            color={theme.palette.info.main}
            active={workloadFilter === 'assigned'}
            onClick={() => setWorkloadFilter((value) => (value === 'assigned' ? 'all' : 'assigned'))}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Recorded spend"
            value={formatMoney(metrics.spend)}
            helper="Across vendor-linked expenses"
            icon={<DollarOutlined />}
            color={theme.palette.primary.main}
            active={sortBy === 'spend'}
            onClick={() => setSortBy((value) => (value === 'spend' ? 'workload' : 'spend'))}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Needs setup"
            value={metrics.needsSetup}
            helper="Missing phone and email"
            icon={<ExclamationCircleOutlined />}
            color={theme.palette.warning.main}
            active={workloadFilter === 'contact'}
            onClick={() => setWorkloadFilter((value) => (value === 'contact' ? 'all' : 'contact'))}
          />
        </Grid>
      </Grid>

      <Box data-testid="vendor-filters" sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} alignItems={{ md: 'center' }}>
            <OutlinedInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search vendors, categories, contact details, or location"
              size="small"
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              }
              sx={{ flex: 1, minWidth: { md: 280 }, borderRadius: 1.75 }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, md: 0 } }}>
              <Select
                size="small"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 120, borderRadius: 1.75 }}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="all">All status</MenuItem>
              </Select>
              <Select
                size="small"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 150, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All categories</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
              <Select
                size="small"
                value={workloadFilter}
                onChange={(event) => setWorkloadFilter(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 158, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All workload</MenuItem>
                <MenuItem value="assigned">Working now</MenuItem>
                <MenuItem value="available">No open work</MenuItem>
                <MenuItem value="contact">Missing contact</MenuItem>
                <MenuItem value="1099">Requires 1099</MenuItem>
              </Select>
              <Select
                size="small"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 155, borderRadius: 1.75 }}
              >
                <MenuItem value="workload">Sort: Workload</MenuItem>
                <MenuItem value="name">Sort: Name</MenuItem>
                <MenuItem value="spend">Sort: Spend</MenuItem>
                <MenuItem value="recent">Sort: Recently updated</MenuItem>
              </Select>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              {filteredVendors.length} of {vendors.length} vendors
            </Typography>
            {hasFilters && (
              <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>
                Reset view
              </Button>
            )}
          </Stack>
      </Box>

      <Box data-testid="vendor-table" sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.055)}`, overflow: 'hidden' }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: 'minmax(230px, 1.45fr) minmax(190px, 1.1fr) minmax(145px, .8fr) minmax(155px, .85fr) 44px',
            gap: 2,
            px: 2,
            py: 1.15,
            bgcolor: alpha(theme.palette.primary.main, 0.025)
          }}
        >
          {['Vendor', 'Contact', 'Workload', 'Spend & compliance', ''].map((label) => (
            <Typography
              key={label || 'actions'}
              sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}
            >
              {label}
            </Typography>
          ))}
        </Box>

        {loading ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 7 }}>
            <CircularProgress size={26} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading vendor network…</Typography>
          </Stack>
        ) : vendors.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Avatar sx={{ width: 52, height: 52, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
              <ShopOutlined />
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              Build your vendor network
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', maxWidth: 440 }}>
              Add contractors and service providers so maintenance work, contact details, expenses, and tax information stay connected.
            </Typography>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusOutlined />}
              onClick={() => handleOpenDrawer()}
              sx={{ textTransform: 'none' }}
            >
              Add your first vendor
            </Button>
          </Stack>
        ) : filteredVendors.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>
              No vendors match this view
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              Try a different search or reset the vendor filters.
            </Typography>
            <Button variant="outlined" onClick={clearFilters} sx={{ textTransform: 'none' }}>
              Reset filters
            </Button>
          </Stack>
        ) : (
          paginatedVendors.map((vendor) => (
            <VendorRow
              key={vendor.id}
              vendor={vendor}
              openRequestCount={openRequestCounts.get(vendor.id) || 0}
              onEdit={handleOpenDrawer}
              onActions={handleVendorActions}
            />
          ))
        )}

        {pageCount > 1 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredVendors.length)} of {filteredVendors.length}
            </Typography>
            <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeVendorMenu}>
        <MenuItem
          onClick={() => {
            const vendor = menuVendor;
            closeVendorMenu();
            if (vendor) handleOpenDrawer(vendor);
          }}
        >
          <EditOutlined style={{ marginRight: 10 }} />
          Edit vendor
        </MenuItem>
        <MenuItem onClick={handleToggleActive}>
          <CheckCircleOutlined style={{ marginRight: 10 }} />
          {menuVendor?.isActive ? 'Mark inactive' : 'Reactivate vendor'}
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            const vendor = menuVendor;
            closeVendorMenu();
            if (vendor) {
              setSelectedVendor(vendor);
              setDeleteDialogOpen(true);
            }
          }}
        >
          <DeleteOutlined style={{ marginRight: 10 }} />
          Delete vendor
        </MenuItem>
      </Menu>

      {/* Add/Edit Drawer */}
      <ThemeAdaptiveDrawer
        anchor="right"
        open={drawerOpen}
        onClose={handleCloseDrawer}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 480 },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            backgroundImage: 'none'
          }
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            {selectedVendor ? 'Edit Vendor' : 'Add Vendor'}
          </Typography>
          <IconButton size="small" onClick={handleCloseDrawer}>
            <CloseOutlined />
          </IconButton>
        </Box>

        {/* Stepper */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, flexShrink: 0 }}>
          <Stepper activeStep={activeStep} connector={<CustomStepConnector />} alternativeLabel>
            {STEPS.map((label, index) => (
              <Step key={label} completed={index < activeStep}>
                <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.7rem' } }}>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Divider />

        {/* Scrollable step content */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3, position: 'relative' }}>
          <Slide
            direction={slideDirection === 'left' ? 'left' : 'right'}
            in={!isAnimating}
            timeout={350}
            mountOnEnter
            unmountOnExit
            key={activeStep}
          >
            <Box>{renderStepContent()}</Box>
          </Slide>
        </Box>

        {/* Footer nav */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <Button
            onClick={handleBack}
            disabled={activeStep === 0 || saving}
            startIcon={<ArrowLeftOutlined />}
            sx={{ textTransform: 'none', px: 2.5 }}
          >
            Back
          </Button>

          {activeStep === STEPS.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
              sx={{ textTransform: 'none', px: 3 }}
            >
              {saving ? 'Saving...' : selectedVendor ? 'Update Vendor' : 'Add Vendor'}
            </Button>
          ) : (
            <Button variant="contained" onClick={handleNext} disabled={saving} sx={{ textTransform: 'none', px: 3 }}>
              Next
            </Button>
          )}
        </Box>
      </ThemeAdaptiveDrawer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Vendor</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete {selectedVendor?.name}? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
