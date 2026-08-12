using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.Conversations;

public static class ConversationAccessQueries
{
    public static IQueryable<Conversation> WhereActiveParticipant(
        this IQueryable<Conversation> conversations,
        IQueryable<OrganizationMember> organizationMembers,
        IQueryable<Tenant> tenants,
        long userId) => conversations.Where(c =>
            c.OrganizationId != null &&
            c.Participants.Any(p => p.UserId == userId && !p.IsDeleted) &&
            (organizationMembers.Any(m =>
                 m.OrganizationId == c.OrganizationId &&
                 m.UserId == userId &&
                 m.IsActive &&
                 (m.Role == "Owner" || m.Role == "Manager" || m.Role == "Viewer")) ||
             tenants.Any(t =>
                 t.UserId == userId &&
                 !t.IsDeleted &&
                 t.OrganizationId == c.OrganizationId)));
}
