import { useState } from 'react';
import {
  Box,
  Typography,
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
  CircularProgress,
  Stack,
  alpha,
  useTheme
} from '@mui/material';
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
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

export default function TimeEntryList({ 
  entries = [], 
  loading = false,
  onView,
  onApprove,
  onReject,
  onEdit,
  onDelete
}) {
  const theme = useTheme();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <ClockCircleOutlined style={{ fontSize: 48, color: theme.palette.text.secondary, opacity: 0.5 }} />
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          No time entries found
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Staff Member</TableCell>
            <TableCell>Property</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Time</TableCell>
            <TableCell>Hours</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id} hover>
              <TableCell>
                <Typography variant="body2">
                  {entry.staffMemberName || 'Unknown'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {entry.propertyName || 'Unknown'}
                </Typography>
                {entry.unitName && (
                  <Typography variant="caption" color="text.secondary">
                    {entry.unitName}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {entry.startTime ? formatDate(entry.startTime) : '-'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {entry.startTime && entry.endTime
                    ? `${new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(entry.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : entry.startTime
                    ? `${new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - Active`
                    : '-'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {formatHours(entry.hoursWorked)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={entry.status || 'Draft'}
                  color={getStatusColor(entry.status)}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                  {onView && (
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => onView(entry.id)}
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08)
                          }
                        }}
                      >
                        <EyeOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
                  {entry.status === 'Submitted' && onApprove && (
                    <Tooltip title="Approve">
                      <IconButton
                        size="small"
                        onClick={() => onApprove(entry.id)}
                        sx={{
                          color: theme.palette.success.main,
                          '&:hover': {
                            bgcolor: alpha(theme.palette.success.main, 0.08)
                          }
                        }}
                      >
                        <CheckOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
                  {entry.status === 'Submitted' && onReject && (
                    <Tooltip title="Reject">
                      <IconButton
                        size="small"
                        onClick={() => onReject(entry.id)}
                        sx={{
                          color: theme.palette.error.main,
                          '&:hover': {
                            bgcolor: alpha(theme.palette.error.main, 0.08)
                          }
                        }}
                      >
                        <CloseOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
                  {entry.status === 'Draft' && onEdit && (
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => onEdit(entry.id)}
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08)
                          }
                        }}
                      >
                        <EditOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
                  {entry.status === 'Draft' && onDelete && (
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => onDelete(entry.id)}
                        sx={{
                          color: theme.palette.error.main,
                          '&:hover': {
                            bgcolor: alpha(theme.palette.error.main, 0.08)
                          }
                        }}
                      >
                        <DeleteOutlined />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
