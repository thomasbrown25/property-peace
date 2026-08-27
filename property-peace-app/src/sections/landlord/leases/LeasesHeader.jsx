import { Button, Stack } from '@mui/material';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';

export default function LeasesHeader({ onCreateLease, onCreateAgreement }) {
  return (
    <ManagementPageHeader
      title="Leases"
      description="Track lease terms, rent health, renewals, and agreements from one organized workspace."
      actions={
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="outlined" startIcon={<FileTextOutlined />} onClick={onCreateAgreement} sx={managementPageHeaderActionSx}>
            New agreement
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<PlusOutlined />}
            onClick={onCreateLease}
            sx={managementPageHeaderActionSx}
          >
            Create lease
          </Button>
        </Stack>
      }
    />
  );
}
