import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import { selectProperties } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertyStory from 'sections/landlord/property/PropertyStory';

export default function PropertyActivityPage() {
  const { propertyId } = useParams();
  useFetchProperties();
  useFetchAllPayments();

  const properties = useSelector(selectProperties);
  const property = properties?.find((p) => String(p.id || p.Id) === String(propertyId));
  const propertyName = property?.name || property?.streetAddress || 'Property';

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageBreadcrumbs items={[
        { label: 'Dashboard', path: '/landlord/dashboard' },
        { label: 'Properties', path: '/landlord/properties' },
        { label: propertyName, path: `/landlord/property/${propertyId}` },
        { label: 'Activity' }
      ]} />
      <Box sx={{ mt: 2 }}>
        <PropertyStory property={property} propertyId={propertyId} />
      </Box>
    </Box>
  );
}
