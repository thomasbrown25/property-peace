import { useState } from 'react';
import { DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Button, Menu, MenuItem, Stack, Tooltip } from '@mui/material';

import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';

export default function FinancesHeader({ onAddExpense, onRecordPayment, exportState }) {
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
    <ManagementPageHeader
      title="Finances"
      description="Review recorded income, expenses, payments, and upcoming obligations across your portfolio."
      actions={
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
                sx={managementPageHeaderActionSx}
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
            sx={managementPageHeaderActionSx}
          >
            Add
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={addMenuOpen}
            onClose={() => setAnchorEl(null)}
            MenuListProps={{ 'aria-label': 'Add a financial record' }}
          >
            <MenuItem onClick={() => runAddAction(onAddExpense)}>Add expense</MenuItem>
            <MenuItem onClick={() => runAddAction(onRecordPayment)}>Record payment</MenuItem>
          </Menu>
        </Stack>
      }
    />
  );
}
