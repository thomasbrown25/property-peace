// Thin wrapper — delegates to useFetchTenants so both hooks share the same
// stale guard and Redux state. Kept for backward compatibility with existing callers.
import useFetchTenants from './useFetchTenants';

export default function useFetchAllTenants() {
  const { isLoading } = useFetchTenants();
  return { isLoading };
}
