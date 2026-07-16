import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
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
  Drawer,
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
  FileTextOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatPhoneInput } from 'utils/formatters';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { VendorCsvImportButton } from 'components/import/CsvImportButtons';
import { useDispatch, useSelector } from 'react-redux';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import {
  getVendors,
  addVendor,
  updateVendor,
  deleteVendor
} from 'store/vendor/vendor.action';
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

export default function Vendors() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const vendors = useSelector(selectVendors);
  const loading = useSelector(selectVendorLoading);
  const maintenanceRequests = useSelector(selectMaintenanceRequests);
  useFetchMaintenances();

  const [activeFilter, setActiveFilter] = useState('total');
  const [searchTerm, setSearchTerm] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeStep, setActiveStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState('left');
  const [isAnimating, setIsAnimating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      dispatch(getVendors(user.id, false));
    }
  }, [dispatch, user?.id]);

  const totalVendors = vendors?.length || 0;
  const activeVendors = useMemo(() => vendors?.filter((v) => v.isActive).length || 0, [vendors]);
  const assignedVendorIds = useMemo(() => {
    if (!maintenanceRequests) return new Set();
    const openStatuses = ['open', 'inprogress', 'in-progress', 'pending', 'onhold', 'on-hold'];
    return new Set(
      maintenanceRequests
        .filter((r) => openStatuses.includes(r.status?.toLowerCase() || '') && r.vendorId)
        .map((r) => r.vendorId)
    );
  }, [maintenanceRequests]);

  const assignedToOpen = useMemo(
    () => vendors?.filter((v) => assignedVendorIds.has(v.id)).length || 0,
    [vendors, assignedVendorIds]
  );

  const filteredVendors = useMemo(() => {
    let filtered = vendors || [];

    if (activeFilter === 'active') {
      filtered = filtered.filter((v) => v.isActive);
    } else if (activeFilter === 'assigned') {
      filtered = filtered.filter((v) => assignedVendorIds.has(v.id));
    } else if (activeFilter === 'contact') {
      filtered = filtered.filter((v) => !v.email && !v.phone);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.name?.toLowerCase().includes(searchLower) ||
          v.email?.toLowerCase().includes(searchLower) ||
          v.phone?.includes(searchTerm) ||
          v.category?.toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, searchTerm, activeFilter, assignedVendorIds]);

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
    const vendorData = { ...formData, landlordId: user.id };

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
      dispatch(getVendors(user.id, false));
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
      dispatch(getVendors(user.id, false));
    } else {
      openSnackbar({
        open: true,
        message: result.message || 'Failed to delete vendor',
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
              <Typography variant="h5" fontWeight={700}>Basic Info</Typography>
              <Typography variant="body2" color="text.secondary">Who is this vendor?</Typography>
            </Box>
            <TextField
              fullWidth
              label="Vendor Name *"
              value={formData.name}
              onChange={(e) => field('name', e.target.value)}
              autoFocus
            />
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
              <Typography variant="h5" fontWeight={700}>Contact Info</Typography>
              <Typography variant="body2" color="text.secondary">How do you reach this vendor?</Typography>
            </Box>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => field('email', e.target.value)}
            />
            <TextField
              fullWidth
              label="Phone"
              value={formData.phone}
              onChange={(e) => field('phone', e.target.value)}
            />
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => field('address', e.target.value)}
            />
            <Grid container spacing={2}>
              <Grid size={{ xs: 5 }}>
                <TextField
                  fullWidth
                  label="City"
                  value={formData.city}
                  onChange={(e) => field('city', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 3 }}>
                <TextField
                  fullWidth
                  label="State"
                  value={formData.state}
                  onChange={(e) => field('state', e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="Zip"
                  value={formData.zipCode}
                  onChange={(e) => field('zipCode', e.target.value)}
                />
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
              <Typography variant="h5" fontWeight={700}>Financial Details</Typography>
              <Typography variant="body2" color="text.secondary">For tax reporting and compliance</Typography>
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
                <Typography variant="body2" fontWeight={600}>Requires 1099</Typography>
                <Typography variant="caption" color="text.secondary">
                  Vendor must receive a 1099 form
                </Typography>
              </Box>
              <Switch
                checked={formData.requires1099}
                onChange={(e) => field('requires1099', e.target.checked)}
                color="primary"
              />
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
              <Typography variant="h5" fontWeight={700}>Review</Typography>
              <Typography variant="body2" color="text.secondary">Confirm vendor details before saving</Typography>
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

  const inactiveVendors = Math.max(totalVendors - activeVendors, 0);
  const missingContact = useMemo(
    () => vendors?.filter((vendor) => !vendor.email && !vendor.phone).length || 0,
    [vendors]
  );
  const categoryCount = useMemo(() => {
    const categories = new Set();
    (vendors || []).forEach((vendor) => {
      (vendor.category || '')
        .split(',')
        .map((category) => category.trim())
        .filter(Boolean)
        .forEach((category) => categories.add(category.toLowerCase()));
    });
    return categories.size;
  }, [vendors]);

  const overviewItems = [
    { key: 'total', label: 'TOTAL VENDORS', value: totalVendors, helper: `${categoryCount} service categories` },
    { key: 'active', label: 'ACTIVE', value: activeVendors, helper: `${inactiveVendors} inactive vendors` },
    { key: 'assigned', label: 'OPEN ASSIGNMENTS', value: assignedToOpen, helper: 'Vendors tied to open maintenance' },
    { key: 'contact', label: 'NEED CONTACT INFO', value: missingContact, helper: 'Missing email and phone' }
  ];

  const sidebarRows = [
    { label: 'Active vendors', value: activeVendors },
    { label: 'Inactive vendors', value: inactiveVendors },
    { label: 'Assigned to open requests', value: assignedToOpen },
    { label: 'Missing contact info', value: missingContact }
  ];

  return (
    <Box>
      <Box sx={{ mb: 2.5 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Vendors' }
          ]}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="h3" fontWeight={700}>
              Vendors
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage trusted contractors, contact details, tax info, and maintenance assignments.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            <VendorCsvImportButton buttonProps={{ sx: { borderRadius: 1.25, textTransform: 'none' } }} />
            <Button
              size="small"
              variant="contained"
              startIcon={<PlusOutlined />}
              onClick={() => handleOpenDrawer()}
              sx={{ borderRadius: 1.25, textTransform: 'none' }}
            >
              Add Vendor
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {overviewItems.map((item) => {
          const isActive = activeFilter === item.key;
          return (
            <Grid key={item.key} size={{ xs: 12, sm: 6, lg: 3 }} sx={{ display: 'flex' }}>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => setActiveFilter(activeFilter === item.key ? 'total' : item.key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveFilter(activeFilter === item.key ? 'total' : item.key);
                  }
                }}
                sx={(t) => {
                  const isDark = t.palette.mode === 'dark';
                  return {
                    flex: '1 1 160px',
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: isActive ? 'primary.main' : isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(0,0,0,0.15)',
                    bgcolor: isActive ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'primary.lighter') : 'background.paper',
                    backgroundImage: isDark ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.78) 0%, rgba(15, 23, 42, 0.9) 100%)' : 'none',
                    boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                    '&:hover': {
                      borderColor: isDark ? 'rgba(96, 165, 250, 0.65)' : 'primary.main',
                      transform: 'translateY(-1px)',
                      boxShadow: isDark ? '0 18px 40px rgba(2, 8, 23, 0.34), inset 0 1px 0 rgba(255,255,255,0.07)' : 'none'
                    }
                  };
                }}
              >
                <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', mb: 0.5 }}>
                  {item.label}
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary' }}>
                  {item.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {item.helper}
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          mb: 2.5
        }}
      >
        <TextField
          size="small"
          placeholder="Search vendors..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined style={{ fontSize: 14, opacity: 0.55 }} />
              </InputAdornment>
            )
          }}
          sx={{
            width: { xs: '100%', sm: 320 },
            bgcolor: 'background.paper',
            '& .MuiOutlinedInput-root': { height: 34, fontSize: '0.8rem', borderRadius: 1.25 }
          }}
        />
        <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
          <Chip size="small" label={`${filteredVendors.length} shown`} variant="outlined" sx={{ bgcolor: 'background.paper' }} />
          {activeFilter !== 'total' && (
            <Button size="small" variant="text" onClick={() => setActiveFilter('total')} sx={{ textTransform: 'none' }}>
              Clear filter
            </Button>
          )}
        </Stack>
      </Box>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 9 }}>
          {loading ? (
            <MainCard boxShadow border={false} shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`} sx={{ border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, borderRadius: 1.5 }}>
              <Box textAlign="center" py={5}>
                <CircularProgress size={24} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Loading vendors...
                </Typography>
              </Box>
            </MainCard>
          ) : filteredVendors.length === 0 ? (
            <MainCard boxShadow border={false} shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`} sx={{ border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, borderRadius: 1.5 }}>
              <Box textAlign="center" py={5}>
                <ShopOutlined style={{ fontSize: 42, color: theme.palette.text.disabled, marginBottom: 8 }} />
                <Typography variant="h6" color="text.primary">
                  {vendors.length === 0 ? 'No vendors yet' : 'No vendors match your search'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {vendors.length === 0 ? 'Add your first trusted contractor or service provider.' : 'Try a different name, category, email, or phone number.'}
                </Typography>
              </Box>
            </MainCard>
          ) : (
            <TableContainer
              sx={{
                width: '100%',
                bgcolor: 'background.paper',
                border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`,
                borderRadius: 1.5,
                overflow: 'hidden',
                boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`
              }}
            >
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow
                    sx={{
                      '& .MuiTableCell-head': {
                        bgcolor: alpha(theme.palette.grey[500], 0.06),
                        color: 'text.secondary',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        py: 1.25
                      }
                    }}
                  >
                    <TableCell>Vendor</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Spend</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow key={vendor.id} hover sx={{ '&:last-of-type td': { borderBottom: 0 }, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.025) } }}>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {vendor.name}
                        </Typography>
                        {vendor.businessName && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {vendor.businessName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.category ? (
                          <Chip label={vendor.category} size="small" variant="outlined" sx={{ height: 22 }} />
                        ) : (
                          <Typography variant="caption" color="text.secondary">No category</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.35}>
                          {vendor.email ? (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <MailOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
                              <Typography variant="caption">{vendor.email}</Typography>
                            </Stack>
                          ) : null}
                          {vendor.phone ? (
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <PhoneOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
                              <Typography variant="caption">{formatPhoneInput(vendor.phone)}</Typography>
                            </Stack>
                          ) : null}
                          {!vendor.email && !vendor.phone && (
                            <Typography variant="caption" color="text.secondary">No contact info</Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 220 }}>
                          {[vendor.address, vendor.city, vendor.state, vendor.zipCode].filter(Boolean).join(', ') || 'No address'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          ${(vendor.totalExpenseAmount || 0).toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {vendor.expenseCount || 0} expenses
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={vendor.isActive ? 'Active' : 'Inactive'}
                          color={vendor.isActive ? 'success' : 'default'}
                          size="small"
                          variant={vendor.isActive ? 'filled' : 'outlined'}
                          sx={{ height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenDrawer(vendor)} color="primary">
                          <EditOutlined />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedVendor(vendor);
                            setDeleteDialogOpen(true);
                          }}
                          color="error"
                        >
                          <DeleteOutlined />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Stack spacing={2}>
            <MainCard
              title="Vendor coverage"
              content={false}
              sx={{ border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, borderRadius: 1.5, boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}` }}
            >
              <Stack divider={<Divider />}>
                {sidebarRows.map((row) => (
                  <Box key={row.label} sx={{ px: 2, py: 1.4, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {row.label}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {row.value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </MainCard>

            <MainCard
              title="Vendor workflow"
              content={false}
              sx={{ border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, borderRadius: 1.5, boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}` }}
            >
              <Stack divider={<Divider />}>
                {[
                  'Keep phone and email filled in for fast maintenance routing.',
                  'Use categories so the right contractor is easy to find.',
                  'Track 1099 and license details before year-end.'
                ].map((item, index) => (
                  <Box key={item} sx={{ px: 2, py: 1.4 }}>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                        {item}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </MainCard>
          </Stack>
        </Grid>
      </Grid>

      {/* Add/Edit Drawer */}
      <Drawer
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
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={saving}
              sx={{ textTransform: 'none', px: 3 }}
            >
              Next
            </Button>
          )}
        </Box>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Vendor</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedVendor?.name}? This action cannot be undone.
          </Typography>
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
