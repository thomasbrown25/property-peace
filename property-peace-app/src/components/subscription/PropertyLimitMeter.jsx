import { Box, Typography, LinearProgress, Chip, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function PropertyLimitMeter({ status }) {
  const navigate = useNavigate();

  if (!status) return null;

  const { currentPropertyCount, maxProperties, canAddProperty, currentTotalUnits, maxTotalUnits } = status;

  // Calculate the effective limit
  // If no subscription, they get 1 free property
  // If they have a subscription, use maxProperties (which accounts for the free property)
  const effectiveMax = maxProperties === null ? 1 : maxProperties;
  
  // Show meter if they have at least 1 property (meaning they're adding their 2nd)
  // Always show when they have 1 property, regardless of subscription status
  const shouldShowMeter = currentPropertyCount >= 1;

  if (!shouldShowMeter) return null;

  const propertyUsage = effectiveMax > 0 ? (currentPropertyCount / effectiveMax) * 100 : 0;
  const unitUsage = maxTotalUnits === null ? 0 : maxTotalUnits > 0 ? ((currentTotalUnits || 0) / maxTotalUnits) * 100 : 0;
  const canAddUnit = maxTotalUnits === null || (currentTotalUnits || 0) < maxTotalUnits;

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" fontWeight="medium">
          Properties: {currentPropertyCount} / {effectiveMax === null ? '∞' : effectiveMax}
        </Typography>
        {!canAddProperty && <Chip label="Limit Reached" color="warning" size="small" />}
      </Box>
      {effectiveMax !== null && (
        <LinearProgress
          variant="determinate"
          value={Math.min(propertyUsage, 100)}
          color={canAddProperty ? 'primary' : 'warning'}
          sx={{ height: 8, borderRadius: 1, mb: canAddProperty ? 0 : 1 }}
        />
      )}
      {!canAddProperty && (
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            size="small"
            color="warning"
            onClick={() => navigate('/landlord/subscription')}
          >
            Upgrade Plan
          </Button>
        </Box>
      )}

      {/* Unit Count Display */}
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" fontWeight="medium">
            Units: {currentTotalUnits || 0} / {maxTotalUnits === null ? '∞' : maxTotalUnits}
          </Typography>
          {!canAddUnit && <Chip label="Limit Reached" color="warning" size="small" />}
        </Box>
        {maxTotalUnits !== null && (
          <LinearProgress
            variant="determinate"
            value={Math.min(unitUsage, 100)}
            color={canAddUnit ? 'primary' : 'warning'}
            sx={{ height: 8, borderRadius: 1, mb: canAddUnit ? 0 : 1 }}
          />
        )}
        {!canAddUnit && (
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              color="warning"
              onClick={() => navigate('/landlord/subscription')}
            >
              Upgrade Plan
            </Button>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
