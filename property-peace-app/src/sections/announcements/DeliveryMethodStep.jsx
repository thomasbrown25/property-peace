import PropTypes from 'prop-types';

// material-ui
import { Box, Typography, Checkbox, Stack, Alert, alpha, useTheme } from '@mui/material';
import { MailOutlined, NotificationOutlined } from '@ant-design/icons';

// ==============================|| DELIVERY METHOD STEP ||============================== //

const deliveryOptions = [
  {
    key: 'inApp',
    label: 'In-app notification',
    description: 'Show the announcement inside the tenant portal.',
    icon: <NotificationOutlined />
  },
  {
    key: 'email',
    label: 'Email',
    description: 'Send a copy to tenant email addresses when available.',
    icon: <MailOutlined />
  }
];

export default function DeliveryMethodStep({ deliveryMethods, onDeliveryMethodsChange }) {
  const theme = useTheme();
  const hasAtLeastOne = deliveryMethods.inApp || deliveryMethods.email;

  const toggleMethod = (key) => {
    onDeliveryMethodsChange({ ...deliveryMethods, [key]: !deliveryMethods[key] });
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.75 }}>
        Where should this announcement go?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose one or both delivery methods. In-app keeps the notice visible in the portal; email helps reach tenants outside the app.
      </Typography>

      <Stack spacing={1.5}>
        {deliveryOptions.map((option) => {
          const selected = deliveryMethods[option.key];
          return (
            <Box
              key={option.key}
              role="button"
              tabIndex={0}
              onClick={() => toggleMethod(option.key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleMethod(option.key);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.75,
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                bgcolor: selected ? alpha(theme.palette.primary.main, 0.055) : 'background.paper',
                border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.45) : alpha(theme.palette.divider, 0.9)}`,
                transition: 'border-color 0.15s, background-color 0.15s',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.45),
                  bgcolor: selected ? alpha(theme.palette.primary.main, 0.075) : alpha(theme.palette.primary.main, 0.025)
                },
                '&:focus-visible': {
                  outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                  outlineOffset: 2
                }
              }}
            >
              <Checkbox checked={selected} onChange={() => toggleMethod(option.key)} onClick={(event) => event.stopPropagation()} />
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '& .anticon': { fontSize: 18 }
                }}
              >
                {option.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={700}>{option.label}</Typography>
                <Typography variant="body2" color="text.secondary">{option.description}</Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>

      {!hasAtLeastOne && (
        <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
          Please select at least one delivery method to continue.
        </Alert>
      )}
    </Box>
  );
}

DeliveryMethodStep.propTypes = {
  deliveryMethods: PropTypes.shape({
    inApp: PropTypes.bool.isRequired,
    email: PropTypes.bool.isRequired
  }).isRequired,
  onDeliveryMethodsChange: PropTypes.func.isRequired
};
