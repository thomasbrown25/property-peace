import { Navigate } from 'react-router-dom';

// Milestone 13 consolidates Percy into the canonical maintenance workflow. The
// legacy automation settings surface is retired rather than presenting controls
// that are unavailable under the fail-closed Percy action policy.
export default function MaintenanceAgentPage() {
  return <Navigate to="/landlord/maintenances" replace />;
}
