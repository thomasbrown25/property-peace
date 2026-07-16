import { Box, Card, CardContent, Typography, Stack, Chip, IconButton, Tooltip, alpha, useTheme } from '@mui/material';
import { EyeOutlined, CheckOutlined, CloseOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons';
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

export default function TimeEntryCard({ 
  entry, 
  onView,
  onApprove,
  onReject,
  onEdit,
  onDelete
}) {
  const theme = useTheme();

  return (
    <Card
      variant="outlined"
      sx={{
        '&:hover': {
          boxShadow: theme.shadows[4],
          borderColor: theme.palette.primary.main
        },
        transition: 'all 0.2s ease-in-out',
        cursor: onView ? 'pointer' : 'default'
      }}
      onClick={onView ? () => onView(entry.id) : undefined}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6" noWrap>
                {entry.staffMemberName || 'Unknown Staff'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {entry.propertyName || 'Unknown Property'}
                {entry.unitName && ` • ${entry.unitName}`}
              </Typography>
            </Box>
            <Chip
              label={entry.status || 'Draft'}
              color={getStatusColor(entry.status)}
              size="small"
              variant="outlined"
            />
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ClockCircleOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
              <Typography variant="body2" fontWeight="medium">
                {formatHours(entry.hoursWorked)}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {entry.startTime ? formatDate(entry.startTime) : '-'}
            </Typography>
          </Stack>

          {entry.description && (
            <Typography variant="body2" color="text.secondary" sx={{ 
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {entry.description}
            </Typography>
          )}

          <Stack direction="row" spacing={0.5} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
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
        </Stack>
      </CardContent>
    </Card>
  );
}
