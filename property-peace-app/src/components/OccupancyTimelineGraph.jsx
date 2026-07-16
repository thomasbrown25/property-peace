import { useMemo } from 'react';
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
  Tooltip,
  Chip
} from '@mui/material';
import { format, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth, addMonths } from 'date-fns';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const OCCUPIED_COLOR = '#4caf50'; // Green — occupied (earning rent)
const VACANT_COLOR = '#faad14'; // Amber — vacant (needs attention)

function rentDueDayLabel(day) {
  if (day == null || day === undefined) return null;
  if (day === -1) return 'Last day of month';
  const n = Number(day);
  if (n < 1 || n > 31) return null;
  const s = n % 10;
  const suffix = n >= 11 && n <= 13 ? 'th' : s === 1 ? 'st' : s === 2 ? 'nd' : s === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/**
 * @param {Object} props
 * @param {Object} props.calendarData - Unit availability calendar from API
 * @param {number} [props.year] - Year for the timeline (used when windowStart/windowMonthCount not provided)
 * @param {boolean} props.loading - Loading state
 * @param {{ start: number, count: number }} [props.monthRange] - Optional slice of months within year (0-based start index, count).
 * @param {Date} [props.windowStart] - Optional start of the window (first day of first month). When provided with windowMonthCount, overrides year/monthRange.
 * @param {number} [props.windowMonthCount] - Number of months to show starting at windowStart (e.g. 12).
 */
function OccupancyTimelineGraph({ calendarData, year, loading, monthRange, windowStart, windowMonthCount, fallbackPropertyName }) {
  const allMonths = useMemo(() => {
    if (windowStart && windowMonthCount > 0) {
      return Array.from({ length: windowMonthCount }, (_, i) => addMonths(windowStart, i));
    }
    if (!year) return [];
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 11, 31));
    return eachMonthOfInterval({ start: yearStart, end: yearEnd });
  }, [year, windowStart, windowMonthCount]);

  const months = useMemo(() => {
    if (windowStart && windowMonthCount > 0) return allMonths;
    if (!monthRange || monthRange.count <= 0) return allMonths;
    const start = Math.max(0, Math.min(monthRange.start, allMonths.length - 1));
    const end = Math.min(start + monthRange.count, allMonths.length);
    return allMonths.slice(start, end);
  }, [allMonths, monthRange, windowStart, windowMonthCount]);

  // Calculate occupancy status for each unit/month combination
  const unitMonthStatus = useMemo(() => {
    if (!calendarData?.units || allMonths.length === 0) return {};

    const statusMap = {};

    calendarData.units.forEach((unit) => {
      const unitKey = `${unit.propertyId}-${unit.unitId}`;
      statusMap[unitKey] = {};

      allMonths.forEach((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        // Check if any lease period overlaps with this month
        let isOccupied = false;
        let leaseInfo = null;

        if (unit.leasePeriods && unit.leasePeriods.length > 0) {
          for (const lease of unit.leasePeriods) {
            const leaseStart = new Date(lease.startDate);
            const leaseEnd = new Date(lease.endDate);

            // Check if lease overlaps with month
            if (
              (leaseStart <= monthEnd && leaseEnd >= monthStart) ||
              (leaseStart >= monthStart && leaseStart <= monthEnd) ||
              (leaseEnd >= monthStart && leaseEnd <= monthEnd)
            ) {
              isOccupied = true;
              const dueDay = lease.rentDueDay ?? lease.RentDueDay;
              leaseInfo = {
                startDate: format(leaseStart, 'MMM d, yyyy'),
                endDate: format(leaseEnd, 'MMM d, yyyy'),
                rentAmount: lease.rentAmount,
                tenantNames: lease.tenantNames,
                isActive: lease.isActive,
                rentDueDay: dueDay != null ? dueDay : undefined
              };
              break;
            }
          }
        }

        // If no lease found, check availability periods; for vacant months get first day available
        let availableFromDate = null;
        if (!isOccupied && unit.availabilityPeriods && unit.availabilityPeriods.length > 0) {
          for (const period of unit.availabilityPeriods) {
            const periodStart = new Date(period.startDate);
            const periodEnd = new Date(period.endDate);

            // Check if period overlaps with month and is not vacant
            if (
              (periodStart <= monthEnd && periodEnd >= monthStart) &&
              !period.isVacant &&
              period.status?.toLowerCase() === 'occupied'
            ) {
              isOccupied = true;
              break;
            }
            // Vacant period overlapping this month: first day available in month = max(monthStart, periodStart)
            if (period.isVacant && periodStart <= monthEnd && periodEnd >= monthStart) {
              const firstInMonth = periodStart <= monthStart ? monthStart : periodStart;
              if (!availableFromDate || firstInMonth < availableFromDate) {
                availableFromDate = firstInMonth;
              }
            }
          }
        }

        statusMap[unitKey][format(month, 'yyyy-MM')] = {
          isOccupied,
          leaseInfo,
          availableFromDate: availableFromDate ? format(availableFromDate, 'MMM d') : null
        };
      });
    });

    return statusMap;
  }, [calendarData, allMonths]);

  // Group units by property for better organization
  const groupedUnits = useMemo(() => {
    if (!calendarData?.units) return [];

    const grouped = {};
    calendarData.units.forEach((unit) => {
      if (!grouped[unit.propertyId]) {
        grouped[unit.propertyId] = {
          propertyId: unit.propertyId,
          propertyName: unit.propertyName,
          units: []
        };
      }
      grouped[unit.propertyId].units.push(unit);
    });

    return Object.values(grouped).sort((a, b) => (a.propertyName || '').localeCompare(b.propertyName || ''));
  }, [calendarData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography>Loading occupancy timeline...</Typography>
      </Box>
    );
  }

  if (!calendarData || !calendarData.units || calendarData.units.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">No units available for timeline view.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Legend */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Typography variant="subtitle2" fontWeight="bold">
          Legend:
        </Typography>
        <Chip
          label="Occupied"
          size="small"
          sx={{
            bgcolor: OCCUPIED_COLOR,
            color: 'white',
            fontWeight: 'medium'
          }}
        />
        <Chip
          label="Vacant"
          size="small"
          sx={{
            bgcolor: VACANT_COLOR,
            color: 'white',
            fontWeight: 'medium'
          }}
        />
      </Box>

      {/* Timeline Table */}
      <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  minWidth: 180,
                  maxWidth: 180,
                  width: 180,
                  fontWeight: 'bold',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  bgcolor: 'background.paper',
                  borderRight: '1px solid',
                  borderColor: 'divider'
                }}
              >
                Property / Unit
              </TableCell>
              {months.map((month) => (
                <TableCell
                  key={format(month, 'yyyy-MM')}
                  align="center"
                  sx={{
                    minWidth: 60,
                    maxWidth: 60,
                    width: 60,
                    fontWeight: 'bold',
                    bgcolor: 'background.paper',
                    px: 0.5
                  }}
                >
                  {format(month, 'MMM yy')}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedUnits.map((propertyGroup, groupIndex) =>
              propertyGroup.units.map((unit, unitIndex) => {
                const unitKey = `${unit.propertyId}-${unit.unitId}`;
                const isFirstUnitInProperty = unitIndex === 0;

                return (
                  <TableRow key={unitKey} hover>
                    <TableCell
                      sx={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 2,
                        bgcolor: 'background.paper',
                        borderRight: '2px solid',
                        borderColor: 'divider',
                        borderTop: isFirstUnitInProperty && groupIndex > 0 ? '2px solid' : undefined,
                        borderTopColor: 'divider',
                        minWidth: 200,
                        maxWidth: 200,
                        width: 200,
                        py: isFirstUnitInProperty ? 1 : 0.75,
                        pl: isFirstUnitInProperty ? 1.5 : 3
                      }}
                    >
                      {isFirstUnitInProperty ? (
                        <Box sx={{ borderLeft: '3px solid', borderColor: 'primary.main', pl: 1 }}>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}
                          >
                            {propertyGroup.propertyName || fallbackPropertyName || 'Unknown Property'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                            {unit.unitName}
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ borderLeft: '3px solid', borderColor: 'divider', pl: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {unit.unitName}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    {months.map((month) => {
                      const monthKey = format(month, 'yyyy-MM');
                      const status = unitMonthStatus[unitKey]?.[monthKey];
                      const isOccupied = status?.isOccupied || false;
                      const leaseInfo = status?.leaseInfo;
                      const availableFromDate = status?.availableFromDate;

                      return (
                        <TableCell
                          key={`${unitKey}-${monthKey}`}
                          align="center"
                          sx={{
                            p: 0.25,
                            bgcolor: isOccupied ? OCCUPIED_COLOR : VACANT_COLOR,
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: leaseInfo ? 'help' : 'default',
                            minWidth: 60,
                            maxWidth: 60,
                            width: 60
                          }}
                        >
                          <Tooltip
                            title={
                              <Box>
                                {leaseInfo ? (
                                  <>
                                    <Typography variant="caption" display="block">
                                      <strong>Occupied:</strong> {leaseInfo.startDate} - {leaseInfo.endDate}
                                    </Typography>
                                    <Typography variant="caption" display="block">
                                      <strong>Rent:</strong> ${leaseInfo.rentAmount?.toLocaleString() || '0'}/mo
                                    </Typography>
                                    {leaseInfo.rentDueDay != null && rentDueDayLabel(leaseInfo.rentDueDay) && (
                                      <Typography variant="caption" display="block">
                                        <strong>Rent due:</strong> {rentDueDayLabel(leaseInfo.rentDueDay)} of each month
                                      </Typography>
                                    )}
                                    <Typography variant="caption" display="block">
                                      <strong>Tenant:</strong> {leaseInfo.tenantNames || 'N/A'}
                                    </Typography>
                                  </>
                                ) : (
                                  <Typography variant="caption">
                                    {isOccupied ? 'Occupied' : availableFromDate ? `Available from ${availableFromDate}` : 'Vacant'}
                                  </Typography>
                                )}
                              </Box>
                            }
                            arrow
                          >
                            <Box
                              sx={{
                                width: '100%',
                                height: 24,
                                borderRadius: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 600,
                                color: 'white'
                              }}
                            >
                              {!isOccupied && availableFromDate ? availableFromDate : null}
                            </Box>
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default OccupancyTimelineGraph;
