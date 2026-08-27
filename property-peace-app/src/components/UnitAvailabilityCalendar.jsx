import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

const COLORS = {
  occupied: '#41a541',
  vacant: '#faad14',
  expired: '#ff4d4f',
  upcoming: '#1890ff'
};

function UnitAvailabilityCalendar({ calendarData, loading }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const getDayStatus = (unit, date) => {
    if (!unit.availabilityPeriods || unit.availabilityPeriods.length === 0) {
      return null;
    }

    const dayDate = date.getTime();
    const period = unit.availabilityPeriods.find(
      (p) => dayDate >= new Date(p.startDate).getTime() && dayDate <= new Date(p.endDate).getTime()
    );

    if (!period) return null;

    return {
      status: period.status,
      isVacant: period.isVacant
    };
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'occupied':
        return COLORS.occupied;
      case 'vacant':
        return COLORS.vacant;
      case 'expired':
        return COLORS.expired;
      case 'upcoming':
        return COLORS.upcoming;
      default:
        return '#d9d9d9';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography>Loading calendar...</Typography>
      </Box>
    );
  }

  if (!calendarData || !calendarData.units || calendarData.units.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">No units available for calendar view.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Month Navigation */}
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton onClick={handlePreviousMonth} size="small">
            <ChevronLeft />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </Typography>
          <IconButton onClick={handleNextMonth} size="small">
            <ChevronRight />
          </IconButton>
        </Stack>

        {/* Legend */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label="Occupied" size="small" sx={{ bgcolor: COLORS.occupied, color: 'white' }} />
          <Chip label="Vacant" size="small" sx={{ bgcolor: COLORS.vacant, color: 'white' }} />
          <Chip label="Expired" size="small" sx={{ bgcolor: COLORS.expired, color: 'white' }} />
        </Stack>
      </Stack>

      {/* Calendar Table */}
      <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 200, fontWeight: 'bold' }}>Unit</TableCell>
              {daysInMonth.map((day) => (
                <TableCell
                  key={day.toISOString()}
                  align="center"
                  sx={{
                    minWidth: 40,
                    p: 0.5,
                    fontWeight: isSameDay(day, new Date()) ? 'bold' : 'normal',
                    bgcolor: isSameDay(day, new Date()) ? 'action.selected' : 'transparent'
                  }}
                >
                  <Typography variant="caption">{format(day, 'd')}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {calendarData.units.map((unit) => (
              <TableRow key={`${unit.propertyId}-${unit.unitId}`} hover>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {unit.unitName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {unit.propertyName}
                    </Typography>
                  </Box>
                </TableCell>
                {daysInMonth.map((day) => {
                  const dayStatus = getDayStatus(unit, day);
                  const statusColor = getStatusColor(dayStatus?.status);

                  return (
                    <TableCell
                      key={`${unit.unitId}-${day.toISOString()}`}
                      align="center"
                      sx={{
                        p: 0.5,
                        bgcolor: dayStatus ? statusColor : 'transparent',
                        opacity: dayStatus ? 0.7 : 0.3,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <Tooltip
                        title={
                          dayStatus
                            ? `${dayStatus.status} - ${format(day, 'MMM d, yyyy')}`
                            : 'No data'
                        }
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: 24,
                            borderRadius: 0.5,
                            cursor: 'help'
                          }}
                        />
                      </Tooltip>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Unit Details */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
          Unit Details
        </Typography>
        <Stack spacing={1}>
          {calendarData.units.map((unit) => (
            <Paper key={`${unit.propertyId}-${unit.unitId}`} sx={{ p: 1.5 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                {unit.unitName} - {unit.propertyName}
              </Typography>
              {unit.leasePeriods && unit.leasePeriods.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Active Leases:
                  </Typography>
                  {unit.leasePeriods
                    .filter((lease) => lease.isActive)
                    .map((lease) => (
                      <Chip
                        key={lease.leaseId}
                        label={`${format(new Date(lease.startDate), 'MMM d')} - ${format(
                          new Date(lease.endDate),
                          'MMM d, yyyy'
                        )} | $${lease.rentAmount.toLocaleString()}/mo | ${lease.tenantNames || 'No tenants'}`}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                </Box>
              )}
            </Paper>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

export default UnitAvailabilityCalendar;

