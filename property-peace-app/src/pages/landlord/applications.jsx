import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  Alert
} from '@mui/material';
import {
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  SendOutlined,
  MoreOutlined,
  SearchOutlined,
  DownOutlined
} from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useAuth from 'hooks/useAuth';
import { formatDate, formatCurrency } from 'utils/formatters';
import { applicationAPI, applicationInviteAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { useDispatch, useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { useDrawer } from 'contexts/DrawerContext';
import ApplicationAddDrawer from 'components/drawers/ApplicationAddDrawer';

// Application Status Options
const APPLICATION_STATUSES = [
  { value: 0, label: 'Draft', color: 'default' },
  { value: 1, label: 'Submitted', color: 'success' },
  { value: 2, label: 'Under Review', color: 'warning' },
  { value: 3, label: 'Approved', color: 'success' },
  { value: 4, label: 'Rejected', color: 'error' },
  { value: 5, label: 'Withdrawn', color: 'default' },
  { value: 6, label: 'On Hold', color: 'warning' },
  { value: 7, label: 'Lease Signed', color: 'success' },
  { value: 8, label: 'Pending', color: 'warning' }
];

const NAVY = '#061e35';

const parseApplicationDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

// Application statuses can arrive from different API endpoints as either numbers or labels.
const normalizeStatus = (status) => {
  if (typeof status === 'string') {
    const statusMap = {
      Draft: 0,
      draft: 0,
      Submitted: 1,
      submitted: 1,
      UnderReview: 2,
      underReview: 2,
      'Under Review': 2,
      'under review': 2,
      Approved: 3,
      approved: 3,
      Rejected: 4,
      rejected: 4,
      Withdrawn: 5,
      withdrawn: 5,
      OnHold: 6,
      onHold: 6,
      'On Hold': 6,
      'on hold': 6,
      LeaseSigned: 7,
      leaseSigned: 7,
      'Lease Signed': 7,
      'lease signed': 7,
      Pending: 8,
      pending: 8
    };
    return statusMap[status] !== undefined ? statusMap[status] : parseInt(status, 10);
  }
  if (status != null) return Number(status);
  return null;
};

function SummaryCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={active}
      aria-label={`${label}: ${value}. Filter applications by this category.`}
      onClick={onClick}
      sx={{ width: '100%', minHeight: 112, p: 2, borderRadius: 2.5, border: `1px solid ${active ? alpha(color, 0.55) : alpha(theme.palette.divider, 0.16)}`, bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055) : 'background.paper', boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha(NAVY, 0.05)}`, color: 'text.primary', textAlign: 'left', cursor: 'pointer', font: 'inherit', transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease', '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.45), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` }, '&:focus-visible': { outline: `3px solid ${alpha(color, 0.28)}`, outlineOffset: 2 } }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 750 }}>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function ApplicationRow({ application, getStatusChip, onView, onStatus, onResend, onDelete }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const name = `${application.firstName || ''} ${application.lastName || ''}`.trim() || 'Unnamed applicant';
  const runAction = (action) => {
    setAnchorEl(null);
    action();
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onView(application);
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: { lg: 'grid' },
        gridTemplateColumns: { lg: 'minmax(0, 1fr) 44px' },
        gap: { lg: 1.5 },
        alignItems: 'center',
        px: { lg: 2 },
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        transition: 'background-color 140ms ease',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) }
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-label={`View application details for ${name}`}
        onClick={() => onView(application)}
        onKeyDown={handleKeyDown}
        sx={{
          display: { xs: 'block', lg: 'grid' },
          gridTemplateColumns: { lg: 'minmax(210px, 1.5fr) minmax(180px, 1.25fr) minmax(120px, .8fr) minmax(125px, .85fr) minmax(125px, .85fr)' },
          gap: { xs: 1.25, lg: 1.5 },
          alignItems: 'center',
          px: { xs: 1.5, lg: 0 },
          py: { xs: 1.5, lg: 1.35 },
          pr: { xs: 6, lg: 0 },
          cursor: 'pointer',
          '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`, outlineOffset: -2 }
        }}
      >
        <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.mode === 'dark' ? 'primary.light' : NAVY, fontSize: '0.78rem', fontWeight: 750 }}>
            {name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}
          </Avatar>
          <Box minWidth={0}>
            <Typography fontWeight={700} noWrap>{name}</Typography>
            <Typography noWrap sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>{application.email || 'No email provided'}</Typography>
          </Box>
        </Stack>
        <Box sx={{ mt: { xs: 1.2, lg: 0 }, pl: { xs: 6.5, lg: 0 } }}>
          <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{application.propertyName || 'Property not assigned'}</Typography>
          <Typography noWrap sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>{application.unitName || 'No unit'}</Typography>
        </Box>
        <Box sx={{ mt: { xs: 1.1, lg: 0 }, pl: { xs: 6.5, lg: 0 } }}>{getStatusChip(application.status)}</Box>
        <Box sx={{ mt: { xs: 1.1, lg: 0 }, pl: { xs: 6.5, lg: 0 } }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{application.submittedAt ? formatDate(application.submittedAt) : 'Not submitted'}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>Submitted</Typography>
        </Box>
        <Box sx={{ mt: { xs: 1.1, lg: 0 }, pl: { xs: 6.5, lg: 0 } }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{application.desiredMoveInDate ? formatDate(application.desiredMoveInDate) : 'Not set'}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>Desired move-in</Typography>
        </Box>
      </Box>
      <Box sx={{ position: { xs: 'absolute', lg: 'static' }, top: { xs: 12 }, right: { xs: 12 }, display: 'flex', justifyContent: 'center' }}>
        <Tooltip title="Application actions">
          <IconButton size="small" aria-label={`Actions for ${name}`} onClick={(event) => setAnchorEl(event.currentTarget)}>
            <MoreOutlined />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => runAction(() => onView(application))}>View details</MenuItem>
          <MenuItem onClick={() => runAction(() => onStatus(application))}>
            <EditOutlined style={{ marginRight: 10 }} />
            Update status
          </MenuItem>
          {normalizeStatus(application.status) === 8 && (
            <MenuItem onClick={() => runAction(() => onResend(application))}>
              <SendOutlined style={{ marginRight: 10 }} />
              Resend invite
            </MenuItem>
          )}
          <MenuItem sx={{ color: 'error.main' }} onClick={() => runAction(() => onDelete(application))}>
            <DeleteOutlined style={{ marginRight: 10 }} />
            Delete
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

export default function ApplicationsPage({ hideHeader = false }) {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  useFetchProperties();
  const drawer = useDrawer();
  const theme = useTheme();

  // Collection view state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusUpdate, setStatusUpdate] = useState({
    status: null,
    rejectionReason: '',
    reviewNotes: ''
  });
  const [backgroundCheckLoading, setBackgroundCheckLoading] = useState(false);
  const [upcomingFeatureDialogOpen, setUpcomingFeatureDialogOpen] = useState(false);
  const previousPropertyId = useRef(selectedProperty?.id ?? null);

  // Reset property selection on mount
  useEffect(() => {
    dispatch(setProperty(null));
    dispatch(setUnit(null));
  }, [dispatch]);

  // PropertySelect does not clear the unit. Only clear it when the property id actually changes,
  // so a unit deliberately selected for the current property remains selected across renders.
  useEffect(() => {
    const propertyId = selectedProperty?.id ?? null;
    if (previousPropertyId.current !== propertyId) {
      previousPropertyId.current = propertyId;
      dispatch(setUnit(null));
    }
  }, [dispatch, selectedProperty?.id]);

  const loadApplications = useCallback(async () => {
    if (!user?.id) {
      // If user is not available yet, keep loading state
      setLoading(true);
      return;
    }
    
    setLoading(true);
    try {
      let response;
      if (selectedProperty?.id) {
        response = await applicationAPI.getApplicationsByProperty(selectedProperty.id);
      } else {
        response = await applicationAPI.getApplicationsByLandlord(user.id);
      }
      
      if (response.success) {
        setApplications(response.data || []);
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to load applications',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
      setHasLoaded(true);
    } catch (error) {
      console.error('Error loading applications:', error);
      openSnackbar({
        open: true,
        message: 'Error loading applications',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedProperty?.id]);

  // Load applications on mount and when property changes
  useEffect(() => {
    if (user?.id) {
      loadApplications();
    }
  }, [loadApplications]);

  // Reload applications when drawer closes (after invite/application is created)
  useEffect(() => {
    if (!drawer.isOpenApplicationAdd && user?.id) {
      // Small delay to ensure backend has processed the request
      const timer = setTimeout(() => {
        loadApplications();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [drawer.isOpenApplicationAdd, user?.id, loadApplications]);

  // Search, unit/status filtering, and sorting are client-side so every control affects the displayed rows.
  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedUnitId = selectedUnit?.id ?? selectedUnit?.Id;
    const selectedUnitName = selectedUnit?.name ?? selectedUnit?.Name ?? selectedUnit?.unitNumber ?? selectedUnit?.UnitNumber;
    const filtered = applications.filter((application) => {
      const status = normalizeStatus(application.status);
      const searchable = [application.firstName, application.lastName, application.email, application.propertyName, application.unitName].filter(Boolean).join(' ').toLowerCase();
      const applicationUnitId = application.unitId ?? application.UnitId;
      if (query && !searchable.includes(query)) return false;
      if (selectedUnitId != null && String(applicationUnitId) !== String(selectedUnitId) && String(application.unitName || '').toLowerCase() !== String(selectedUnitName || '').toLowerCase()) return false;
      if (statusFilter === 'review' && ![8, 1, 2].includes(status)) return false;
      if (statusFilter !== 'all' && statusFilter !== 'review' && status !== Number(statusFilter)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === 'oldest') return (parseApplicationDate(a.createdAt)?.getTime() || 0) - (parseApplicationDate(b.createdAt)?.getTime() || 0);
      if (sort === 'applicant') return `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`);
      if (sort === 'moveIn') return (parseApplicationDate(a.desiredMoveInDate)?.getTime() || Number.MAX_SAFE_INTEGER) - (parseApplicationDate(b.desiredMoveInDate)?.getTime() || Number.MAX_SAFE_INTEGER);
      return (parseApplicationDate(b.createdAt)?.getTime() || 0) - (parseApplicationDate(a.createdAt)?.getTime() || 0);
    });
  }, [applications, search, selectedUnit, sort, statusFilter]);

  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const currentPage = Math.min(page, Math.max(totalPages, 1));
  const paginatedApplications = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredApplications.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredApplications, itemsPerPage]);

  useEffect(() => {
    setPage(1);
  }, [itemsPerPage, search, selectedProperty, selectedUnit, sort, statusFilter]);

  // Data can shrink after a reload, delete, or status update. Keep pagination in range and
  // use currentPage during render so an out-of-range page never flashes an empty result set.
  useEffect(() => {
    setPage((value) => Math.min(value, Math.max(totalPages, 1)));
  }, [totalPages]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setSort('newest');
    dispatch(setProperty(null));
    dispatch(setUnit(null));
  }, [dispatch]);

  // Calculate overview stats
  const overviewStats = useMemo(() => {
    const total = applications.length;
    const pending = applications.filter(a => {
      const status = normalizeStatus(a.status);
      return status === 8 || status === 1 || status === 2; // Pending, Submitted, Under Review
    }).length;
    const approved = applications.filter(a => normalizeStatus(a.status) === 3).length;
    const rejected = applications.filter(a => normalizeStatus(a.status) === 4).length;
    return { total, pending, approved, rejected };
  }, [applications]);

  // Handle view application
  const handleViewApplication = async (application) => {
    setSelectedApplication(application);
    setViewDialogOpen(true);
    
    // Load background check status if available
    if (application.backgroundCheckRequested) {
      await loadBackgroundCheckStatus(application.id);
    }
  };

  // Request background check - show upcoming feature modal
  const handleRequestBackgroundCheck = () => {
    setUpcomingFeatureDialogOpen(true);
  };

  // Load background check status
  const loadBackgroundCheckStatus = async (applicationId) => {
    setBackgroundCheckLoading(true);
    try {
      const response = await applicationAPI.getBackgroundCheckStatus(applicationId);
      if (response.success) {
        const backgroundCheck = response.data || {};
        setSelectedApplication((current) => current?.id === applicationId ? {
          ...current,
          backgroundCheckStatus: backgroundCheck.status,
          backgroundCheckOverallPass: backgroundCheck.overallPass,
          backgroundCheckReportUrl: backgroundCheck.reportUrl,
          backgroundCheckCompletedAt: backgroundCheck.completedAt,
          backgroundCheckRejectionReason: backgroundCheck.rejectionReason,
          creditScore: backgroundCheck.creditScore,
          passedCreditCheck: backgroundCheck.passedCreditCheck,
          passedCriminalCheck: backgroundCheck.passedCriminalCheck,
          passedEvictionCheck: backgroundCheck.passedEvictionCheck,
          passedIncomeVerification: backgroundCheck.passedIncomeVerification
        } : current);
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to refresh background check status',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error loading background check status:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to refresh background check status',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setBackgroundCheckLoading(false);
    }
  };

  // Refresh background check status
  const handleRefreshBackgroundCheck = async () => {
    if (!selectedApplication?.id) return;
    await loadBackgroundCheckStatus(selectedApplication.id);
  };

  // Handle status update
  const handleStatusUpdate = (application) => {
    setSelectedApplication(application);
    setStatusUpdate({
      status: normalizeStatus(application.status),
      rejectionReason: application.rejectionReason || '',
      reviewNotes: application.reviewNotes || ''
    });
    setStatusDialogOpen(true);
  };

  const handleSaveStatusUpdate = async () => {
    if (!selectedApplication?.id || statusUpdate.status === null || statusUpdate.status === '') return;

    try {
      const response = await applicationAPI.updateApplicationStatus(
        selectedApplication.id,
        statusUpdate.status,
        statusUpdate.rejectionReason || null,
        statusUpdate.reviewNotes || null
      );

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Application status updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setStatusDialogOpen(false);
        loadApplications();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to update status',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      openSnackbar({
        open: true,
        message: 'Error updating application status',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Handle direct approval
  const handleApprove = async () => {
    if (!selectedApplication?.id) return;

    try {
      const response = await applicationAPI.updateApplicationStatus(
        selectedApplication.id,
        3, // Approved status
        null,
        null
      );

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Application approved successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setStatusDialogOpen(false);
        loadApplications();
        // Also close the view dialog if open
        setViewDialogOpen(false);
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to approve application',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error approving application:', error);
      openSnackbar({
        open: true,
        message: 'Error approving application',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Handle delete
  const handleDeleteClick = (application) => {
    setApplicationToDelete(application);
    setDeleteDialogOpen(true);
  };

  // Handle resend invite for pending applications
  const handleResendInvite = async (application) => {
    if (!application?.id) return;

    try {
      const response = await applicationInviteAPI.resendApplicationInviteByApplicationId(application.id);
      
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Application invite resent successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to resend invite',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error resending invite:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to resend invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!applicationToDelete?.id) return;

    try {
      const response = await applicationAPI.deleteApplication(applicationToDelete.id);
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Application deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setDeleteDialogOpen(false);
        loadApplications();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to delete application',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error deleting application:', error);
      openSnackbar({
        open: true,
        message: 'Error deleting application',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Handle PDF download
  const handleDownloadPdf = async () => {
    if (!selectedApplication?.id) return;

    try {
      setLoading(true);
      const blob = await applicationAPI.downloadApplicationPdf(selectedApplication.id);
      
      // Create blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Application_${selectedApplication.id}_${selectedApplication.firstName}_${selectedApplication.lastName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      openSnackbar({
        open: true,
        message: 'PDF downloaded successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to download PDF',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle PDF view (open in new tab)
  const handleViewPdf = async () => {
    if (!selectedApplication?.id) return;

    try {
      setLoading(true);
      const blob = await applicationAPI.downloadApplicationPdf(selectedApplication.id);
      
      // Create blob URL and open in new tab
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
      
      // Clean up URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error viewing PDF:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to view PDF',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status) => {
    const statusValue = normalizeStatus(status);
    const statusOption = APPLICATION_STATUSES.find(s => s.value === statusValue);
    return (
      <Chip
        label={statusOption?.label || 'Unknown'}
        color={statusOption?.color || 'default'}
        size="small"
      />
    );
  };

  return (
    <Box sx={{ pb: 3 }}>
      {!hideHeader && (
        <>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Applications' }]} />
          </Box>
          <Box sx={{ mb: 2.5, p: { xs: 2, md: 2.75 }, borderRadius: 3, color: '#fff', background: 'linear-gradient(120deg, #061e35 0%, #0b3558 100%)', boxShadow: `0 16px 38px ${alpha(NAVY, 0.18)}` }}>
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Applications</Typography>
                <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>Review applicants, screening progress, and leasing decisions from one focused workspace.</Typography>
              </Box>
              <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openApplicationAddDrawer()} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none', alignSelf: { xs: 'flex-start', md: 'center' } }}>New application</Button>
            </Stack>
          </Box>
        </>
      )}

      {/* Summary Cards */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="All applications" value={overviewStats.total} helper="Across the selected property" icon={<FileTextOutlined />} color={theme.palette.primary.main} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="Needs review" value={overviewStats.pending} helper="Pending, submitted, or reviewing" icon={<ClockCircleOutlined />} color={theme.palette.warning.main} active={statusFilter === 'review'} onClick={() => setStatusFilter((value) => value === 'review' ? 'all' : 'review')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="Approved" value={overviewStats.approved} helper="Ready for the next leasing step" icon={<CheckCircleOutlined />} color={theme.palette.success.main} active={statusFilter === '3'} onClick={() => setStatusFilter((value) => value === '3' ? 'all' : '3')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><SummaryCard label="Rejected" value={overviewStats.rejected} helper="Applications not moving forward" icon={<CloseCircleOutlined />} color={theme.palette.error.main} active={statusFilter === '4'} onClick={() => setStatusFilter((value) => value === '4' ? 'all' : '4')} /></Grid>
      </Grid>

      <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.055)}`, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} alignItems={{ lg: 'center' }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search applicants, email, property, or unit"
              inputProps={{ 'aria-label': 'Search applications' }}
              size="small"
              startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>}
              sx={{ flex: 1, minWidth: { lg: 245 }, borderRadius: 1.75 }}
            />
            <Stack
              direction="row"
              spacing={1}
              sx={{
                overflowX: 'auto',
                pb: { xs: 0.25, lg: 0 },
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' }
              }}
            >
              {hideHeader && applications.length > 0 && <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openApplicationAddDrawer()} sx={{ minWidth: 155, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>New application</Button>}
              <Box sx={{ minWidth: 180 }}><PropertySelect width="100%" /></Box>
              <Box sx={{ minWidth: 150 }}><UnitSelect width="100%" /></Box>
              <Select
                size="small"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                inputProps={{ 'aria-label': 'Filter applications by status' }}
                IconComponent={DownOutlined}
                sx={{ minWidth: 160, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="review">Needs review</MenuItem>
                {APPLICATION_STATUSES.map((status) => <MenuItem key={status.value} value={String(status.value)}>{status.label}</MenuItem>)}
              </Select>
              <Select
                size="small"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                inputProps={{ 'aria-label': 'Sort applications' }}
                IconComponent={DownOutlined}
                sx={{ minWidth: 170, borderRadius: 1.75 }}
              >
                <MenuItem value="newest">Sort: Newest</MenuItem><MenuItem value="oldest">Sort: Oldest</MenuItem><MenuItem value="applicant">Sort: Applicant A–Z</MenuItem><MenuItem value="moveIn">Sort: Move-in soonest</MenuItem>
              </Select>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>{filteredApplications.length} of {applications.length} applications</Typography>
            {(search || statusFilter !== 'all' || selectedProperty || selectedUnit || sort !== 'newest') && <Button size="small" onClick={resetFilters} sx={{ textTransform: 'none' }}>Reset view</Button>}
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ display: { xs: 'none', lg: 'grid' }, gridTemplateColumns: 'minmax(210px, 1.5fr) minmax(180px, 1.25fr) minmax(120px, .8fr) minmax(125px, .85fr) minmax(125px, .85fr) 44px', gap: 1.5, px: 2, py: 1.15, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
          {['Applicant', 'Property / unit', 'Status', 'Submitted', 'Move-in', ''].map((label) => <Typography key={label || 'actions'} sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>)}
        </Box>
        {loading && !hasLoaded ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 7 }}><CircularProgress size={26} /><Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading applications…</Typography></Stack>
        ) : applications.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}><Avatar sx={{ width: 54, height: 54, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}><FileTextOutlined /></Avatar><Typography variant="h5" fontWeight={700}>Create your first application</Typography><Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', maxWidth: 440 }}>Invite an applicant and track their rental application from submission through a final decision.</Typography><Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openApplicationAddDrawer()} sx={{ textTransform: 'none', fontWeight: 700 }}>New application</Button></Stack>
        ) : filteredApplications.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}><Typography variant="h6" fontWeight={700}>No applications match this view</Typography><Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Try another search or reset the application filters.</Typography><Button variant="outlined" onClick={resetFilters} sx={{ textTransform: 'none' }}>Reset filters</Button></Stack>
        ) : paginatedApplications.map((application) => <ApplicationRow key={application.id} application={application} getStatusChip={getStatusChip} onView={handleViewApplication} onStatus={handleStatusUpdate} onResend={handleResendInvite} onDelete={handleDeleteClick} />)}
        {filteredApplications.length > 0 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredApplications.length)} of {filteredApplications.length}</Typography>
              <Select
                size="small"
                value={itemsPerPage}
                onChange={(event) => setItemsPerPage(Number(event.target.value))}
                inputProps={{ 'aria-label': 'Applications per page' }}
                sx={{ height: 32, minWidth: 70 }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
              </Select>
            </Stack>
            {totalPages > 1 && <Pagination count={totalPages} page={currentPage} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />}
          </Stack>
        )}
      </Box>

      {/* View Application Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Application Details - {selectedApplication?.firstName} {selectedApplication?.lastName}
        </DialogTitle>
        <DialogContent sx={{ pb: 4 }}>
          {selectedApplication && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 1 }}>{getStatusChip(selectedApplication.status)}</Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Property
                </Typography>
                <Typography variant="body1">{selectedApplication.propertyName || 'N/A'}</Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Unit
                </Typography>
                <Typography variant="body1">{selectedApplication.unitName || 'N/A'}</Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1">{selectedApplication.email}</Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Phone
                </Typography>
                <Typography variant="body1">{selectedApplication.phoneNumber || 'N/A'}</Typography>
              </Grid>

              {selectedApplication.monthlyIncome && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Monthly Income
                  </Typography>
                  <Typography variant="body1">
                    {formatCurrency(selectedApplication.monthlyIncome)}
                  </Typography>
                </Grid>
              )}

              {selectedApplication.employerName && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Employer
                  </Typography>
                  <Typography variant="body1">{selectedApplication.employerName}</Typography>
                </Grid>
              )}

              {selectedApplication.numberOfOccupants && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Number of Occupants
                  </Typography>
                  <Typography variant="body1">{selectedApplication.numberOfOccupants}</Typography>
                </Grid>
              )}

              {selectedApplication.hasPets && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Pets
                  </Typography>
                  <Typography variant="body1">
                    {selectedApplication.petDetails || 'Yes (details not provided)'}
                  </Typography>
                </Grid>
              )}

              {selectedApplication.additionalNotes && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Additional Notes
                  </Typography>
                  <Typography variant="body1">{selectedApplication.additionalNotes}</Typography>
                </Grid>
              )}

              {selectedApplication.reviewNotes && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Review Notes
                  </Typography>
                  <Typography variant="body1">{selectedApplication.reviewNotes}</Typography>
                </Grid>
              )}

              {selectedApplication.rejectionReason && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Rejection Reason
                  </Typography>
                  <Typography variant="body1" color="error">
                    {selectedApplication.rejectionReason}
                  </Typography>
                </Grid>
              )}

              {/* Background Check Section */}
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Background Check
                  </Typography>
                  {selectedApplication.backgroundCheckRequested && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ReloadOutlined />}
                      onClick={handleRefreshBackgroundCheck}
                      disabled={backgroundCheckLoading}
                    >
                      Refresh
                    </Button>
                  )}
                </Box>

                {!selectedApplication.backgroundCheckRequested ? (
                  <Card variant="outlined" sx={{ bgcolor: alpha('#1877F2', 0.05) }}>
                    <CardContent>
                      <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                          No background check has been requested for this application.
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<FileTextOutlined />}
                          onClick={handleRequestBackgroundCheck}
                          disabled={backgroundCheckLoading || !selectedApplication.firstName || !selectedApplication.lastName || !selectedApplication.email}
                        >
                          {backgroundCheckLoading ? 'Requesting...' : 'Request Background Check'}
                        </Button>
                        {(!selectedApplication.firstName || !selectedApplication.lastName || !selectedApplication.email) && (
                          <Typography variant="caption" color="error">
                            First name, last name, and email are required to request a background check.
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ) : (
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={2}>
                        {/* Status */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight={500}>
                            Status:
                          </Typography>
                          <Chip
                            label={
                              selectedApplication.backgroundCheckStatus === 'completed'
                                ? 'Completed'
                                : selectedApplication.backgroundCheckStatus === 'in_progress'
                                ? 'In Progress'
                                : selectedApplication.backgroundCheckStatus === 'pending'
                                ? 'Pending'
                                : selectedApplication.backgroundCheckStatus === 'failed'
                                ? 'Failed'
                                : 'Unknown'
                            }
                            color={
                              selectedApplication.backgroundCheckStatus === 'completed'
                                ? 'success'
                                : selectedApplication.backgroundCheckStatus === 'in_progress' || selectedApplication.backgroundCheckStatus === 'pending'
                                ? 'warning'
                                : selectedApplication.backgroundCheckStatus === 'failed'
                                ? 'error'
                                : 'default'
                            }
                            size="small"
                            icon={
                              selectedApplication.backgroundCheckStatus === 'completed' ? (
                                <CheckCircleOutlined />
                              ) : selectedApplication.backgroundCheckStatus === 'in_progress' || selectedApplication.backgroundCheckStatus === 'pending' ? (
                                <ClockCircleOutlined />
                              ) : selectedApplication.backgroundCheckStatus === 'failed' ? (
                                <CloseCircleOutlined />
                              ) : null
                            }
                          />
                        </Box>

                        {/* Results if completed */}
                        {selectedApplication.backgroundCheckStatus === 'completed' && (
                          <>
                            <Divider />
                            <Grid container spacing={2}>
                              {selectedApplication.creditScore !== null && selectedApplication.creditScore !== undefined && (
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Credit Score
                                  </Typography>
                                  <Typography variant="h6">
                                    {selectedApplication.creditScore}
                                  </Typography>
                                </Grid>
                              )}

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Overall Result
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  <Chip
                                    label={selectedApplication.backgroundCheckOverallPass ? 'Passed' : 'Failed'}
                                    color={selectedApplication.backgroundCheckOverallPass ? 'success' : 'error'}
                                    size="small"
                                    icon={selectedApplication.backgroundCheckOverallPass ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                                  />
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Credit Check
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  {selectedApplication.passedCreditCheck !== null && selectedApplication.passedCreditCheck !== undefined ? (
                                    <Chip
                                      label={selectedApplication.passedCreditCheck ? 'Passed' : 'Failed'}
                                      color={selectedApplication.passedCreditCheck ? 'success' : 'error'}
                                      size="small"
                                    />
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">N/A</Typography>
                                  )}
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Criminal Check
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  {selectedApplication.passedCriminalCheck !== null && selectedApplication.passedCriminalCheck !== undefined ? (
                                    <Chip
                                      label={selectedApplication.passedCriminalCheck ? 'Passed' : 'Failed'}
                                      color={selectedApplication.passedCriminalCheck ? 'success' : 'error'}
                                      size="small"
                                    />
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">N/A</Typography>
                                  )}
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Eviction Check
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  {selectedApplication.passedEvictionCheck !== null && selectedApplication.passedEvictionCheck !== undefined ? (
                                    <Chip
                                      label={selectedApplication.passedEvictionCheck ? 'Passed' : 'Failed'}
                                      color={selectedApplication.passedEvictionCheck ? 'success' : 'error'}
                                      size="small"
                                    />
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">N/A</Typography>
                                  )}
                                </Box>
                              </Grid>

                              <Grid size={{ xs: 12, sm: 6 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Income Verification
                                </Typography>
                                <Box sx={{ mt: 0.5 }}>
                                  {selectedApplication.passedIncomeVerification !== null && selectedApplication.passedIncomeVerification !== undefined ? (
                                    <Chip
                                      label={selectedApplication.passedIncomeVerification ? 'Passed' : 'Failed'}
                                      color={selectedApplication.passedIncomeVerification ? 'success' : 'error'}
                                      size="small"
                                    />
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">N/A</Typography>
                                  )}
                                </Box>
                              </Grid>

                              {selectedApplication.backgroundCheckRejectionReason && (
                                <Grid size={{ xs: 12 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Rejection Reason
                                  </Typography>
                                  <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                                    {selectedApplication.backgroundCheckRejectionReason}
                                  </Typography>
                                </Grid>
                              )}

                              {selectedApplication.backgroundCheckReportUrl && (
                                <Grid size={{ xs: 12 }}>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FileTextOutlined />}
                                    href={selectedApplication.backgroundCheckReportUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View Full Report
                                  </Button>
                                </Grid>
                              )}
                            </Grid>
                          </>
                        )}

                        {/* Pending/In Progress */}
                        {(selectedApplication.backgroundCheckStatus === 'pending' || selectedApplication.backgroundCheckStatus === 'in_progress') && (
                          <Box sx={{ textAlign: 'center', py: 2 }}>
                            <CircularProgress size={24} sx={{ mb: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              Background check is {selectedApplication.backgroundCheckStatus === 'pending' ? 'pending' : 'in progress'}. 
                              Results will be available once processing is complete.
                            </Typography>
                          </Box>
                        )}

                        {/* Failed */}
                        {selectedApplication.backgroundCheckStatus === 'failed' && (
                          <Box sx={{ textAlign: 'center', py: 2 }}>
                            <CloseCircleOutlined style={{ fontSize: 48, color: '#f44336', marginBottom: 8 }} />
                            <Typography variant="body2" color="error">
                              Background check failed. Please try again or contact support.
                            </Typography>
                          </Box>
                        )}

                        {/* Provider Info */}
                        {selectedApplication.backgroundCheckProvider && (
                          <Typography variant="caption" color="text.secondary">
                            Provider: {selectedApplication.backgroundCheckProvider}
                            {selectedApplication.backgroundCheckRequestedAt && (
                              <> • Requested: {formatDate(selectedApplication.backgroundCheckRequestedAt)}</>
                            )}
                            {selectedApplication.backgroundCheckCompletedAt && (
                              <> • Completed: {formatDate(selectedApplication.backgroundCheckCompletedAt)}</>
                            )}
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Grid>

            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 }, pt: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ width: '100%', justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}
          >
            {/* PDF Buttons on the left */}
            <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
              {(selectedApplication?.pdfBlobName || (normalizeStatus(selectedApplication?.status) >= 1 && normalizeStatus(selectedApplication?.status) <= 7)) && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<FilePdfOutlined />}
                    onClick={handleViewPdf}
                    disabled={loading}
                    sx={{ flex: { xs: 1, md: 'initial' } }}
                  >
                    View PDF
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadOutlined />}
                    onClick={handleDownloadPdf}
                    disabled={loading}
                    sx={{ flex: { xs: 1, md: 'initial' } }}
                  >
                    Download PDF
                  </Button>
                </>
              )}
            </Stack>

            {/* Action buttons on the right */}
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: 'wrap', justifyContent: 'flex-end', width: { xs: '100%', md: 'auto' } }}
            >
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
              {/* Show resend button for pending applications */}
              {selectedApplication && normalizeStatus(selectedApplication.status) === 8 && (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SendOutlined />}
                  onClick={() => handleResendInvite(selectedApplication)}
                  disabled={!selectedApplication?.id}
                >
                  Resend Invite
                </Button>
              )}
              {/* Only show Approve button if status is Submitted (1) */}
              {selectedApplication && normalizeStatus(selectedApplication.status) === 1 && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleApprove}
                  disabled={!selectedApplication?.id}
                >
                  Approve
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => {
                  setViewDialogOpen(false);
                  handleStatusUpdate(selectedApplication);
                }}
              >
                Update Status
              </Button>
            </Stack>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Update Application Status</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="application-status-label">Status</InputLabel>
              <Select
                labelId="application-status-label"
                value={statusUpdate.status ?? ''}
                onChange={(e) => setStatusUpdate({ ...statusUpdate, status: e.target.value })}
                label="Status"
              >
                {APPLICATION_STATUSES.map((status) => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {statusUpdate.status === 4 && (
              <TextField
                fullWidth
                label="Rejection Reason"
                value={statusUpdate.rejectionReason}
                onChange={(e) =>
                  setStatusUpdate({ ...statusUpdate, rejectionReason: e.target.value })
                }
                multiline
                rows={3}
              />
            )}

            <TextField
              fullWidth
              label="Review Notes (Optional)"
              value={statusUpdate.reviewNotes}
              onChange={(e) => setStatusUpdate({ ...statusUpdate, reviewNotes: e.target.value })}
              multiline
              rows={4}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
          {/* Only show Approve button if status is Submitted (1) */}
          {selectedApplication && normalizeStatus(selectedApplication.status) === 1 && (
            <Button
              variant="contained"
              color="success"
              onClick={handleApprove}
              disabled={!selectedApplication?.id}
            >
              Approve
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSaveStatusUpdate}
            disabled={statusUpdate.status === null}
          >
            Update Status
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Application"
        message={`Are you sure you want to delete the application for ${applicationToDelete?.firstName} ${applicationToDelete?.lastName}? This action cannot be undone.`}
      />

      {/* Upcoming Feature Dialog */}
      <Dialog
        open={upcomingFeatureDialogOpen}
        onClose={() => setUpcomingFeatureDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Background Check - Coming Soon</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              Background check functionality is an upcoming feature that hasn't been implemented yet.
            </Alert>
            <Typography variant="body2" color="text.secondary">
              We're working on integrating background check services to help you screen applicants more efficiently. 
              This feature will be available in a future update.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpcomingFeatureDialogOpen(false)} variant="contained">
            Got it
          </Button>
        </DialogActions>
      </Dialog>

      {/* Application Add Drawer */}
      <ApplicationAddDrawer />
    </Box>
  );
}

