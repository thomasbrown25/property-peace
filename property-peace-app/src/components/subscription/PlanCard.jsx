import { Card, CardContent, Typography, Box, Button, Chip, alpha } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTheme } from '@mui/material/styles';

export default function PlanCard({
  plan,
  isCurrentPlan = false,
  isPopular = false,
  onSelect,
  billingCycle = 'Monthly',
  disabled = false,
  hasActiveSubscription = false,
  isTenant = false,
  tenantFeatures = null,
  rentReadiness = null
}) {
  const theme = useTheme();
  const price = billingCycle === 'Annual' ? plan.annualPrice : plan.monthlyPrice;
  const features = tenantFeatures ?? (plan.features ? (typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features) : []);

  return (
    <Card
      sx={{
        position: 'relative',
        height: '100%',
        minHeight: '300px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: isCurrentPlan
          ? `2px solid ${theme.palette.success.main}`
          : isPopular
            ? `2px solid ${theme.palette.primary.main}`
            : '1px solid',
        borderColor: isCurrentPlan ? theme.palette.success.main : 'divider',
        boxShadow: isCurrentPlan
          ? `0 8px 24px ${alpha(theme.palette.success.main, 0.2)}`
          : isPopular
            ? `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`
            : 'none',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.15)}`
        }
      }}
    >
      {isCurrentPlan && (
        <Chip
          label="Active"
          color="success"
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontWeight: 'bold',
            zIndex: 1
          }}
        />
      )}
      {!isCurrentPlan && isPopular && (
        <Chip
          label="Most Popular"
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontWeight: 'bold',
            zIndex: 1,
            bgcolor: 'primary.main',
            color: '#ffffff',
            '& .MuiChip-label': {
              color: '#ffffff'
            }
          }}
        />
      )}

      <CardContent
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        <Box sx={{ mb: 2, flexShrink: 0 }}>
          <Typography 
            variant="h5" 
            fontWeight="bold" 
            gutterBottom
            sx={{
              fontFamily: "'Host Grotesk', sans-serif"
            }}
          >
            {plan.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              minHeight: '40px',
              display: 'block'
            }}
          >
            {plan.description}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1 }}>
            <Typography 
              variant="h3" 
              fontWeight="bold" 
              sx={{ 
                fontFamily: "'Host Grotesk', sans-serif",
                color: 'text.primary'
              }}
            >
              ${price.toFixed(2)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              /{billingCycle === 'Annual' ? 'year' : 'month'}
            </Typography>
          </Box>

          <Box sx={{ minHeight: '32px' }}>
            {billingCycle === 'Annual' && plan.annualDiscount && (
              <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                Save {plan.annualDiscount.toFixed(0)}% annually
              </Typography>
            )}

          </Box>
        </Box>

        <Box sx={{ mb: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {!isTenant && (
            <>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                {plan.maxProperties === null ? 'Unlimited Properties' : `${plan.maxProperties} Properties`}
              </Typography>
              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                {plan.maxTotalUnits === null ? 'Unlimited Units' : `${plan.maxTotalUnits} Total Unit${plan.maxTotalUnits === 1 ? '' : 's'}`}
              </Typography>
            </>
          )}

          {features.length > 0 && (
            <Box sx={{ flexGrow: 1 }}>
              {features.map((feature, index) => {
                const isOnlineRentCollectionFeature = /online rent/i.test(feature);
                return (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main', mt: 0.15, flexShrink: 0 }} />
                    <Typography variant="body2">{feature}</Typography>
                    {isOnlineRentCollectionFeature && (
                      <Chip label="Approval required" size="small" variant="outlined" color={rentReadiness?.canInvoke ? 'success' : 'default'} sx={{ height: 22, flexShrink: 0 }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Button
          variant={isCurrentPlan ? 'outlined' : isPopular ? 'contained' : 'outlined'}
          fullWidth
          onClick={() => onSelect && onSelect(plan)}
          disabled={isCurrentPlan || disabled}
          sx={{ 
            mt: 'auto', 
            flexShrink: 0,
            ...(isPopular && {
              bgcolor: 'primary.main',
              color: '#ffffff',
              borderColor: 'primary.main',
              '&:hover': {
                bgcolor: 'primary.dark',
                borderColor: 'primary.dark'
              }
            }),
            ...(!isPopular && !isCurrentPlan && {
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
                bgcolor: 'rgba(25, 118, 210, 0.04)'
              }
            })
          }}
        >
          {disabled
            ? 'Processing...'
            : isCurrentPlan
            ? 'Current Plan'
            : hasActiveSubscription && (plan.monthlyPrice === 0 || plan.annualPrice === 0)
            ? 'Downgrade'
            : plan.monthlyPrice === 0
            ? 'Start Free'
            : 'Select Plan'}
        </Button>
      </CardContent>
    </Card>
  );
}
