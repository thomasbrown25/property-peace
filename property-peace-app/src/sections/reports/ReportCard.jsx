import PropTypes from 'prop-types';
import {
  Card,
  CardContent,
  CardActionArea,
  Stack,
  Chip,
  Typography,
  Box,
  alpha,
  Tooltip
} from '@mui/material';
import { LockOutlined } from '@ant-design/icons';

export default function ReportCard({ report, isLocked, onClick }) {
  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        border: `1px solid ${alpha(report.color, 0.2)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(report.color, 0.2)}`,
          borderColor: report.color
        },
        ...(isLocked && {
          opacity: 0.7,
          cursor: 'not-allowed'
        })
      }}
    >
      <CardActionArea
        onClick={onClick}
        disabled={isLocked}
        sx={{ height: '100%' }}
      >
        <CardContent>
          <Stack spacing={2}>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(report.color, 0.1),
                  color: report.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {report.icon}
              </Box>
              {/* TODO: Re-enable Growth chip when premium access is enforced */}
              {false && report.tier === 'premium' && (
                <Tooltip
                  title={isLocked ? "This feature is available in the Growth plan" : ""}
                  arrow
                  placement="top"
                >
                  <Chip
                    icon={isLocked ? <LockOutlined /> : null}
                    label="Growth"
                    size="small"
                    color="warning"
                    sx={{ ml: 'auto' }}
                  />
                </Tooltip>
              )}
            </Stack>

            {/* Title */}
            <Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                {report.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {report.description}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {report.formula}
              </Typography>
            </Box>

            {/* Action hint */}
            <Typography variant="caption" color="primary" sx={{ mt: 'auto', pt: 1 }}>
              {isLocked ? 'Upgrade to unlock' : 'Click to view details →'}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

ReportCard.propTypes = {
  report: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    formula: PropTypes.string.isRequired,
    icon: PropTypes.node.isRequired,
    color: PropTypes.string.isRequired,
    tier: PropTypes.oneOf(['basic', 'premium']).isRequired,
    route: PropTypes.string.isRequired
  }).isRequired,
  isLocked: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired
};
