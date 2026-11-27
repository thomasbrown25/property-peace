import { Alert, Box, Button, Typography } from '@mui/material';

export default function FinancesDataStatus({
  overview,
  itemsResponse,
  loading,
  overviewError,
  itemsError,
  paymentsError,
  exportError,
  onRetry,
  onRetryPayments
}) {
  return (
    <Box aria-live="polite" aria-atomic="false">
      {loading && (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Loading recorded financial data…
        </Typography>
      )}
      {overviewError && itemsError ? (
        <Alert
          severity="error"
          sx={{ mb: 1 }}
          action={
            <Button color="inherit" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          Financial summary and activity records could not be loaded. No unavailable values were estimated. {overviewError}
        </Alert>
      ) : overviewError ? (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={
            <Button color="inherit" onClick={onRetry}>
              Retry summary
            </Button>
          }
        >
          Summary totals are unavailable. Activity records that loaded successfully remain available. {overviewError}
        </Alert>
      ) : itemsError ? (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={
            <Button color="inherit" onClick={onRetry}>
              Retry activity
            </Button>
          }
        >
          Activity records are unavailable. Summary totals that loaded successfully remain available. {itemsError}
        </Alert>
      ) : null}
      {paymentsError && (
        <Alert
          severity="warning"
          sx={{ mb: 1 }}
          action={
            <Button color="inherit" onClick={onRetryPayments}>
              Retry payments
            </Button>
          }
        >
          Collected this month is unavailable because payment records could not be loaded. {paymentsError}
        </Alert>
      )}
      {exportError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          The activity export could not be prepared. {exportError}
        </Alert>
      )}
      {(overview?.isPartial || itemsResponse?.isPartial) && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Some financial fields were unavailable. Available recorded values are shown; missing values and sections are not estimated.
        </Alert>
      )}
    </Box>
  );
}
