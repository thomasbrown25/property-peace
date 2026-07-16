import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography, alpha, useTheme } from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';
import useFetchProperty from 'hooks/useFetchProperty';
import SettingsTab from 'sections/landlord/property/SettingsTab';
import Loader from 'components/Loader';
import { selectPropertyLoading } from 'store/property/property.selector';
import { useSelector } from 'react-redux';

export default function PropertySettingsPage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { selectedProperty, refetch: refetchProperty } = useFetchProperty(propertyId);
  const propertyLoading = useSelector(selectPropertyLoading);

  const handleBack = () => {
    navigate(`/landlord/property/${propertyId}`);
  };

  const handleRefresh = () => {
    refetchProperty();
  };

  return (
    <>
      {propertyLoading && <Loader />}
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 4 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, pt: 3 }}>
          {/* Back Button */}
          <Button
            startIcon={<ArrowLeftOutlined />}
            onClick={handleBack}
            sx={{
              mb: 3,
              color: 'text.primary',
              textTransform: 'none',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            BACK
          </Button>

          {/* Settings Tab */}
          <SettingsTab 
            property={selectedProperty} 
            propertyId={propertyId}
            onRefresh={handleRefresh}
          />
        </Box>
      </Box>
    </>
  );
}
