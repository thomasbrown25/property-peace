import { useTheme, alpha } from '@mui/material';
import { HomeOutlined, PlusOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { LandlordEmptyState } from 'components/landlord/PagePrimitives';
import { useDrawer } from 'contexts/DrawerContext';

export default function PropertiesEmptyState() {
  const drawer = useDrawer();
  const theme = useTheme();

  return (
    <MainCard
      sx={{
        textAlign: 'center',
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        borderRadius: 2,
        border: `1px dashed ${theme.palette.divider}`,
        boxShadow: 'none'
      }}
    >
      <LandlordEmptyState
        icon={<HomeOutlined style={{ fontSize: 64, color: alpha(theme.palette.text.secondary, 0.3) }} />}
        title="No Properties Found"
        description="Get started by adding your first property to your portfolio. You can track rent, maintenance, and more."
        actionLabel="Add Your First Property"
        actionIcon={<PlusOutlined />}
        onAction={() => drawer.openPropertyAddWorkflowDrawer()}
      />
    </MainCard>
  );
}

