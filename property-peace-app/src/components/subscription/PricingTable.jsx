import { Box, Grid, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import PlanCard from './PlanCard';
import { useState, useEffect } from 'react';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';

const TENANT_FEATURES = {
  free: [
    'View lease & documents',
    'Submit maintenance requests',
    'Maintenance request tracking',
    'Payment history',
    'Messages & announcements',
    'Application portal'
  ],
  premium: [
    'Everything in Free',
    'LeaseShield — AI legal guidance',
    'Priority support'
  ]
};

export default function PricingTable({ plans = [], currentPlanId, currentBillingCycle, onSelectPlan, loading = false, isTenant = false }) {
  // Initialize billing cycle to match current subscription, or default to Monthly
  const [billingCycle, setBillingCycle] = useState(currentBillingCycle || 'Monthly');
  const { presentation: rentReadiness } = useFeatureReadiness(FEATURE_KEYS.onlineRentCollection);

  // Sync billing cycle when subscription changes
  useEffect(() => {
    if (currentBillingCycle) {
      setBillingCycle(currentBillingCycle);
    }
  }, [currentBillingCycle]);

  const handleBillingCycleChange = (event, newCycle) => {
    if (newCycle !== null) {
      setBillingCycle(newCycle);
    }
  };

  // Filter out trial plan from pricing table (show it separately)
  const displayPlans = plans.filter(p => !p.isTrial);

  // Only show "Most Popular" if user doesn't have an active subscription
  const hasActiveSubscription = currentPlanId !== null && currentPlanId !== undefined;
  // Premium is the most popular plan
  const premiumPlanIndex = displayPlans.findIndex(p => p.name && p.name.toLowerCase().includes('premium'));
  const popularPlanIndex = hasActiveSubscription ? -1 : (premiumPlanIndex >= 0 ? premiumPlanIndex : Math.floor(displayPlans.length / 2));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
        <ToggleButtonGroup
          value={billingCycle}
          exclusive
          onChange={handleBillingCycleChange}
          aria-label="billing cycle"
        >
          <ToggleButton value="Monthly" aria-label="monthly">
            Monthly
          </ToggleButton>
          <ToggleButton value="Annual" aria-label="annual">
            Annual
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {!isTenant && (
        <Box sx={{ mb: 3 }}>
          <FeatureReadinessNotice presentation={rentReadiness} featureName="Online rent collection availability" />
        </Box>
      )}

      <Grid container spacing={3}>
        {displayPlans.map((plan, index) => {
          // Check both plan ID and billing cycle to determine if it's the current plan
          const isCurrentPlan = currentPlanId === plan.id && currentBillingCycle === billingCycle;
          const isPopular = !hasActiveSubscription && index === popularPlanIndex;
          
          return (
            <Grid item size={{ xs: 12, sm: 6 }} key={plan.id}>
              <PlanCard
                plan={plan}
                isCurrentPlan={isCurrentPlan}
                isPopular={isPopular}
                onSelect={(plan) => onSelectPlan(plan, billingCycle)}
                billingCycle={billingCycle}
                disabled={loading}
                hasActiveSubscription={hasActiveSubscription}
                isTenant={isTenant}
                rentReadiness={rentReadiness}
                tenantFeatures={isTenant
                  ? (plan.name?.toLowerCase().includes('premium') ? TENANT_FEATURES.premium : TENANT_FEATURES.free)
                  : null}
              />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

