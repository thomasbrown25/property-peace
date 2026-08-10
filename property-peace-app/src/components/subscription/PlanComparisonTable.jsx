import { Box, Typography, ToggleButton, ToggleButtonGroup, Button, Chip, Stack, alpha } from '@mui/material';
import { CheckOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

const COMPARISON_FEATURES = [
  { label: 'Units', type: 'value', getValue: (plan) => plan.maxTotalUnits == null ? 'Unlimited' : String(plan.maxTotalUnits) },
  { label: 'Tenant portal', type: 'check', check: 'tenant portal' },
  { label: 'Maintenance tracking', type: 'check', check: 'maintenance' },
  { label: 'Lease management', type: 'check', check: 'lease' },
  { label: 'Expense tracking', type: 'check', check: 'expense' },
  { label: 'Document storage', type: 'check', check: 'document storage' },
  { label: 'Hosted listing page', type: 'check', check: 'hosted property peace listing' },
  { label: 'External listing syndication', type: 'check', check: 'external listing' },
  { label: 'Online rent collection', type: 'check', check: 'online rent' },
  { label: 'Automated rent reminders', type: 'check', check: 'automated rent' },
  { label: 'Financial reports', type: 'check', check: 'financial report' },
  { label: 'Rent estimates', type: 'check', check: 'rent estimate' },
  { label: 'LeaseShield', type: 'check', check: 'leaseshield' },
  { label: 'AI-powered features', type: 'check', check: 'ai-powered' },
  { label: 'Priority support', type: 'check', check: 'priority support' },
];

function parseFeatures(plan) {
  if (!plan.features) return [];
  return typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
}

function expandFeatures(plans) {
  return plans.map((plan) => {
    const features = parseFeatures(plan);
    const expanded = [...features];
    features.forEach((f) => {
      const match = f.match(/everything in (.+)/i);
      if (match) {
        const parentName = match[1].toLowerCase().trim();
        const parent = plans.find((p) => p.name?.toLowerCase() === parentName);
        if (parent) {
          parseFeatures(parent).forEach((pf) => {
            if (!expanded.some((ef) => ef.toLowerCase() === pf.toLowerCase())) {
              expanded.push(pf);
            }
          });
        }
      }
    });
    return { ...plan, _expanded: expanded };
  });
}

function hasFeature(plan, check) {
  const features = plan._expanded ?? parseFeatures(plan);
  return features.some((f) => f.toLowerCase().includes(check.toLowerCase()));
}

export default function PlanComparisonTable({ plans = [], currentPlanId, currentBillingCycle, onSelectPlan, loading = false }) {
  const theme = useTheme();
  const [billingCycle, setBillingCycle] = useState(currentBillingCycle || 'Monthly');
  const { presentation: rentReadiness } = useFeatureReadiness(FEATURE_KEYS.onlineRentCollection);
  const { presentation: syndicationReadiness } = useFeatureReadiness(FEATURE_KEYS.listingSyndication);
  const rawPlans = plans.filter((p) => !p.isTrial);
  const displayPlans = expandFeatures(rawPlans);

  useEffect(() => {
    if (currentBillingCycle) setBillingCycle(currentBillingCycle);
  }, [currentBillingCycle]);

  const recommendedPlanId = displayPlans.find((p) => p.name?.toLowerCase().includes('premium'))?.id ?? null;

  const visibleFeatures = COMPARISON_FEATURES.filter(
    (f) => f.type === 'value' || displayPlans.some((p) => hasFeature(p, f.check))
  );

  const getCellValue = (plan, feature) => {
    if (feature.type === 'value') {
      return <Typography variant="body2" fontWeight={600}>{feature.getValue(plan)}</Typography>;
    }
    if (!hasFeature(plan, feature.check)) {
      return <Typography component="span" color="text.disabled" sx={{ fontSize: 18, lineHeight: 1 }}>—</Typography>;
    }
    if (feature.check === 'online rent' && !rentReadiness.canInvoke) {
      return <Chip label={rentReadiness.title} size="small" variant="outlined" color={rentReadiness.severity === 'error' ? 'error' : 'default'} />;
    }
    if (feature.check === 'external listing' && !syndicationReadiness.canInvoke) {
      return <Chip label={syndicationReadiness.title} size="small" variant="outlined" color={syndicationReadiness.severity === 'error' ? 'error' : 'default'} />;
    }
    return <CheckOutlined style={{ color: theme.palette.success.main, fontSize: 15 }} />;
  };

  const getPlanHighlightColor = (plan) => {
    const isCurrentPlan = plan.id === currentPlanId;
    const isRecommended = plan.id === recommendedPlanId && plan.id !== currentPlanId;
    if (isCurrentPlan) return theme.palette.success.main;
    if (isRecommended) return theme.palette.primary.main;
    return null;
  };

  const LABEL_WIDTH = '180px';

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="overline" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 1 }}>
            Available Plans
          </Typography>
          <Typography variant="h5" fontWeight={700}>Pick your plan</Typography>
        </Box>
        <ToggleButtonGroup
          value={billingCycle}
          exclusive
          onChange={(_, v) => { if (v) setBillingCycle(v); }}
          size="small"
          sx={{ width: { xs: '100%', sm: 'auto' }, '& .MuiToggleButton-root': { flex: { xs: 1, sm: 'initial' } } }}
        >
          <ToggleButton value="Monthly" sx={{ textTransform: 'none', px: 2, fontSize: 13 }}>Monthly</ToggleButton>
          <ToggleButton value="Annual" sx={{ textTransform: 'none', px: 2, fontSize: 13 }}>
            Annual&nbsp;
            <Typography
              component="span"
              sx={{
                fontSize: 11, fontWeight: 700, color: 'success.main',
                bgcolor: alpha(theme.palette.success.main, 0.12),
                px: 0.6, py: 0.15, borderRadius: 0.5, lineHeight: 1.6
              }}
            >
              -15%
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <FeatureReadinessNotice presentation={rentReadiness} featureName="Online rent collection availability" />

      <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
        {displayPlans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId && currentBillingCycle === billingCycle;
          const isRecommended = plan.id === recommendedPlanId && plan.id !== currentPlanId;
          const price = billingCycle === 'Annual' ? plan.annualPrice : plan.monthlyPrice;
          const currentPlan = displayPlans.find((candidate) => candidate.id === currentPlanId);
          const currentPrice = currentPlan ? (billingCycle === 'Annual' ? currentPlan.annualPrice : currentPlan.monthlyPrice) : 0;
          const isDowngrade = currentPlanId && price < currentPrice;

          return (
            <Box
              key={plan.id}
              sx={{
                p: 2.25,
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: isCurrentPlan ? 'success.main' : isRecommended ? 'primary.main' : 'divider',
                borderWidth: isCurrentPlan || isRecommended ? 2 : 1,
                bgcolor: isRecommended ? alpha(theme.palette.primary.main, 0.035) : 'background.paper'
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
                    {isCurrentPlan && <Chip label="CURRENT" size="small" color="success" sx={{ fontWeight: 700, fontSize: 10, height: 20 }} />}
                    {isRecommended && <Chip label="★ RECOMMENDED" size="small" color="primary" sx={{ fontWeight: 700, fontSize: 10, height: 20 }} />}
                  </Stack>
                  <Typography variant="h5" fontWeight={800}>{plan.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{plan.description}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="h4" fontWeight={800}>${price?.toFixed(2)}</Typography>
                  <Typography variant="caption" color="text.secondary">per month</Typography>
                </Box>
              </Stack>

              <Stack spacing={0.85} sx={{ my: 2 }}>
                {visibleFeatures.slice(0, 8).map((feature) => (
                  <Stack key={feature.label} direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Typography variant="body2" color="text.secondary">{feature.label}</Typography>
                    <Box sx={{ flexShrink: 0 }}>{getCellValue(plan, feature)}</Box>
                  </Stack>
                ))}
              </Stack>

              <Button
                variant={isCurrentPlan ? 'outlined' : 'contained'}
                fullWidth
                disabled={isCurrentPlan || loading}
                onClick={() => onSelectPlan && onSelectPlan(plan, billingCycle)}
                sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 700, py: 1 }}
              >
                {loading ? 'Processing...' : isCurrentPlan ? 'Current plan' : isDowngrade ? 'Downgrade plan' : 'Choose plan'}
              </Button>
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'relative', border: `1px solid ${theme.palette.divider}`, borderRadius: 3, overflow: 'hidden' }}>

        {/* ── Plan header row ── */}
        <Box sx={{ display: 'flex', borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}` }} />
          {displayPlans.map((plan, idx) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const isRecommended = plan.id === recommendedPlanId && plan.id !== currentPlanId;
            const price = billingCycle === 'Annual' ? plan.annualPrice : plan.monthlyPrice;
            return (
              <Box
                key={plan.id}
                sx={{
                  flex: 1,
                  p: 2.5,
                  borderRight: idx < displayPlans.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                  bgcolor: isRecommended
                    ? theme.palette.primary.main
                    : isCurrentPlan
                    ? alpha(theme.palette.success.main, 0.05)
                    : 'transparent',
                }}
              >
                <Stack direction="row" spacing={0.75} sx={{ mb: 1.25 }}>
                  {isCurrentPlan && (
                    <Chip label="CURRENT" size="small" color="success" sx={{ fontWeight: 700, fontSize: 10, height: 20 }} />
                  )}
                  {isRecommended && (
                    <Chip
                      label="★ RECOMMENDED"
                      size="small"
                      sx={{
                        fontWeight: 700, fontSize: 10, height: 20,
                        bgcolor: alpha('#fff', 0.2), color: '#fff',
                        '& .MuiChip-label': { color: '#fff' }
                      }}
                    />
                  )}
                  {!isCurrentPlan && !isRecommended && <Box sx={{ height: 20 }} />}
                </Stack>
                <Typography variant="h6" fontWeight={700} color={isRecommended ? '#fff' : 'text.primary'}>
                  {plan.name}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mb: 1.25, color: isRecommended ? alpha('#fff', 0.75) : 'text.secondary' }}>
                  {plan.description}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  <Typography variant="h4" fontWeight={800} color={isRecommended ? '#fff' : 'text.primary'}>
                    ${price?.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: isRecommended ? alpha('#fff', 0.75) : 'text.secondary' }}>
                    /mo
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* ── Feature rows ── */}
        {visibleFeatures.map((feature, rowIdx) => (
          <Box
            key={feature.label}
            sx={{
              display: 'flex',
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: rowIdx % 2 !== 0 ? alpha(theme.palette.grey[500], 0.04) : 'transparent',
            }}
          >
            <Box
              sx={{
                width: LABEL_WIDTH, flexShrink: 0, px: 2, py: 1.25,
                borderRight: `1px solid ${theme.palette.divider}`,
                display: 'flex', alignItems: 'center',
              }}
            >
              <Typography variant="body2" color="text.secondary">{feature.label}</Typography>
            </Box>
            {displayPlans.map((plan, idx) => {
              const isCurrentPlan = plan.id === currentPlanId;
              const isRecommended = plan.id === recommendedPlanId && plan.id !== currentPlanId;
              return (
                <Box
                  key={plan.id}
                  sx={{
                    flex: 1, px: 2, py: 1.25,
                    borderRight: idx < displayPlans.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isCurrentPlan
                      ? alpha(theme.palette.success.main, 0.03)
                      : isRecommended
                      ? alpha(theme.palette.primary.main, 0.03)
                      : 'transparent',
                  }}
                >
                  {getCellValue(plan, feature)}
                </Box>
              );
            })}
          </Box>
        ))}

        {/* ── Action button row ── */}
        <Box sx={{ display: 'flex' }}>
          <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: `1px solid ${theme.palette.divider}` }} />
          {displayPlans.map((plan, idx) => {
            const isCurrentPlan = plan.id === currentPlanId && currentBillingCycle === billingCycle;
            const isRecommended = plan.id === recommendedPlanId && plan.id !== currentPlanId;
            const currentPlan = displayPlans.find((p) => p.id === currentPlanId);
            const currentPrice = currentPlan ? (billingCycle === 'Annual' ? currentPlan.annualPrice : currentPlan.monthlyPrice) : 0;
            const planPrice = billingCycle === 'Annual' ? plan.annualPrice : plan.monthlyPrice;
            const isDowngrade = currentPlanId && planPrice < currentPrice;
            return (
              <Box
                key={plan.id}
                sx={{
                  flex: 1, p: 2,
                  borderRight: idx < displayPlans.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                  bgcolor: isCurrentPlan
                    ? alpha(theme.palette.success.main, 0.03)
                    : isRecommended
                    ? alpha(theme.palette.primary.main, 0.03)
                    : 'transparent',
                }}
              >
                <Button
                  variant={isCurrentPlan ? 'outlined' : 'contained'}
                  color="primary"
                  fullWidth
                  disabled={isCurrentPlan || loading}
                  onClick={() => onSelectPlan && onSelectPlan(plan, billingCycle)}
                  sx={{ textTransform: 'none', borderRadius: 1.5, fontWeight: 600 }}
                >
                  {loading ? 'Processing...' : isCurrentPlan ? 'Current plan' : isDowngrade ? 'Downgrade' : 'Upgrade →'}
                </Button>
              </Box>
            );
          })}
        </Box>

        {displayPlans.map((plan, idx) => {
          const color = getPlanHighlightColor(plan);
          if (!color) return null;
          const isLastColumn = idx === displayPlans.length - 1;

          return (
            <Box
              aria-hidden="true"
              key={`plan-highlight-${plan.id}`}
              sx={{
                position: 'absolute',
                top: 1,
                bottom: 1,
                left: `calc(${LABEL_WIDTH} + (${idx} * ((100% - ${LABEL_WIDTH}) / ${displayPlans.length})))`,
                ...(isLastColumn
                  ? { right: 1 }
                  : { width: `calc((100% - ${LABEL_WIDTH}) / ${displayPlans.length})` }),
                zIndex: 5,
                pointerEvents: 'none',
                border: `2px solid ${color}`,
                borderTopRightRadius: isLastColumn ? 3 : 0,
                borderBottomRightRadius: isLastColumn ? 3 : 0,
                boxSizing: 'border-box',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
