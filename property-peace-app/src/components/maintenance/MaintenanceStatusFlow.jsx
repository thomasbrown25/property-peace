import React from 'react';
import { Box, ButtonBase, Paper, Stack, Typography, alpha } from '@mui/material';
import { MAINTENANCE_STATUS_FLOW, normalizeWorkflowToken } from 'utils/maintenanceWorkflow';

const NAVY = '#061e35';

export default function MaintenanceStatusFlow({ currentStatus, onChange, disabled = false }) {
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="maintenance-status-heading"
      sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, boxShadow: `0 4px 18px ${alpha(NAVY, 0.045)}` }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="overline" color="text.secondary" fontWeight={800}>STATUS</Typography>
          <Typography id="maintenance-status-heading" variant="h5" fontWeight={850}>Maintenance progress</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">Select a status to update this request</Typography>
      </Stack>

      <Box sx={{ overflowX: 'auto', pb: 0.5 }}>
        <Stack direction="row" role="list" alignItems="flex-start" sx={{ minWidth: 780 }}>
          {MAINTENANCE_STATUS_FLOW.map((status, index) => {
            const currentIndex = MAINTENANCE_STATUS_FLOW.findIndex(
              (item) => normalizeWorkflowToken(item.value) === normalizeWorkflowToken(currentStatus)
            );
            const isCurrent = normalizeWorkflowToken(currentStatus) === normalizeWorkflowToken(status.value);
            const isPast = currentIndex >= 0 && index < currentIndex;
            const isCancelled = status.value === 'Cancelled';
            return (
              <Box key={status.value} role="listitem" sx={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 78 }}>
                <ButtonBase
                  type="button"
                  aria-current={isCurrent ? 'step' : undefined}
                  disabled={disabled || isCurrent}
                  onClick={() => onChange(status.value)}
                  sx={{
                    flexDirection: 'column', gap: 0.75, width: '100%', minHeight: 62, borderRadius: 1.5, p: 0.5,
                    color: isCurrent ? 'common.white' : isCancelled ? 'error.main' : 'text.primary',
                    bgcolor: isCurrent ? NAVY : 'transparent',
                    '&:hover': { bgcolor: isCurrent ? NAVY : alpha(NAVY, 0.055) },
                    '&.Mui-focusVisible': { outline: '3px solid', outlineColor: 'primary.light', outlineOffset: 2 },
                    '&.Mui-disabled': { opacity: isCurrent ? 1 : 0.55, color: isCurrent ? 'common.white' : undefined }
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800,
                      border: '1px solid', borderColor: isCurrent ? 'common.white' : isCancelled ? 'error.light' : isPast ? 'success.main' : 'divider',
                      bgcolor: isCurrent ? 'common.white' : isCancelled ? 'error.lighter' : isPast ? 'success.lighter' : 'background.paper',
                      color: isCurrent ? NAVY : isCancelled ? 'error.main' : isPast ? 'success.dark' : 'text.secondary'
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="caption" fontWeight={800} lineHeight={1.15} color="inherit">{status.label}</Typography>
                </ButtonBase>
                {index < MAINTENANCE_STATUS_FLOW.length - 1 && (
                  <Box aria-hidden="true" sx={{ width: { xs: 10, sm: 18 }, mt: 3.15, borderTop: '1px solid', borderColor: isPast ? 'success.main' : 'divider', flex: '0 0 auto' }} />
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Paper>
  );
}
