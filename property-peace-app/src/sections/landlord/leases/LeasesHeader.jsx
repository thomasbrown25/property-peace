import ManagementPageHeader from 'components/headers/ManagementPageHeader';

export default function LeasesHeader({ actions }) {
  return (
    <ManagementPageHeader
      title="Leases"
      description="Track lease terms, rent health, renewals, and agreements from one organized workspace."
      actions={actions}
    />
  );
}
