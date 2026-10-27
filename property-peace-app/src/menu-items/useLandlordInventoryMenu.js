import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useAuth from 'hooks/useAuth';
import { useOrganization } from 'contexts/OrganizationContext';
import { getProperties } from 'store/property/property.action';
import { selectProperties, selectPropertiesLoadedAt, selectPropertiesOrganizationId } from 'store/property/property.selector';
import { isShortTermOnlyPortfolio } from './landlordInventory';

const STALE_MS = 5 * 60 * 1000;

export default function useLandlordInventoryMenu(enabled) {
  const dispatch = useDispatch();
  const { user, isLoggedIn } = useAuth();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const properties = useSelector(selectProperties);
  const loadedAt = useSelector(selectPropertiesLoadedAt);
  const loadedOrganizationId = useSelector(selectPropertiesOrganizationId);

  useEffect(() => {
    if (!enabled || !isLoggedIn || !user?.id || !organizationId) return;
    if (String(loadedOrganizationId) === String(organizationId) && loadedAt && Date.now() - loadedAt < STALE_MS) return;
    dispatch(getProperties(organizationId));
  }, [enabled, isLoggedIn, user?.id, organizationId, loadedOrganizationId, loadedAt, dispatch]);

  return enabled && isShortTermOnlyPortfolio({ properties, organizationId, loadedOrganizationId, loadedAt });
}
