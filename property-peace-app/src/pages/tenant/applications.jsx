import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Divider,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton
} from '@mui/material';
import { alpha } from '@mui/system';
import {
  FormOutlined,
  HomeOutlined,
  CalendarOutlined,
  EyeOutlined,
  DownloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import { formatCurrency, formatDate } from 'utils/formatters';
import { applicationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';

// Application Status Options
const APPLICATION_STATUSES = [
  { value: 0, label: 'Draft', color: 'default' },
  { value: 1, label: 'Submitted', color: 'success' },
  { value: 2, label: 'Under Review', color: 'warning' },
  { value: 3, label: 'Approved', color: 'success' },
  { value: 4, label: 'Rejected', color: 'error' },
  { value: 5, label: 'Withdrawn', color: 'default' },
  { value: 6, label: 'On Hold', color: 'warning' },
  { value: 7, label: 'Lease Signed', color: 'success' }
];

// ==============================|| TENANT - APPLICATIONS ||============================== //

export default function TenantApplications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await applicationAPI.getTenantApplications();
      
      if (response.success) {
        setApplications(response.data || []);
      } else {
        setError(response.message || 'Failed to load applications');
      }
      setHasLoaded(true);
    } catch (err) {
      console.error('Error loading applications:', err);
      setError(err?.response?.data?.message || 'Failed to load applications');
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only load if we have user email, otherwise keep loading state
    const userEmail = user?.email || user?.Email;
    if (userEmail) {
      loadApplications();
    }
  }, [user?.email, user?.Email, loadApplications]);

  const getStatusChip = (status) => {
    // Handle both number and string status values
    // API might return status as number (1) or string ("1" or "submitted")
    let statusOption = null;
    
    // Normalize status to number for comparison
    const statusNum = typeof status === 'number' ? status : parseInt(status, 10);
    
    if (!isNaN(statusNum)) {
      statusOption = APPLICATION_STATUSES.find(s => s.value === statusNum);
    } else if (typeof status === 'string') {
      // Try to match by label (case-insensitive)
      const statusLower = status.toLowerCase().replace(/\s+/g, '');
      statusOption = APPLICATION_STATUSES.find(s => 
        s.label.toLowerCase().replace(/\s+/g, '') === statusLower
      );
    }
    
    return (
      <Chip
        label={statusOption?.label || status?.toString()}
        color={statusOption?.color || 'default'}
        size="small"
        sx={{ textTransform: 'capitalize' }}
      />
    );
  };

  const handleViewApplication = (application) => {
    setSelectedApplication(application);
    setViewDialogOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (!selectedApplication?.id) return;

    try {
      setDownloadingPdf(true);
      const blob = await applicationAPI.downloadApplicationPdf(selectedApplication.id);
      
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
      setDownloadingPdf(false);
    }
  };

  // Sort applications by created date (newest first)
  const sortedApplications = useMemo(() => {
    if (!applications || applications.length === 0) return [];
    return [...applications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [applications]);

  // Show loading spinner first, before any content
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          My Applications
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          View and track your rental applications
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Applications List */}
      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : !hasLoaded && sortedApplications.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <CircularProgress />
        </Box>
      ) : sortedApplications.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 5,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
          }}
        >
          <FormOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)', marginBottom: 16 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            No applications found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Applications sent by landlords will appear here
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Property/Unit</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Submitted</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Desired Move-In</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedApplications.map((app) => {
                // Check if application is draft (status 0 or "draft" string)
                // API serializes enums as camelCase strings
                const isDraft = app.status === 0 || 
                               app.status === '0' || 
                               app.status?.toLowerCase() === 'draft';
                
                return (
                  <TableRow key={app.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {app.propertyName || 'N/A'}
                      </Typography>
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
                    <TableCell>
                      {isDraft ? (
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tenant/applications/${app.id}/complete`);
                          }}
                          sx={{ 
                            textTransform: 'none',
                            px: 2
                          }}
                        >
                          Complete Application
                        </Button>
                      ) : (
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewApplication(app);
                            }}
                          >
                            <EyeOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View Application Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Application Details - {selectedApplication?.propertyName || 'N/A'}
        </DialogTitle>
        <DialogContent>
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
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                  <HomeOutlined style={{ fontSize: 14, opacity: 0.7 }} />
                  <Typography variant="body1">{selectedApplication.propertyName || 'N/A'}</Typography>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Unit
                </Typography>
                <Typography variant="body1">{selectedApplication.unitName || 'N/A'}</Typography>
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

              {selectedApplication.desiredMoveInDate && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Desired Move-In Date
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                    <CalendarOutlined style={{ fontSize: 14, opacity: 0.7 }} />
                    <Typography variant="body1">
                      {formatDate(selectedApplication.desiredMoveInDate)}
                    </Typography>
                  </Stack>
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

              {selectedApplication.rejectionReason && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="error" sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 600 }}>
                      Rejection Reason
                    </Typography>
                    <Typography variant="body2">{selectedApplication.rejectionReason}</Typography>
                  </Alert>
                </Grid>
              )}

              {/* PDF Section */}
              {(selectedApplication.pdfBlobName || selectedApplication.status >= 1) && (
                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Application PDF
                  </Typography>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadOutlined />}
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                    >
                      Download PDF
                    </Button>
                  </Stack>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

