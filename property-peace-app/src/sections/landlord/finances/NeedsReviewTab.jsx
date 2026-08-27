import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { CSVLink } from 'react-csv';
import { Alert, alpha, Box, Button, Chip, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material';

import { buildReviewCsvRows } from 'utils/finances';
import { formatMoneyCenterDate } from 'utils/moneyCenter';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function NeedsReviewTab({ items = [],
  partial = false,
  loadedCount = 0,
  totalCount = 0,
  loading, error, onRetry, onSelectItem, registrationKey, registerExport }) {
  const theme = useTheme();
  const csvLinkRef = useRef(null);
  const csvRows = useMemo(() => buildReviewCsvRows(items), [items]);
  const exportVisibleRows = useCallback(() => csvLinkRef.current?.link?.click(), []);
  const exportState = useMemo(() => ({
    label: 'Export review',
    onExport: exportVisibleRows,
    disabled: loading || Boolean(error) || partial || items.length === 0,
    disabledReason: loading
      ? 'Review records are still loading.'
      : error
        ? 'Review records are unavailable.'
        : partial
            ? 'Review export is unavailable while this view is partial.'
            : items.length === 0
          ? 'There are no review records to export.'
          : ''
  }), [error, exportVisibleRows, items.length, loading, partial]);

  useLayoutEffect(() => registerExport('review', registrationKey, exportState), [exportState, registerExport, registrationKey]);

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <CSVLink
        ref={csvLinkRef}
        data={csvRows}
        filename={`finances-needs-review-${new Date().toISOString().slice(0, 10)}.csv`}
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={750}>Records that need attention</Typography>
        <Typography variant="body2" color="text.secondary">
          Each row is a real Money Center source record. A record can have more than one reason to review it.
        </Typography>
      </Box>

      {partial && !loading && !error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography fontWeight={700}>
            Showing {loadedCount} of {totalCount} source records.
          </Typography>
          This review list is partial, so it cannot confirm that all records are caught up. Review export is unavailable while this view is
          partial.
        </Alert>
      )}
      {loading ? (
        <Stack role="status" aria-live="polite" spacing={1.2} aria-label="Loading review records">
          {[1, 2, 3].map((row) => <Skeleton key={row} variant="rounded" height={82} />)}
        </Stack>
      ) : error ? (
        <Alert
          severity="warning"
          icon={<ErrorOutline />}
          action={<Button color="inherit" onClick={onRetry}>Try again</Button>}
        >
          <Typography fontWeight={700}>Review records could not be loaded</Typography>
          {error} This is not confirmation that your books are caught up.
        </Alert>
      ) : items.length === 0 ? (
        <Box role="status" aria-live="polite" sx={{ py: { xs: 5, md: 7 }, px: 2, textAlign: 'center' }}>
          <CheckCircleOutline color="success" sx={{ fontSize: 44 }} />
          <Typography variant="h6" sx={{ mt: 1.25 }}>
            {partial ? 'No review records in the loaded subset.' : 'Your books are caught up.'}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.65 }}>
            {partial
              ? 'The remaining source records were not loaded, so additional review items may exist.'
              : 'Imported bank transactions will also appear here after bank connections are added.'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.1}>
          {items.map((item) => (
            <Box
              key={`${item.sourceType || 'source'}:${item.sourceId}`}
              component="button"
              type="button"
              onClick={() => onSelectItem(item)}
              aria-label={`Open review details for ${item.description || item.category || 'source record'}`}
              sx={{
                width: '100%', p: 1.5, display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(220px, 1.25fr) minmax(180px, 1fr) minmax(140px, .8fr) auto' },
                alignItems: { md: 'center' }, gap: 1.25, border: `1px solid ${alpha(theme.palette.divider, 0.18)}`,
                borderRadius: 2, bgcolor: 'background.paper', color: 'text.primary', textAlign: 'left', font: 'inherit', cursor: 'pointer',
                '&:hover': { borderColor: alpha(theme.palette.warning.main, 0.5), bgcolor: alpha(theme.palette.warning.main, 0.025) },
                '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`, outlineOffset: 2 }
              }}
            >
              <Box minWidth={0}>
                <Typography fontWeight={750} noWrap>{item.description || item.category || 'Financial record'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatMoneyCenterDate(item.occurredAt)} · Source {item.sourceId || 'not recorded'}
                </Typography>
              </Box>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.6}>
                {item.reviewReasons.map((reason) => <Chip key={reason} size="small" color="warning" variant="outlined" label={reason} />)}
              </Stack>
              <Box>
                <Typography variant="body2">{item.propertyName || 'Property not recorded'}</Typography>
                <Typography variant="caption" color="text.secondary">{item.unitName || 'Property level'} · {item.category || 'Uncategorized'}</Typography>
              </Box>
              <Typography fontWeight={750} sx={{ textAlign: { md: 'right' } }}>{money.format(Number(item.amount) || 0)}</Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

NeedsReviewTab.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    sourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sourceType: PropTypes.string,
    reviewReasons: PropTypes.arrayOf(PropTypes.string).isRequired
  })),
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  partial: PropTypes.bool,
  loadedCount: PropTypes.number,
  totalCount: PropTypes.number,
  onRetry: PropTypes.func.isRequired,
  onSelectItem: PropTypes.func.isRequired,
  registrationKey: PropTypes.string.isRequired,
  registerExport: PropTypes.func.isRequired
};