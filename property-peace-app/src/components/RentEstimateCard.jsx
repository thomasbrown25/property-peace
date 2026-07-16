import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Collapse,
  Divider,
  Stack,
  alpha,
  useTheme,
  Tooltip,
  Chip
} from '@mui/material';
import {
  DollarOutlined,
  InfoCircleOutlined,
  DownOutlined,
  UpOutlined,
  LockOutlined,
  ReloadOutlined,
  RiseOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { getRentEstimate } from 'api/rentEstimate';

function formatCurrency(val) {
  return val != null ? `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—';
}

const CACHE_TTL_DAYS = 90;

function formatCacheAge(cachedAt) {
  if (!cachedAt) return null;
  const diffMs = Date.now() - new Date(cachedAt).getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function isCacheExpired(cachedAt) {
  if (!cachedAt) return true;
  const diffMs = Date.now() - new Date(cachedAt).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) > CACHE_TTL_DAYS;
}

/**
 * Rent estimate widget shown inside the listing setup property details step.
 * Auto-loads on mount for Premium users, showing cached results immediately.
 * Cached backend values are reused for 3 months; manual refresh bypasses cache.
 */
export default function RentEstimateCard({ propertyId, unitId = null, isPremium = false, onUseAmount }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState(null);
  const [showComparables, setShowComparables] = useState(false);
  const [usedAmount, setUsedAmount] = useState(false);

  const fetchEstimate = useCallback(async (forceRefresh = false) => {
    if (!propertyId || !isPremium) return;

    setLoading(true);
    setError(null);
    setUsedAmount(false);
    try {
      const data = await getRentEstimate(propertyId, unitId, forceRefresh);
      setEstimate(data);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch estimate.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isPremium, propertyId, unitId]);

  useEffect(() => {
    fetchEstimate(false);
  }, [fetchEstimate]);

  const handleUse = (amount) => {
    onUseAmount?.(Number(amount));
    setUsedAmount(true);
  };

  // ── Premium locked ──────────────────────────────────────────────────────
  if (!isPremium) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: `1px dashed ${alpha(theme.palette.primary.main, 0.35)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}
      >
        <LockOutlined style={{ color: theme.palette.primary.main, fontSize: 18, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" fontWeight={600}>
            Rent Estimate — Premium
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Upgrade to see data-driven rent estimates based on nearby comparable listings.
          </Typography>
        </Box>
      </Box>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading && !estimate) {
    return (
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
          bgcolor: alpha(theme.palette.primary.main, 0.02),
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}
      >
        <CircularProgress size={18} thickness={4} />
        <Typography variant="body2" color="text.secondary">
          Fetching rent estimate…
        </Typography>
      </Box>
    );
  }

  const cacheAge = estimate?.isFromCache && estimate?.cachedAt ? formatCacheAge(estimate.cachedAt) : null;
  const cacheExpired = estimate?.isFromCache ? isCacheExpired(estimate.cachedAt) : false;
  const showGetEstimateButton = !estimate || cacheExpired;

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
        overflow: 'hidden'
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          borderBottom: estimate ? `1px solid ${alpha(theme.palette.primary.main, 0.1)}` : 'none'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <DollarOutlined style={{ color: theme.palette.primary.main, fontSize: 15 }} />
          <Typography variant="body2" fontWeight={600} color="primary.main">
            Rent Estimate
          </Typography>
          <Tooltip title="Powered by Rentcast. Based on nearby comparable listings. Estimates are cached for up to 3 months." placement="top">
            <InfoCircleOutlined style={{ color: theme.palette.text.secondary, fontSize: 12, cursor: 'help' }} />
          </Tooltip>
        </Stack>

        {/* No estimate or cache expired — primary CTA */}
        {showGetEstimateButton && !loading && (
          <Button
            size="small"
            variant="contained"
            onClick={() => fetchEstimate(true)}
            disabled={!propertyId}
            startIcon={<RiseOutlined style={{ fontSize: 13 }} />}
            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.5 }}
          >
            Get Estimate
          </Button>
        )}

        {/* Has fresh estimate — show age + refresh icon only */}
        {estimate && !showGetEstimateButton && (
          <Stack direction="row" spacing={1} alignItems="center">
            {cacheAge && (
              <Typography variant="caption" color="text.secondary">
                Updated {cacheAge}
              </Typography>
            )}
            <Tooltip title="Refresh estimate" placement="top">
              <Button
                size="small"
                variant="text"
                onClick={() => fetchEstimate(true)}
                disabled={loading}
                sx={{
                  minWidth: 0,
                  p: 0.5,
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main' }
                }}
              >
                {loading
                  ? <CircularProgress size={13} />
                  : <ReloadOutlined style={{ fontSize: 14 }} />
                }
              </Button>
            </Tooltip>
          </Stack>
        )}
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Alert
            severity="warning"
            sx={{ py: 0.5 }}
            action={
              <Button size="small" color="inherit" onClick={() => fetchEstimate(true)} sx={{ textTransform: 'none', fontSize: '0.7rem' }}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      )}

      {/* Estimate body */}
      {estimate && !error && (
        <Box sx={{ p: 2 }}>
          {/* Main numbers */}
          <Stack direction="row" spacing={3} alignItems="flex-end" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                Estimated rent
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={0.5}>
                <Typography variant="h4" fontWeight={700} color="primary.main" sx={{ lineHeight: 1 }}>
                  {formatCurrency(estimate.rentEstimate)}
                </Typography>
                <Typography variant="caption" color="text.secondary">/mo</Typography>
              </Stack>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                Range
              </Typography>
              <Typography variant="body2" fontWeight={500} color="text.primary">
                {formatCurrency(estimate.rentRangeLow)} – {formatCurrency(estimate.rentRangeHigh)}
              </Typography>
            </Box>
          </Stack>

          {/* Cache badge */}
          {estimate.isFromCache && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Based on market data cached {cacheAge ?? 'recently'} · refreshes every 3 months
            </Typography>
          )}

          {/* Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {onUseAmount && estimate.rentEstimate != null && (
              <Button
                size="small"
                variant={usedAmount ? 'outlined' : 'contained'}
                onClick={() => handleUse(estimate.rentEstimate)}
                startIcon={usedAmount ? <CheckCircleOutlined style={{ fontSize: 13 }} /> : null}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                {usedAmount ? 'Applied' : 'Use this amount'}
              </Button>
            )}

            {estimate.comparables?.length > 0 && (
              <Button
                size="small"
                variant="text"
                onClick={() => setShowComparables((v) => !v)}
                endIcon={showComparables ? <UpOutlined style={{ fontSize: 10 }} /> : <DownOutlined style={{ fontSize: 10 }} />}
                sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.75rem' }}
              >
                {estimate.comparables.length} comparable{estimate.comparables.length !== 1 ? 's' : ''}
              </Button>
            )}
          </Stack>

          {/* Comparables */}
          <Collapse in={showComparables}>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block', letterSpacing: '0.06em' }}>
              NEARBY COMPARABLES
            </Typography>
            <Stack spacing={1}>
              {estimate.comparables.slice(0, 5).map((comp, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    border: `1px solid ${alpha(theme.palette.divider, 0.8)}`
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ flex: 1, mr: 1 }}>
                      <Typography variant="caption" fontWeight={500} sx={{ display: 'block' }}>
                        {comp.address || `${comp.city}, ${comp.state}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[
                          comp.bedrooms && `${comp.bedrooms} bd`,
                          comp.bathrooms && `${comp.bathrooms} ba`,
                          comp.squareFeet && `${comp.squareFeet?.toLocaleString()} sqft`
                        ].filter(Boolean).join(' · ')}
                        {comp.distanceMiles != null && ` · ${comp.distanceMiles.toFixed(1)} mi`}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600} color="primary.main" sx={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(comp.price)}/mo
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}
