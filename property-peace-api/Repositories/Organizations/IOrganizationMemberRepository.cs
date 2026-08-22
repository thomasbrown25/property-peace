using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Organizations
{
    public interface IOrganizationMemberRepository
    {
        Task<OrganizationMember?> GetMemberAsync(long organizationId, long userId);
        Task<OrganizationMember?> GetMemberByIdAsync(long memberId);
        Task<OrganizationMember?> GetMemberByMemberIdAsync(long organizationId, long memberId);
        Task<List<OrganizationMember>> GetMembersByOrganizationIdAsync(long organizationId);
        Task<List<OrganizationMember>> GetMembersByUserIdAsync(long userId);
        Task<OrganizationMember> AddMemberAsync(OrganizationMember member);
        Task<OrganizationMember> UpdateMemberAsync(OrganizationMember member);
        Task<bool> RemoveMemberAsync(long organizationId, long userId);
        Task<bool> RemoveMemberByIdAsync(long organizationId, long memberId);
        Task<OrganizationMemberRemovalResult> RemoveMemberAndRepairCurrentOrganizationAsync(long organizationId, long memberId);
        Task<bool> IsUserMemberOfOrganizationAsync(long userId, long organizationId);
        Task<bool> UserHasRoleAsync(long userId, long organizationId, string role);
        Task<bool> UserHasPermissionAsync(long userId, long organizationId, string permission);
        Task<OrganizationMember?> GetPendingMemberByEmailAsync(long organizationId, string email);
    }
}

