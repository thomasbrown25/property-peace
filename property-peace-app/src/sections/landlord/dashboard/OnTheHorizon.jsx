import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { alpha, Box, Button, Divider, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { format, addDays, startOfDay, isSameDay, addMonths, isToday } from 'date-fns';
import { selectProperties } from 'store/property/property.selector';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import { selectTasks } from 'store/task/task.selector';

const NAVY_BLUE = '#061e35';

const CATEGORY_COLORS = {
  RentPayment: '#1877F2',
  Maintenance:  '#ef4444',
  Lease:        '#8b5cf6',
  MoveIn:       '#f59e0b',
  Task:         '#22c55e',
};

function buildUpcomingEvents(properties, dashboardSummary, tasks) {
  const now   = startOfDay(new Date());
  const limit = addDays(now, 30);
  const events = [];

  // Rent due dates
  (properties || []).forEach(p => {
    (p.units || []).forEach(u => {
      const unitStatus = (u.status || u.Status || '').toLowerCase();
      if (unitStatus === 'draft') return;
      const lease = u.lease || u.Lease;
      if (!lease) return;
      const leaseStatus = (lease.status || lease.Status || '').toLowerCase();
      if (leaseStatus === 'draft') return;
      if (!lease?.isActive && !lease?.IsActive) return;
      // Skip leases with no start date — these are incomplete/draft leases
      const startD = lease.startDate || lease.StartDate;
      if (!startD) return;
      const rentDay = lease.rentDueDay || lease.RentDueDay || 1;
      const endD    = lease.endDate    || lease.EndDate;
      let cursor = new Date(now.getFullYear(), now.getMonth(), rentDay);
      if (cursor < now) cursor = addMonths(cursor, 1);
      while (cursor <= limit) {
        if (!endD || cursor <= new Date(endD)) {
          const tenants = lease.tenants || lease.Tenants || [];
          const count = tenants.length || 1;
          events.push({
            date: cursor,
            title: `Rent due · ${p.name || p.streetAddress || 'Property'}`,
            sub: `${count} lease${count !== 1 ? 's' : ''} · auto-reminders armed`,
            category: 'RentPayment',
          });
        }
        cursor = addMonths(cursor, 1);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), rentDay);
      }
    });
  });

  // Lease endings / renewals + move-in dates
  (properties || []).forEach(p => {
    (p.units || []).forEach(u => {
      const lease = u.lease || u.Lease;
      if (!lease) return;
      const startD = lease.startDate || lease.StartDate;
      const endD   = lease.endDate   || lease.EndDate;

      if (startD) {
        const moveIn = new Date(startD);
        if (moveIn >= now && moveIn <= limit) {
          events.push({
            date: moveIn,
            title: `Lease start · ${p.name || p.streetAddress || 'Unit'}`,
            sub: 'Tenant move-in date',
            category: 'MoveIn',
          });
        }
      }

      if (!endD) return;
      const endDate = new Date(endD);
      const renewDate = addDays(endDate, -90);

      if (renewDate >= now && renewDate <= limit) {
        events.push({
          date: renewDate,
          title: `Lease renewal · ${u.name || p.name || 'Unit'}`,
          sub: '90 days notice · suggest renewal terms',
          category: 'Lease',
        });
      }
      if (endDate >= now && endDate <= limit) {
        events.push({
          date: endDate,
          title: `Move-out · ${u.name || p.name || 'Unit'}`,
          sub: 'Lease expiration / move-out date',
          category: 'Lease',
        });
      }
    });
  });

  // Scheduled maintenance only — tickets with an explicit ScheduledDate set
  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];
  allRequests
    .filter(r => {
      const scheduled = r.scheduledDate || r.ScheduledDate;
      if (!scheduled) return false;
      const d = new Date(scheduled);
      return d >= now && d <= limit;
    })
    .forEach(r => {
      const d = new Date(r.scheduledDate || r.ScheduledDate);
      events.push({
        date: d,
        title: r.title || r.Title || 'Scheduled maintenance',
        sub: `${r.propertyName || r.PropertyName || 'Property'} · ${(r.priority || '').toLowerCase()} priority`,
        category: 'Maintenance',
      });
    });

  // Tasks
  (tasks || []).forEach(t => {
    const raw = t.dueDate || t.DueDate;
    if (!raw) return;
    const d = new Date(raw);
    if (d >= now && d <= limit) {
      events.push({
        date: d,
        title: t.title || t.Title,
        sub: t.propertyName ? `${t.propertyName}` : 'Task',
        category: 'Task',
      });
    }
  });

  return events
    .sort((a, b) => a.date - b.date)
    .slice(0, 2);
}

