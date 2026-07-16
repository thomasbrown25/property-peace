import PropTypes from 'prop-types';
import { Card, CardContent, Stack, Typography, alpha, useTheme } from '@mui/material';
import { InfoCircleOutlined } from '@ant-design/icons';

/**
 * Reusable info section matching the "Here's what you need to know:" style:
 * light primary-tinted background, rounded border, dark blue bold title with info icon,
 * bullet list in secondary text.
 */
export default function InfoSection({ title, bullets }) {
  const theme = useTheme();

  return (
    <Card
      sx={{
        bgcolor: alpha(theme.palette.primary.main, 0.08),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        borderRadius: 2
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <InfoCircleOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
            <Typography variant="h6" fontWeight={600} color="primary.main">
              {title}
            </Typography>
          </Stack>
          <Stack spacing={1.5} sx={{ pl: 3 }}>
            {Array.isArray(bullets) && bullets.length > 0 ? (
              bullets.map((bullet, idx) => (
                <Typography key={idx} variant="body2" color="text.secondary">
                  • {bullet}
                </Typography>
              ))
            ) : null}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

InfoSection.propTypes = {
  title: PropTypes.string.isRequired,
  bullets: PropTypes.arrayOf(PropTypes.string).isRequired
};
