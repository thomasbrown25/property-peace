import { alpha, Box, Stack, Typography } from '@mui/material';

export default function LeaseActivityRow({ label, details, amount, action }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={(theme) => ({
        py: 1,
        '&:not(:last-child)': {
          borderBottom: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.16 : 0.1)}`
        }
      })}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.3 }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{details}</Typography>
      </Box>
      {amount != null && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'success.main' }}>{amount}</Typography>
          {action}
        </Stack>
      )}
    </Stack>
  );
}
