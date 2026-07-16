import { Box, Typography, Stack, useTheme, alpha } from '@mui/material';
import { DollarOutlined } from '@ant-design/icons';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function ExpensesHeader() {
  const theme = useTheme();

  return (
    <Box sx={{ mb: 4 }}>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Expenses' }
        ]}
      />

      {/* Header Row: icon on left, title and subtext on right */}
      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <DollarOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" fontWeight={700}>
            Expenses
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track income, expenses, and net cash flow by property and date range.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