export default function OnTheHorizon() {
  const theme    = useTheme();
  const navigate = useNavigate();
  const today    = startOfDay(new Date());

  const [selectedDay, setSelectedDay] = useState(null);

  const properties      = useSelector(selectProperties);
  const dashboardSummary = useSelector(selectDashboardSummary);
  const tasks           = useSelector(selectTasks);

  const upcomingEvents = useMemo(
    () => buildUpcomingEvents(properties, dashboardSummary, tasks),
    [properties, dashboardSummary, tasks]
  );

  const visibleEvents = useMemo(() => {
    if (!selectedDay) return upcomingEvents;
    return upcomingEvents.filter(ev => isSameDay(ev.date, selectedDay));
  }, [upcomingEvents, selectedDay]);

  const handleDayClick = (date) => {
    if (isToday(date)) {
      setSelectedDay(null);
      return;
    }
    setSelectedDay(prev => (prev && isSameDay(prev, date) ? null : date));
  };

  // 7-day strip
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const hasEvent = upcomingEvents.some(ev => isSameDay(ev.date, d));
    return {
      date:    d,
      dayName: format(d, 'EEE').toUpperCase(),
      dayNum:  format(d, 'd'),
      isToday: i === 0,
      isSelected: selectedDay && isSameDay(selectedDay, d),
      hasDot:  hasEvent,
      dotColor: (() => {
        const ev = upcomingEvents.find(ev => isSameDay(ev.date, d));
        return ev ? CATEGORY_COLORS[ev.category] : theme.palette.primary.main;
      })(),
    };
  });

  return (
    <MainCard
      accentColor={theme.palette.primary.main}
      accentShadow
      title={
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2, color: 'text.primary' }}>
            On the horizon
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem', lineHeight: 1.3 }}>
            Upcoming · next 30 days
          </Typography>
        </Box>
      }
      secondary={
        <Button
          size="small"
          variant="text"
          endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          onClick={() => navigate('/landlord/calendar')}
          sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary', whiteSpace: 'nowrap', '&:hover': { color: 'text.primary' } }}
        >
          Calendar
        </Button>
      }
      contentSX={{ pt: 1 }}
      sx={{ height: '100%', '& .MuiCardHeader-root': { pb: 1 } }}
    >
      {/* Week strip */}
      <Stack
        direction="row"
        spacing={0.5}
        sx={{ mb: 2, pb: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}` }}
      >
        {days.map((d, i) => (
          <Box
            key={i}
            onClick={() => handleDayClick(d.date)}
            sx={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              py: 0.75, borderRadius: 1.5,
              bgcolor: d.isToday || d.isSelected ? NAVY_BLUE : theme.palette.grey[200],
              outline: 'none',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: d.isToday || d.isSelected ? NAVY_BLUE : alpha(theme.palette.primary.main, 0.12),
              }
            }}
          >
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: d.isToday || d.isSelected ? 'background.paper' : 'text.disabled', letterSpacing: 0.3, lineHeight: 1.5 }}>
              {d.dayName}
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.875rem', color: d.isToday || d.isSelected ? 'background.paper' : 'text.primary', lineHeight: 1.3 }}>
              {d.dayNum}
            </Typography>
            {d.hasDot && (
              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: d.isToday || d.isSelected ? 'background.paper' : d.dotColor, mt: 0.25 }} />
            )}
          </Box>
        ))}
      </Stack>

      {/* Event list — minHeight locks to 2-item height so card never shrinks */}
      <Box sx={{ minHeight: 123 }}>
      {visibleEvents.length > 0 ? (
        <Stack divider={<Box sx={{ borderBottom: (t) => `1px solid ${alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.9 : 0.6)}` }} />}>
          {visibleEvents.map((ev, idx) => {
            const isEvToday = isToday(ev.date);
            const month = format(ev.date, 'MMM').toUpperCase();
            const day   = format(ev.date, 'd');
            const dotColor = NAVY_BLUE;

            return (
              <Stack key={idx} direction="row" spacing={1.5} sx={{ py: 1.25, alignItems: 'flex-start' }}>
                {/* Date chip */}
                <Box sx={{ minWidth: 44, flexShrink: 0, pt: 0.25, display: 'flex', justifyContent: 'center' }}>
                  {isEvToday ? (
                    <Box sx={{ width: 40, py: 0.5, borderRadius: 1.5, bgcolor: theme.palette.grey[200], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '0.65rem', letterSpacing: 0.4, fontWeight: 700, color: theme.palette.primary.main, textTransform: 'uppercase' }}>
                        TODAY
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ width: 40, py: 0.5, borderRadius: 1.5, bgcolor: theme.palette.grey[200], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ fontSize: '0.55rem', fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary', lineHeight: 1.2, textTransform: 'uppercase' }}>
                        {month}
                      </Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
                        {day}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Content */}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.15 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem', lineHeight: 1.3 }}>
                      {ev.title}
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', pl: 1.5 }}>
                    {ev.sub}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
          {selectedDay ? `No events on ${format(selectedDay, 'MMMM d')}` : 'Nothing coming up in the next 30 days'}
        </Typography>
      )}
      </Box>
    </MainCard>
  );
}
