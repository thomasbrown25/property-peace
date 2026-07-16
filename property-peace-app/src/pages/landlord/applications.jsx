import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import {
  PlusOutlined,
  HomeOutlined,
  UserOutlined,
  CalendarOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  SendOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
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

function TabPanel({ value, index, children }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ mt: 3 }}>
      {value === index && children}
    </Box>
  );
}

export default function ApplicationsPage({ hideHeader = false }) {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const { properties } = useFetchProperties();
  const drawer = useDrawer();
  const theme = useTheme();

  // State
  const [tab, setTab] = useState(0); // 0: All, 1: Pending, 2: Submitted, 3: Under Review, 4: Approved, 5: Rejected
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationToDelete, setApplicationToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusUpdate, setStatusUpdate] = useState({
    status: null,
    rejectionReason: '',
    reviewNotes: ''
  });
  const [backgroundCheckLoading, setBackgroundCheckLoading] = useState(false);
  const [backgroundCheckResult, setBackgroundCheckResult] = useState(null);
  const [upcomingFeatureDialogOpen, setUpcomingFeatureDialogOpen] = useState(false);

  // Reset property selection on mount
  useEffect(() => {
    dispatch(setProperty(null));
    dispatch(setUnit(null));
  }, [dispatch]);

  // Helper function to normalize status to number - must be defined before useMemo
  const normalizeStatus = (status) => {
    if (typeof status === 'string') {
      const statusMap = {
        'Draft': 0, 'draft': 0,
        'Submitted': 1, 'submitted': 1,
        'UnderReview': 2, 'underReview': 2,
        'Approved': 3, 'approved': 3,
        'Rejected': 4, 'rejected': 4,
        'Withdrawn': 5, 'withdrawn': 5,
        'OnHold': 6, 'onHold': 6,
        'LeaseSigned': 7, 'leaseSigned': 7,
        'Pending': 8, 'pending': 8
      };
      return statusMap[status] !== undefined ? statusMap[status] : parseInt(status, 10);
    } else if (status != null) {
      return Number(status);
    }
    return null;
  };

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

  // Filter applications by tab
  const filteredApplications = useMemo(() => {
    let filtered = [...applications];
    
    // Filter by tab status
    if (tab === 1) filtered = filtered.filter(a => normalizeStatus(a.status) === 8); // Pending
    else if (tab === 2) filtered = filtered.filter(a => normalizeStatus(a.status) === 1); // Submitted
    else if (tab === 3) filtered = filtered.filter(a => normalizeStatus(a.status) === 2); // Under Review
    else if (tab === 4) filtered = filtered.filter(a => normalizeStatus(a.status) === 3); // Approved
    else if (tab === 5) filtered = filtered.filter(a => normalizeStatus(a.status) === 4); // Rejected
    
    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [applications, tab]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const paginatedApplications = useMemo(() => {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredApplications.slice(startIndex, endIndex);
  }, [filteredApplications, page, itemsPerPage]);

  // Reset to first page when items per page changes
  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

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
    setBackgroundCheckResult(null);
    
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
    try {
      const response = await applicationAPI.getBackgroundCheckStatus(applicationId);
      if (response.success) {
        setBackgroundCheckResult(response.data);
      }
    } catch (error) {
      console.error('Error loading background check status:', error);
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
      status: application.status,
      rejectionReason: application.rejectionReason || '',
      reviewNotes: application.reviewNotes || ''
    });
    setStatusDialogOpen(true);
  };

  const handleSaveStatusUpdate = async () => {
    if (!selectedApplication?.id || !statusUpdate.status) return;

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
    <Box>
      {/* Header */}
      {!hideHeader && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h3" sx={{ mb: 0.5 }}>
              Rental Applications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and review rental applications
            </Typography>
          </Box>
        </Box>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <FileTextOutlined style={{ fontSize: 24, color: '#1877F2' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    Total Applications
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    {overviewStats.total}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <ClockCircleOutlined style={{ fontSize: 24, color: '#ed6c02' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    Pending Review
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    {overviewStats.pending}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlined style={{ fontSize: 24, color: '#2e7d32' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    Approved
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    {overviewStats.approved}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CloseCircleOutlined style={{ fontSize: 24, color: '#d32f2f' }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    Rejected
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                    {overviewStats.rejected}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Property Filter */}
      <MainCard
        sx={{
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'column', md: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'stretch', md: 'center' },
            justifyContent: { xs: 'flex-start', sm: 'flex-start', md: 'space-between' }
          }}
        >
          {/* Top (mobile) / Left (desktop): Add Button */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
              onClick={() => {
                drawer.openApplicationAddDrawer();
              }}
              sx={{
                textTransform: 'none',
                flexShrink: 0,
                width: { xs: '100%', sm: '100%', md: 'auto' }
              }}
            >
              New Application
            </Button>
          </Box>
          {/* Bottom (mobile) / Right (desktop): PropertySelect and UnitSelect */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'column', md: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'stretch', md: 'center' }, flexWrap: 'wrap', flex: 1, width: { xs: '100%', sm: '100%', md: 'auto' } }}>
            <Box sx={{ width: { xs: '100%', sm: '100%', md: 'auto' } }}>
              <PropertySelect width={{ xs: '100%', sm: '100%', md: 250 }} />
            </Box>
            {selectedProperty && (selectedProperty.propertyType?.toLowerCase() === 'multiunit' || 
                                 selectedProperty.propertyType?.toLowerCase() === 'multifamily') && (
              <Box sx={{ width: { xs: '100%', sm: '100%', md: 'auto' } }}>
                <UnitSelect width={{ xs: '100%', sm: '100%', md: 250 }} />
              </Box>
            )}
          </Box>
        </Box>
      </MainCard>

      {/* Tabs */}
      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2
        }}
      >
        <Tabs value={tab} onChange={(e, newValue) => setTab(newValue)}>
          <Tab label="All" />
          <Tab label="Pending" />
          <Tab label="Submitted" />
          <Tab label="Under Review" />
          <Tab label="Approved" />
          <Tab label="Rejected" />
        </Tabs>

        <Divider />

        {/* Applications Table */}
        {loading && !hasLoaded ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : filteredApplications.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <FileTextOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)', marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              No applications found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {applications.length === 0
                ? "Start by creating a new application using the 'New Application' button"
                : 'No applications match the selected filters'}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Applicant</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Property/Unit</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Submitted</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Desired Move-In</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedApplications.map((app) => (
                  <TableRow key={app.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {app.firstName} {app.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {app.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{app.propertyName || 'N/A'}</Typography>
                      {app.unitName && (
                        <Typography variant="caption" color="text.secondary">
                          {app.unitName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{getStatusChip(app.status)}</TableCell>
                    <TableCell>
                      {app.submittedAt ? formatDate(app.submittedAt) : 'Not submitted'}
                    </TableCell>
                    <TableCell>
                      {app.desiredMoveInDate ? formatDate(app.desiredMoveInDate) : 'N/A'}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        {normalizeStatus(app.status) === 8 && (
                          <Tooltip title="Resend Invite Email">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleResendInvite(app)}
                              sx={{ 
                                color: 'success.main',
                                '&:hover': { 
                                  backgroundColor: 'success.lighter',
                                  color: 'success.dark'
                                }
                              }}
                            >
                              <SendOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewApplication(app)}>
                            <EyeOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Update Status">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleStatusUpdate(app)}
                          >
                            <EditOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(app)}
                          >
                            <DeleteOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {filteredApplications.length > 0 && (
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
      </MainCard>

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
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* PDF Buttons on the left */}
            <Stack direction="row" spacing={2}>
              {(selectedApplication?.pdfBlobName || (selectedApplication?.status >= 1 && selectedApplication?.status !== undefined)) && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={<FilePdfOutlined />}
                    onClick={handleViewPdf}
                    disabled={loading}
                  >
                    View PDF
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadOutlined />}
                    onClick={handleDownloadPdf}
                    disabled={loading}
                  >
                    Download PDF
                  </Button>
                </>
              )}
            </Stack>

            {/* Action buttons on the right */}
            <Stack direction="row" spacing={2}>
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
              <InputLabel>Status</InputLabel>
              <Select
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

