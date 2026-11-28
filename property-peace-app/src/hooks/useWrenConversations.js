import useSWR, { useSWRConfig } from 'swr';
import { aiFollowUpAPI } from 'api';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import { getCurrentOrganizationId, isAICenterScopeEligible } from 'utils/aiCenterScope';
import { getConversationId } from 'utils/propertySidebarConversations';

const emptyConversations = [];

export default function useWrenConversations() {
  const { user } = useAuth();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const userId = user?.id ?? user?.Id ?? user?.email ?? user?.Email;
  const organizationId = getCurrentOrganizationId(currentOrganization);
  const eligible = isAICenterScopeEligible({ userId, currentOrganization, organizationLoading });
  const key = eligible ? ['wren-conversations', String(userId), String(organizationId)] : null;
  const options = { headers: { 'X-Organization-Id': String(organizationId) } };
  const { mutate: mutateCache } = useSWRConfig();
  const { data, isLoading, error } = useSWR(
    key,
    async () => {
      const response = await aiFollowUpAPI.getConversations(false, options);
      return response.data ?? response.Data ?? response;
    },
    { shouldRetryOnError: false }
  );
  const mutate = (update) => mutateCache(key, update, { revalidate: false });

  const archive = async (id) => {
    await aiFollowUpAPI.archiveConversation(id, options);
    await mutate((items = []) => items.map((item) => (getConversationId(item) === id ? { ...item, isArchived: true } : item)));
    return { success: true };
  };

  return { conversations: data ?? emptyConversations, isLoading, error, mutate, archive };
}
