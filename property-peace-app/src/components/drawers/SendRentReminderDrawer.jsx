import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, Stack, Button, IconButton,
  TextField, Checkbox, Chip, CircularProgress,
  alpha, useTheme, InputAdornment
} from '@mui/material';
import {
  CloseOutlined, MailOutlined, SearchOutlined,
  CheckCircleOutlined, CloseCircleOutlined, HomeOutlined
} from '@ant-design/icons';
import PropTypes from 'prop-types';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { formatCurrency } from 'utils/formatters';

const DRAWER_WIDTH = 480;
const SENDABLE_STATUSES = new Set(['active', 'overdue', 'paid', 'notstarted', 'not started']);

function statusChipProps(status) {
  const s = (status || '').toLowerCase();
  if (s === 'overdue') return { label: 'Overdue', color: 'error' };
  if (s === 'paid') return { label: 'Paid', color: 'success' };
  return { label: 'Active', color: 'info' };
}

export default function SendRentReminderDrawer({ open, onClose, rentRecords }) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [failCount, setFailCount] = useState(0);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected(new Set());
      setSending(false);
      setDone(false);
      setSentCount(0);
      setFailCount(0);
    }
  }, [open]);

  const reminderTargets = useMemo(() => {
    return (rentRecords || []).flatMap((record) => {
      const s = (record.status || '').toLowerCase().replace(/\s/g, '');
      if (s === 'archived' || s === 'inactive') return [];

      return (record.tenants || []).map((tenant) => {
        const tenantId = tenant.id || tenant.Id;
        const firstName = tenant.firstname || tenant.Firstname || tenant.firstName || tenant.FirstName || '';
        const lastName = tenant.lastname || tenant.Lastname || tenant.lastName || tenant.LastName || '';
        const email = tenant.email || tenant.Email || '';
        return {
          id: `${record.leaseId || record.id}:${tenantId}`,
          leaseId: record.leaseId || record.id,
          tenantId,
          firstName,
          lastName,
          tenantName: `${firstName} ${lastName}`.trim() || 'Unnamed tenant',
          email,
          hasAccount: !!(tenant.userId || tenant.UserId || tenant.hasAccount),
          record
        };
      }).filter((target) => target.tenantId && target.email);
    });
  }, [rentRecords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reminderTargets;
    return reminderTargets.filter(target => {
      const names = target.tenantName.toLowerCase();
      const email = (target.email || '').toLowerCase();
      const prop = (target.record.propertyName || '').toLowerCase();
      const unit = (target.record.unitName || '').toLowerCase();
      return names.includes(q) || email.includes(q) || prop.includes(q) || unit.includes(q);
    });
  }, [reminderTargets, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(target => selected.has(target.id));
  const someSelected = selected.size > 0 && !allFilteredSelected;

  const toggleAll = () => {
    const next = new Set(selected);
    if (allFilteredSelected) {
      filtered.forEach(target => next.delete(target.id));
    } else {
      filtered.forEach(target => next.add(target.id));
    }
    setSelected(next);
  };

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    let successCount = 0;
    let failCount = 0;
    const selectedTargets = reminderTargets.filter((target) => selected.has(target.id));
    const targetsByLease = selectedTargets.reduce((acc, target) => {
      if (!acc.has(target.leaseId)) acc.set(target.leaseId, []);
      acc.get(target.leaseId).push(target.tenantId);
      return acc;
    }, new Map());

    for (const [leaseId, tenantIds] of targetsByLease.entries()) {
      try {
        const res = await axiosServices.post(`/api/ai-copilot/agents/force-followup/${leaseId}`, { tenantIds });
        const sentForLease = res.data?.sentCount ?? (res.data?.success !== false ? tenantIds.length : 0);
        successCount += sentForLease;
        failCount += Math.max(tenantIds.length - sentForLease, 0);
      } catch {
        failCount += tenantIds.length;
      }
    }
    setSending(false);
    setSentCount(successCount);
    setFailCount(failCount);
    setDone(true);
    if (failCount === 0) {
      openSnackbar({ open: true, message: `${successCount} reminder${successCount !== 1 ? 's' : ''} sent`, variant: 'alert', alert: { color: 'success' } });
    } else if (successCount === 0) {
      openSnackbar({ open: true, message: 'Failed to send reminders', variant: 'alert', alert: { color: 'error' } });
    } else {
      openSnackbar({ open: true, message: `${successCount} sent, ${failCount} failed`, variant: 'alert', alert: { color: 'warning' } });
    }
  };

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: DRAWER_WIDTH },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          maxHeight: '100dvh'
        }
      }}
    >
      {/* Header */}
      <Box sx={{
        px: 3, py: 2,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
      }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: alpha(theme.palette.info.main, 0.1), display: 'flex' }}>
            <MailOutlined style={{ fontSize: 18, color: theme.palette.info.main }} />
          </Box>
          <Typography variant="subtitle1" fontWeight={700}>Send Rent Reminders</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseOutlined style={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {done ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Stack spacing={2} alignItems="center" sx={{ py: 6, px: 3, textAlign: 'center' }}>
            {sentCount === 0 ? (
              <CloseCircleOutlined style={{ fontSize: 56, color: theme.palette.error.main }} />
            ) : (
              <CheckCircleOutlined style={{ fontSize: 56, color: theme.palette.success.main }} />
            )}
            <Typography variant="h6" fontWeight={700}>
              {sentCount === 0 ? 'No Reminders Sent' : 'Reminders Sent!'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {sentCount === 0
                ? failCount > 0
                  ? 'All reminders failed to send. Please try again.'
                  : 'No reminders were sent.'
                : failCount > 0
                  ? `${sentCount} sent, ${failCount} failed.`
                  : `${sentCount} reminder${sentCount !== 1 ? 's' : ''} sent successfully.`}
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
              <Button
                variant="outlined"
                onClick={() => { setDone(false); setSelected(new Set()); setSentCount(0); setFailCount(0); }}
                sx={{ borderRadius: 1.5, textTransform: 'none' }}
              >
                {sentCount === 0 ? 'Try Again' : 'Send More'}
              </Button>
              <Button variant="contained" onClick={onClose} sx={{ borderRadius: 1.5, textTransform: 'none' }}>
                Done
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <>
          {/* Search + select-all bar */}
          <Box sx={{
            px: 3, pt: 2.5, pb: 1.5,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            flexShrink: 0
          }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by tenant, property, or unit…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                  </InputAdornment>
                )
              }}
              sx={{ mb: 1.5 }}
            />
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ cursor: 'pointer' }} onClick={toggleAll}>
                <Checkbox
                  size="small"
                  checked={allFilteredSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  onClick={e => e.stopPropagation()}
                  sx={{ p: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {filtered.length} email-ready tenant{filtered.length !== 1 ? 's' : ''}
              </Typography>
            </Stack>
          </Box>

          {/* Tenant list */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1.5 }}>
            {filtered.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No email-ready tenants found</Typography>
              </Box>
            ) : (
              <Stack spacing={0.75}>
                {filtered.map((target) => {
                  const id = target.id;
                  const { record } = target;
                  const isSelected = selected.has(id);
                  const chip = statusChipProps(record.status);

                  return (
                    <Box
                      key={id}
                      onClick={() => toggle(id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        border: `1px solid ${isSelected ? alpha(theme.palette.info.main, 0.35) : alpha(theme.palette.divider, 0.15)}`,
                        bgcolor: isSelected ? alpha(theme.palette.info.main, 0.04) : 'background.paper',
                        transition: 'all 0.12s ease',
                        '&:hover': { bgcolor: isSelected ? alpha(theme.palette.info.main, 0.07) : alpha(theme.palette.action.hover, 0.06) }
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => toggle(id)}
                        onClick={e => e.stopPropagation()}
                        sx={{ p: 0, flexShrink: 0 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2" fontWeight={600} noWrap>{target.tenantName}</Typography>
                          <Chip
                            label={chip.label}
                            color={chip.color}
                            size="small"
                            sx={{ height: 18, fontSize: '0.62rem', flexShrink: 0, '& .MuiChip-label': { px: 0.75 } }}
                          />
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                          <HomeOutlined style={{ fontSize: 11, color: theme.palette.text.disabled }} />
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {record.propertyName || '—'}{record.unitName ? ` · ${record.unitName}` : ''}
                          </Typography>
                        </Stack>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                          <MailOutlined style={{ fontSize: 11, color: theme.palette.text.disabled }} />
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {target.email}{target.hasAccount ? ' · in-app + email' : ' · email only'}
                          </Typography>
                        </Stack>
                        {record.rentAmount != null && (
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                            {formatCurrency(record.rentAmount)}/mo
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>

          {/* Footer */}
          <Box sx={{
            px: 3,
            pt: 2,
            pb: { xs: 'calc(16px + env(safe-area-inset-bottom, 0px))', sm: 2 },
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
          }}>
            <Button onClick={onClose} disabled={sending} sx={{ borderRadius: 1.5, textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="info"
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
              startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <MailOutlined />}
              sx={{ borderRadius: 1.5, textTransform: 'none' }}
            >
              {sending ? 'Sending…' : `Send${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </Button>
          </Box>
        </>
      )}
    </ThemeAdaptiveDrawer>
  );
}

SendRentReminderDrawer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  rentRecords: PropTypes.array
};
