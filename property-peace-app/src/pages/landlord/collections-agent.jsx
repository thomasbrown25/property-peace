import { Navigate } from 'react-router-dom';

// Milestone 13 consolidates Percy into the canonical rent workflow. The legacy
// autonomous collections surface is retired so no browser path can bypass the
// server-owned Percy action policy and confirmation boundary.
export default function CollectionsAgentPage() {
  return <Navigate to="/landlord/leases" replace />;
}
