import { Navigate } from 'react-router-dom';

// Milestone 13 consolidates Wren AI into the canonical rent workflow. The legacy
// autonomous collections surface is retired so no browser path can bypass the
// server-owned Wren AI action policy and confirmation boundary.
export default function CollectionsAgentPage() {
  return <Navigate to="/landlord/leases" replace />;
}
