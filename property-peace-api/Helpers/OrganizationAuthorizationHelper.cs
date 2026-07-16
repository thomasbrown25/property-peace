using brownstone_hub_api.Repositories.Organizations;

namespace brownstone_hub_api.Helpers
{
    public static class OrganizationAuthorizationHelper
    {
        public static async Task<bool> UserCanAccessOrganizationAsync(
            IOrganizationMemberRepository memberRepository,
            long userId,
            long organizationId)
        {
            return await memberRepository.IsUserMemberOfOrganizationAsync(userId, organizationId);
        }

        public static async Task<bool> UserHasPermissionAsync(
            IOrganizationMemberRepository memberRepository,
            long userId,
            long organizationId,
            string permission)
        {
            return await memberRepository.UserHasPermissionAsync(userId, organizationId, permission);
        }

        public static async Task<bool> UserHasRoleAsync(
            IOrganizationMemberRepository memberRepository,
            long userId,
            long organizationId,
            string role)
        {
            return await memberRepository.UserHasRoleAsync(userId, organizationId, role);
        }
    }
}

