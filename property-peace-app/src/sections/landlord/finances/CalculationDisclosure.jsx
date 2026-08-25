import { useState } from 'react';
import ExpandMore from '@mui/icons-material/ExpandMore';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { Alert, Box, Button, Collapse, Divider, Stack, Typography } from '@mui/material';

export default function CalculationDisclosure({
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
  const [expanded, setExpanded] = useState(false);
  const explanations = overview?.explanations || [];
  const disclosures = itemsResponse?.disclosures || [];
  const warnings = overview?.dataQuality?.warnings || [];
  const explanationsAvailable = overview?.sectionAvailability?.explanations !== false;

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box aria-live="polite" aria-atomic="false">
        {loading && <Typography role="status" variant="body2" color="text.secondary" sx={{ mb: 1 }}>Loading recorded financial data…</Typography>}
        {overviewError && itemsError ? (
          <Alert severity="error" sx={{ mb: 1 }} action={<Button color="inherit" onClick={onRetry}>Try again</Button>}>
            Financial summary and activity records could not be loaded. No unavailable values were estimated. {overviewError}
          </Alert>
        ) : overviewError ? (
          <Alert severity="warning" sx={{ mb: 1 }} action={<Button color="inherit" onClick={onRetry}>Retry summary</Button>}>
            Summary totals are unavailable. Activity records that loaded successfully remain available. {overviewError}
          </Alert>
        ) : itemsError ? (
          <Alert severity="warning" sx={{ mb: 1 }} action={<Button color="inherit" onClick={onRetry}>Retry activity</Button>}>
            Activity records are unavailable. Summary totals that loaded successfully remain available. {itemsError}
          </Alert>
        ) : null}
        {paymentsError && (
          <Alert severity="warning" sx={{ mb: 1 }} action={<Button color="inherit" onClick={onRetryPayments}>Retry payments</Button>}>
            Collected this month is unavailable because payment records could not be loaded. {paymentsError}
          </Alert>
        )}
        {exportError && <Alert severity="error" sx={{ mb: 1 }}>The activity export could not be prepared. {exportError}</Alert>}
        {(overview?.isPartial || itemsResponse?.isPartial) && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            Some financial fields were unavailable. Available recorded values are shown; missing values and sections are not estimated.
          </Alert>
        )}
      </Box>

      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.25 }}>
        <Button
          aria-controls="finances-calculation-details"
          aria-expanded={expanded}
          endIcon={<ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }} />}
          onClick={() => setExpanded((value) => !value)}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          How these numbers are calculated
        </Button>
        <Collapse id="finances-calculation-details" in={expanded}>
          <Divider sx={{ my: 1.25 }} />
          <Stack spacing={1.25} sx={{ px: 1, pb: 1 }}>
            {!explanationsAvailable ? (
              <Alert severity="warning">Calculation explanations are unavailable. No explanation has been inferred.</Alert>
            ) : explanations.map((explanation) => (
              <Stack key={explanation} direction="row" spacing={1} alignItems="flex-start">
                <InfoOutlined color="primary" fontSize="small" />
                <Typography variant="body2">{explanation}</Typography>
              </Stack>
            ))}
            {disclosures.map((disclosure) => <Typography key={disclosure} variant="body2" color="text.secondary">{disclosure}</Typography>)}
            {warnings.map((warning) => <Alert key={warning} severity="info">{warning}</Alert>)}
          </Stack>
        </Collapse>
      </Box>
    </Box>
  );
}
