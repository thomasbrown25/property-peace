import { Navigate } from 'react-router-dom';

// Milestone 13 consolidates Wren AI into the canonical maintenance workflow. The
// legacy automation settings surface is retired rather than presenting controls
// that are unavailable under the fail-closed Wren AI action policy.
export default function MaintenanceAgentPage() {
  return <Navigate to="/landlord/maintenances" replace />;
}
