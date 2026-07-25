import { useState } from 'react';
import {
  Box, Typography, Stack, Button, Drawer, IconButton, alpha, useTheme, TextField
} from '@mui/material';
import {
  CloseOutlined, CalendarOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameDay, isSameMonth, isToday, isBefore, startOfDay
} from 'date-fns';
import { useDrawer } from 'contexts/DrawerContext';
import { useNavigate } from 'react-router-dom';
import { openSnackbar } from 'api/snackbar';

const DRAWER_WIDTH = 400;

export default function ScheduleInspectionDrawer() {
  const drawer = useDrawer();
  const navigate = useNavigate();
  const theme = useTheme();

  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const monthStart = startOfMonth(calMonth);
  const monthEnd   = endOfMonth(calMonth);
  const gridStart  = startOfWeek(monthStart);
  const gridEnd    = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const today = startOfDay(new Date());

  const handleClose = () => {
    drawer.closeScheduleInspectionDrawer();
    setSelectedDate(null);
    setSelectedTime('09:00');
    setNotes('');
    setCalMonth(new Date());
  };

  const handleSchedule = () => {
    if (!selectedDate) {
      openSnackbar({ open: true, message: 'Please select a date', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    const propertyId = drawer.scheduleInspectionPropertyId;
    handleClose();
    navigate(propertyId ? `/landlord/checklists/property/${propertyId}?type=move-in` : '/landlord/checklists');
  };

  return (
    <Drawer
      anchor="right"
      open={drawer.isOpenScheduleInspection}
      onClose={handleClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: DRAWER_WIDTH }, display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' } }}
    >
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex' }}>
            <CalendarOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="subtitle1" fontWeight={700}>Schedule Inspection</Typography>
        </Stack>
        <IconButton size="small" onClick={handleClose} sx={{ color: 'text.secondary' }}>
          <CloseOutlined style={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        <Stack spacing={3}>

          {/* Calendar */}
          <Box sx={{ bgcolor: '#fff', borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.15)}`, overflow: 'hidden', p: 2 }}>
            {/* Month nav */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.primary' }}>
                {format(calMonth, 'MMMM yyyy')}
              </Typography>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" onClick={() => setCalMonth(m => subMonths(m, 1))}
                  sx={{ p: 0.5, color: 'text.secondary', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) } }}>
                  <Typography sx={{ fontSize: '1.1rem', lineHeight: 1, fontWeight: 300 }}>‹</Typography>
                </IconButton>
                <IconButton size="small" onClick={() => setCalMonth(m => addMonths(m, 1))}
                  sx={{ p: 0.5, color: 'text.secondary', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) } }}>
                  <Typography sx={{ fontSize: '1.1rem', lineHeight: 1, fontWeight: 300 }}>›</Typography>
                </IconButton>
              </Stack>
            </Stack>

            {/* Day headers */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', mb: 0.5 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <Typography key={i} sx={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', py: 0.5 }}>{d}</Typography>
              ))}
            </Box>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {week.map((day, di) => {
                  const isPast = isBefore(day, today);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurMonth = isSameMonth(day, calMonth);
                  const isTodayDay = isToday(day);
                  return (
                    <Box
                      key={di}
                      onClick={() => !isPast && setSelectedDate(day)}
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: 36, borderRadius: 1, cursor: isPast ? 'default' : 'pointer', mx: 0.1, my: 0.1,
                        bgcolor: isSelected ? theme.palette.primary.main : isTodayDay ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        '&:hover': !isPast && !isSelected ? { bgcolor: alpha(theme.palette.primary.main, 0.08) } : {}
                      }}
                    >
                      <Typography sx={{
                        fontSize: '0.82rem',
                        fontWeight: isSelected || isTodayDay ? 700 : 400,
                        color: isSelected ? '#fff' : !isCurMonth || isPast ? 'text.disabled' : isTodayDay ? 'primary.main' : 'text.primary',
                        lineHeight: 1
                      }}>
                        {format(day, 'd')}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>

          {/* Selected date display */}
          {selectedDate && (
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.06), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
              <Typography variant="body2" fontWeight={600} color="primary.main">
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </Typography>
            </Box>
          )}

          {/* Time picker */}
          <TextField
            label="Time"
            type="time"
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
            fullWidth
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{  }}
          />

          {/* Notes */}
          <TextField
            label="Notes (optional)"
            multiline
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            fullWidth
            size="small"
            placeholder="Add any notes or instructions for the inspection..."
            sx={{  }}
          />
        </Stack>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, display: 'flex', gap: 1.5, flexShrink: 0 }}>
        <Button variant="outlined" onClick={handleClose} fullWidth sx={{ borderRadius: 1.5, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSchedule}
          fullWidth
          disabled={!selectedDate}
          endIcon={<ArrowRightOutlined style={{ fontSize: 13 }} />}
          sx={{ borderRadius: 1.5, textTransform: 'none' }}
        >
          Start Inspection
        </Button>
      </Box>
    </Drawer>
  );
}
