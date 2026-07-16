import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import TimeBreakForm from 'components/time-tracking/TimeBreakForm';
import ApprovalWorkflow from 'components/time-tracking/ApprovalWorkflow';
import { timeEntryAPI, timeBreakAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { formatDate } from 'utils/formatters';

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'draft':
      return 'default';
    case 'submitted':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    case 'invoiced':
      return 'info';
    default:
      return 'default';
  }
};

const formatHours = (hours) => {
  if (!hours) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export default function TimeEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [timeEntry, setTimeEntry] = useState(null);
  const [breaks, setBreaks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [breakFormOpen, setBreakFormOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [selectedBreak, setSelectedBreak] = useState(null);
  const [deleteBreakDialogOpen, setDeleteBreakDialogOpen] = useState(false);
  const [breakToDelete, setBreakToDelete] = useState(null);

  useEffect(() => {
    fetchTimeEntry();
  }, [id]);

  const fetchTimeEntry = async () => {
    try {
      setLoading(true);
      const response = await timeEntryAPI.getTimeEntry(id);
      if (response?.data?.success && response?.data?.data) {
        setTimeEntry(response.data.data);
        // Fetch breaks for this time entry
        const breaksResponse = await timeBreakAPI.getTimeBreaks(id);
        if (breaksResponse?.data?.success && breaksResponse?.data?.data) {
          setBreaks(breaksResponse.data.data);
        }
      } else {
        openSnackbar({
          open: true,
          message: 'Time entry not found',
          variant: 'alert',
          alert: { color: 'error' }
        });
        navigate('/landlord/time-tracking');
      }
    } catch (error) {
      console.error('Error fetching time entry:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to load time entry',
        variant: 'alert',
        alert: { color: 'error' }
      });
      navigate('/landlord/time-tracking');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!timeEntry) return;
    try {
      const response = await timeEntryAPI.submitTimeEntry(timeEntry.id);
      if (response?.data?.success) {
        openSnackbar({
          open: true,
          message: 'Time entry submitted for approval',
          variant: 'alert',
          alert: { color: 'success' }
        });
        fetchTimeEntry();
      } else {
        throw new Error(response?.data?.message || 'Failed to submit time entry');
      }
    } catch (error) {
      console.error('Error submitting time entry:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to submit time entry',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleDelete = async () => {
    if (!timeEntry) return;
    if (!window.confirm('Are you sure you want to delete this time entry?')) return;

    try {
      const response = await timeEntryAPI.deleteTimeEntry(timeEntry.id);
      if (response?.data?.success) {
        openSnackbar({
          open: true,
          message: 'Time entry deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        navigate('/landlord/time-tracking');
      } else {
        throw new Error(response?.data?.message || 'Failed to delete time entry');
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete time entry',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleBreakSuccess = () => {
    fetchTimeEntry();
    setSelectedBreak(null);
  };

  const handleDeleteBreak = async () => {
    if (!breakToDelete) return;
    try {
      const response = await timeBreakAPI.deleteTimeBreak(breakToDelete.id);
      if (response?.data?.success) {
        openSnackbar({
          open: true,
          message: 'Break deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        fetchTimeEntry();
        setDeleteBreakDialogOpen(false);
        setBreakToDelete(null);
      } else {
        throw new Error(response?.data?.message || 'Failed to delete break');
      }
    } catch (error) {
      console.error('Error deleting break:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete break',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const totalBreakHours = breaks.reduce((sum, b) => sum + (b.durationHours || 0), 0);

  if (loading) {
    return (
      <MainCard>
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
        </Box>
      </MainCard>
    );
  }

  if (!timeEntry) {
    return (
      <MainCard>
        <Typography>Time entry not found</Typography>
      </MainCard>
    );
  }

  return (
    <>
      <MainCard>
        <Stack spacing={3}>
          {/* Header */}
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton onClick={() => navigate('/landlord/time-tracking')}>
              <ArrowLeftOutlined />
            </IconButton>
            <Box flex={1}>
              <Typography variant="h3">Time Entry Details</Typography>
              <Typography variant="body2" color="text.secondary">
                {timeEntry.staffMemberName || 'Unknown Staff'}
              </Typography>
            </Box>
            <Chip
              label={timeEntry.status || 'Draft'}
              color={getStatusColor(timeEntry.status)}
              variant="outlined"
            />
            {timeEntry.status === 'Draft' && (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<EditOutlined />}
                  onClick={() => navigate(`/landlord/time-tracking?edit=${timeEntry.id}`)}
                >
                  Edit
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                >
                  Submit for Approval
                </Button>
                <IconButton
                  color="error"
                  onClick={handleDelete}
                >
                  <DeleteOutlined />
                </IconButton>
              </Stack>
            )}
            {timeEntry.status === 'Submitted' && (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CloseOutlined />}
                  onClick={() => setApprovalOpen(true)}
                >
                  Reject
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckOutlined />}
                  onClick={() => setApprovalOpen(true)}
                >
                  Approve
                </Button>
              </Stack>
            )}
          </Stack>

          <Divider />

          {/* Details */}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Staff Member
                      </Typography>
                      <Typography variant="body1">
                        {timeEntry.staffMemberName || 'Unknown'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Property
                      </Typography>
                      <Typography variant="body1">
                        {timeEntry.propertyName || 'Unknown'}
                      </Typography>
                      {timeEntry.unitName && (
                        <Typography variant="body2" color="text.secondary">
                          Unit: {timeEntry.unitName}
                        </Typography>
                      )}
                    </Box>
                    {timeEntry.maintenanceRequestTitle && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Maintenance Request
                        </Typography>
                        <Typography variant="body1">
                          {timeEntry.maintenanceRequestTitle}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Date
                      </Typography>
                      <Typography variant="body1">
                        {timeEntry.startTime ? formatDate(timeEntry.startTime) : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Time Range
                      </Typography>
                      <Typography variant="body1">
                        {timeEntry.startTime && timeEntry.endTime
                          ? `${new Date(timeEntry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(timeEntry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : timeEntry.startTime
                          ? `${new Date(timeEntry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Active`
                          : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Hours Worked
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {formatHours(timeEntry.hoursWorked)}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Billable
                      </Typography>
                      <Chip
                        label={timeEntry.isBillable ? 'Yes' : 'No'}
                        size="small"
                        color={timeEntry.isBillable ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={12}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Description
                      </Typography>
                      <Typography variant="body1">
                        {timeEntry.description || '-'}
                      </Typography>
                    </Box>
                    {timeEntry.notes && (
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Notes
                        </Typography>
                        <Typography variant="body1">
                          {timeEntry.notes}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Breaks Section */}
            <Grid size={12}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6">Breaks</Typography>
                      {timeEntry.status === 'Draft' && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<PlusOutlined />}
                          onClick={() => {
                            setSelectedBreak(null);
                            setBreakFormOpen(true);
                          }}
                        >
                          Add Break
                        </Button>
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Total Break Time: {formatHours(totalBreakHours)}
                    </Typography>
                    {breaks.length > 0 ? (
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Type</TableCell>
                              <TableCell>Start Time</TableCell>
                              <TableCell>End Time</TableCell>
                              <TableCell>Duration</TableCell>
                              {timeEntry.status === 'Draft' && <TableCell align="right">Actions</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {breaks.map((breakItem) => (
                              <TableRow key={breakItem.id}>
                                <TableCell>{breakItem.breakType}</TableCell>
                                <TableCell>
                                  {breakItem.startTime
                                    ? `${formatDate(breakItem.startTime)} ${new Date(breakItem.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  {breakItem.endTime
                                    ? `${formatDate(breakItem.endTime)} ${new Date(breakItem.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : '-'}
                                </TableCell>
                                <TableCell>{formatHours(breakItem.durationHours)}</TableCell>
                                {timeEntry.status === 'Draft' && (
                                  <TableCell align="right">
                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          setSelectedBreak(breakItem);
                                          setBreakFormOpen(true);
                                        }}
                                      >
                                        <EditOutlined />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => {
                                          setBreakToDelete(breakItem);
                                          setDeleteBreakDialogOpen(true);
                                        }}
                                      >
                                        <DeleteOutlined />
                                      </IconButton>
                                    </Stack>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Box textAlign="center" py={2}>
                        <ClockCircleOutlined style={{ fontSize: 32, opacity: 0.3 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          No breaks recorded
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Approval Info */}
            {timeEntry.approvedBy && (
              <Grid size={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Approved By
                      </Typography>
                      <Typography variant="body1">
                        {timeEntry.approvedByName || 'Unknown'}
                      </Typography>
                      {timeEntry.approvedAt && (
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(timeEntry.approvedAt)}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Stack>
      </MainCard>

      <TimeBreakForm
        open={breakFormOpen}
        onClose={() => {
          setBreakFormOpen(false);
          setSelectedBreak(null);
        }}
        timeEntryId={parseInt(id)}
        initialValues={selectedBreak}
        onSuccess={handleBreakSuccess}
      />

      <ApprovalWorkflow
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        timeEntry={timeEntry}
        onSuccess={fetchTimeEntry}
      />

      <Dialog open={deleteBreakDialogOpen} onClose={() => setDeleteBreakDialogOpen(false)}>
        <DialogTitle>Delete Break</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this break?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteBreakDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteBreak} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
