import { useState } from 'react';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { alpha, Box, Button, Menu, MenuItem, Stack, Tooltip, Typography, useTheme } from '@mui/material';

export default function FinancesHeader({ onAddExpense, onRecordPayment, exportState }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const addMenuOpen = Boolean(anchorEl);
  const exportLabel = exportState?.label || 'Export';
  const exportDisabled = !exportState?.onExport || Boolean(exportState?.disabled || exportState?.busy);
  const exportReason = exportState?.disabledReason || '';

  const runAddAction = (action) => {
    setAnchorEl(null);
    action();
  };

  return (
    <Box
      sx={{
        mb: 2.5,
        p: { xs: 2, md: 2.75 },
        borderRadius: 3,
        color: 'common.white',
        background: `linear-gradient(120deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        boxShadow: `0 16px 38px ${alpha(theme.palette.primary.dark, 0.18)}`
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h2" color="inherit" fontWeight={800}>Finances</Typography>
          <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.78), maxWidth: 680 }}>
            Review recorded income, expenses, payments, and upcoming obligations across your portfolio.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={exportDisabled ? exportReason : ''} describeChild>
            <span
              tabIndex={exportDisabled ? 0 : undefined}
              aria-label={exportDisabled && exportReason ? `${exportLabel}. ${exportReason}` : undefined}
            >
              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                onClick={exportState?.onExport}
                disabled={exportDisabled}
                aria-label={exportDisabled && exportReason ? `${exportLabel}. ${exportReason}` : exportLabel}
                sx={{ color: '#fff', borderColor: alpha('#fff', 0.55), '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
              >
                {exportState?.busy ? 'Exporting…' : exportLabel}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            color="success"
            startIcon={<PlusOutlined />}
            endIcon={<KeyboardArrowDown />}
            aria-haspopup="menu"
            aria-expanded={addMenuOpen ? 'true' : undefined}
            onClick={(event) => setAnchorEl(event.currentTarget)}
            sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
          >
            Add
          </Button>
          <Menu anchorEl={anchorEl} open={addMenuOpen} onClose={() => setAnchorEl(null)} MenuListProps={{ 'aria-label': 'Add a financial record' }}>
            <MenuItem onClick={() => runAddAction(onAddExpense)}>Add expense</MenuItem>
            <MenuItem onClick={() => runAddAction(onRecordPayment)}>Record payment</MenuItem>
          </Menu>
        </Stack>
      </Stack>
    </Box>
  );
}
