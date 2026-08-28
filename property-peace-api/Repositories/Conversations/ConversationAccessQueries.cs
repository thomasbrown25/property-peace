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

    public static IQueryable<Conversation> WhereActiveParticipantOrSupport(
        this IQueryable<Conversation> conversations,
        IQueryable<OrganizationMember> organizationMembers,
        IQueryable<Tenant> tenants,
        IQueryable<SupportAndFeedback> supportTickets,
        long userId) => conversations.Where(c =>
            c.OrganizationId != null &&
            c.Participants.Any(participant => participant.UserId == userId && !participant.IsDeleted) &&
            (supportTickets.Any(ticket =>
                 ticket.ConversationId == c.Id &&
                 (ticket.UserId == userId || c.Participants.Any(participant =>
                     participant.UserId == userId &&
                     !participant.User.IsDeleted &&
                     participant.User.UserRoles.Any(userRole => userRole.Role.RoleName.ToLower() == "admin")))) ||
             organizationMembers.Any(member =>
                 member.OrganizationId == c.OrganizationId &&
                 member.UserId == userId &&
                 member.IsActive &&
                 (member.Role == "Owner" || member.Role == "Manager" || member.Role == "Viewer")) ||
             tenants.Any(tenant =>
                 tenant.UserId == userId &&
                 !tenant.IsDeleted &&
                 tenant.OrganizationId == c.OrganizationId)));
}
