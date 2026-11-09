import { useParams, useSearchParams } from 'react-router-dom';
import { Box } from '@mui/material';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import LeaseSetupBuilder from 'sections/lease-builder/LeaseSetupBuilder';
import { useOrganization } from 'contexts/OrganizationContext';

export default function LeaseBuilderPage() {
  const { leaseId, propertyId, unitId } = useParams();
  const [searchParams] = useSearchParams();
  const { currentOrganization } = useOrganization();
  return <Box>
    <PageBreadcrumbs items={[
      { label: 'Dashboard', path: '/landlord/dashboard' },
      { label: 'Leases', path: '/landlord/leases' },
      { label: leaseId ? 'Edit lease' : 'Create lease' }
    ]} />
    <Box sx={{ mt: 3 }}>
      <LeaseSetupBuilder key={`${currentOrganization?.id ?? currentOrganization?.Id ?? ''}:${leaseId || 'new'}:${propertyId || searchParams.get('propertyId') || ''}:${unitId || searchParams.get('unitId') || ''}`}
        leaseId={leaseId ? Number(leaseId) : null}
        initialPropertyId={Number(propertyId || searchParams.get('propertyId')) || null}
        initialUnitId={Number(unitId || searchParams.get('unitId')) || null} />
    </Box>
  </Box>;
}
