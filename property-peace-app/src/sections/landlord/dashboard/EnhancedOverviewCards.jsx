import { alpha, Grid } from '@mui/system';
import { DollarCircleFilled, ArrowUpOutlined, ArrowDownOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Box, Typography, Stack, Chip, Card, CardContent, useMediaQuery, keyframes } from '@mui/material';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

// Slow pulsing animation for overdue rent - creates a subtle glow effect
const createPulseAnimation = (colorRgb) => keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(${colorRgb}, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(${colorRgb}, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(${colorRgb}, 0);
  }
`;

// Helper to convert MUI color to RGB string
const getColorRgb = (color) => {
  if (typeof color === 'string') {
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    }
    // Handle rgb() format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`;
    }
  }
  // Default to error red if can't parse
  return '211, 47, 47';
};

const EnhancedOverviewCards = ({ summary, previousMonthSummary }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { remainingThisMonth = 0, collectedThisMonth = 0, overdue = 0, expectedThisMonth = 0 } = summary || {};
  const { collectedThisMonth: prevCollected = 0, remainingThisMonth: prevRemaining = 0, overdue: prevOverdue = 0 } = previousMonthSummary || {};

  // Calculate trends
  const collectedTrend = prevCollected > 0 ? ((collectedThisMonth - prevCollected) / prevCollected) * 100 : 0;
  const remainingTrend = prevRemaining > 0 ? ((remainingThisMonth - prevRemaining) / prevRemaining) * 100 : 0;
  const overdueTrend = prevOverdue > 0 ? ((overdue - prevOverdue) / prevOverdue) * 100 : 0;

  // Calculate collection rate
  const collectionRate = expectedThisMonth > 0 ? (collectedThisMonth / expectedThisMonth) * 100 : 0;

  const TrendIndicator = ({ value, isPositive = true }) => {
    if (Math.abs(value) < 0.1) return null;
    const isGood = isPositive ? value > 0 : value < 0;
    return (
      <Chip
        icon={isGood ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        label={`${Math.abs(value).toFixed(1)}%`}
        size="small"
        color={isGood ? 'success' : 'error'}
        sx={{ ml: 1, height: 24, fontSize: '0.75rem' }}
      />
    );
  };

  const MetricCard = ({ title, value, subtitle, icon, color, borderColor, className, onClick, shouldPulse = false }) => {
    const isXs = useMediaQuery(theme.breakpoints.down('sm'));
    const handleCardClick = onClick || (() => {
      navigate('/landlord/rent-collection');
    });

    // Create pulse animation if needed
    const colorRgb = shouldPulse ? getColorRgb(borderColor) : null;
    const pulseAnimation = shouldPulse && colorRgb ? createPulseAnimation(colorRgb) : null;

    return (
      <Card
        className={className}
        onClick={handleCardClick}
        sx={{
          height: '100%',
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(borderColor, 0.2)}`,
          borderLeft: `4px solid ${borderColor}`,
          borderRadius: 2,
          boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          // Slow pulsing animation when shouldPulse is true
          ...(shouldPulse && pulseAnimation && {
            animation: `${pulseAnimation} 2s ease-in-out infinite`
          }),
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
            borderLeftWidth: '6px',
            animation: 'none', // Stop pulsing on hover
            '& .metric-icon': {
              transform: 'scale(1.1)',
              color: borderColor
            }
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: `linear-gradient(90deg, ${borderColor}, ${alpha(borderColor, 0.3)})`,
            opacity: 0,
            transition: 'opacity 0.3s ease'
          },
          '&:hover::before': {
            opacity: 1
          }
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {isXs ? (
            // Mobile layout: icon -> title -> value on one line, subtitle below
            <Stack spacing={0.75}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Box
                  className="metric-icon"
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.5,
                    bgcolor: alpha(borderColor, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    flexShrink: 0,
                    '& svg, & .anticon': {
                      fontSize: 16
                    }
                  }}
                >
                  {icon}
                </Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    flexShrink: 0
                  }}
                >
                  {title}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    lineHeight: 1.2,
                    fontSize: '1.25rem',
                    ml: 'auto'
                  }}
                >
                  {value}
                </Typography>
              </Stack>
              {subtitle && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 400,
                    pl: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  {subtitle}
                </Typography>
              )}
            </Stack>
          ) : (
            // Desktop layout: vertical stack
            <Stack spacing={1}>
              {/* Header with icon and title */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box
                  className="metric-icon"
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(borderColor, 0.1),
                    transition: 'all 0.3s ease'
                  }}
                >
                  {icon}
                </Box>
              </Stack>

              {/* Title */}
              <Box>
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    mb: 0.25
                  }}
                >
                  {title}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    color: 'text.primary',
                    lineHeight: 1.2,
                    mb: 0.5,
                    fontSize: '1.25rem'
                  }}
                >
                  {value}
                </Typography>
              </Box>

              {/* Subtitle */}
              <Box
                sx={{
                  pt: 0.75,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    fontWeight: 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  {subtitle}
                </Typography>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <MetricCard
          className="rent-collected-overview-card"
          onClick={() => navigate('/landlord/accounting')}
          title="Rent Collected"
          value={formatCurrency(collectedThisMonth)}
          subtitle={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleOutlined style={{ fontSize: 11, color: theme.palette.success.main }} />
              <span>{collectionRate.toFixed(0)}% of expected</span>
            </Box>
          }
          icon={<DollarCircleFilled style={{ fontSize: 20, color: theme.palette.success.main }} />}
          color={theme.palette.success.main}
          borderColor={theme.palette.success.main}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <MetricCard
          className="rent-remaining-overview-card"
          title="Rent Remaining"
          value={formatCurrency(remainingThisMonth)}
          subtitle={`Expected: ${formatCurrency(expectedThisMonth)}`}
          icon={<DollarCircleFilled style={{ fontSize: 20, color: theme.palette.primary.main }} />}
          color={theme.palette.primary.main}
          borderColor={theme.palette.primary.main}
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <MetricCard
          className="rent-overdue-overview-card"
          title="Rent Overdue"
          value={formatCurrency(overdue)}
          subtitle={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {overdue > 0 ? (
                <>
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: theme.palette.error.main,
                      display: 'inline-block'
                    }}
                  />
                  <span style={{ color: theme.palette.error.main, fontWeight: 500 }}>Action required</span>
                </>
              ) : (
                <>
                  <CheckCircleOutlined style={{ fontSize: 11, color: theme.palette.success.main }} />
                  <span style={{ color: theme.palette.success.main }}>All caught up</span>
                </>
              )}
            </Box>
          }
          icon={<DollarCircleFilled style={{ fontSize: 20, color: theme.palette.error.main }} />}
          color={theme.palette.error.main}
          borderColor={theme.palette.error.main}
          onClick={() => navigate('/landlord/leases?view=overdue')}
          shouldPulse={overdue > 0}
        />
      </Grid>
    </>
  );
};

export default EnhancedOverviewCards;

