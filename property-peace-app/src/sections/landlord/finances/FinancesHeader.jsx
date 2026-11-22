import { Button, Stack, Tooltip } from '@mui/material';

import AppIcon from 'components/AppIcon';
import ActionsDrawer from 'components/drawers/shared/ActionsDrawer';
import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';

export default function FinancesHeader({ onAddExpense, onRecordPayment, exportState }) {
  const exportLabel = exportState?.label || 'Export';
  const exportDisabled = !exportState?.onExport || Boolean(exportState?.disabled || exportState?.busy);
  const exportReason = exportState?.disabledReason || '';

  const actions = [
    {
      label: 'Add expense',
      description: 'Record a property cost and attach a receipt.',
      icon: 'document',
      onSelect: onAddExpense
    },
    {
      label: 'Record payment',
      description: 'Log rent, a fee, or a deposit you received.',
      icon: 'moneys',
      onSelect: onRecordPayment
    }
  ];

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
                startIcon={<AppIcon name="downloadDocument" />}
                onClick={exportState?.onExport}
                disabled={exportDisabled}
                aria-label={exportDisabled && exportReason ? `${exportLabel}. ${exportReason}` : exportLabel}
                sx={managementPageHeaderActionSx}
              >
                {exportState?.busy ? 'Exporting…' : exportLabel}
              </Button>
            </span>
          </Tooltip>
          <ActionsDrawer id="finances-actions-drawer" title="Finances actions" actions={actions} />
        </Stack>
      }
    />
  );
}
