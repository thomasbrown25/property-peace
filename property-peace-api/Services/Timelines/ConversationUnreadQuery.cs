using brownstone_hub_api.Data;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.Timelines;

/// <summary>Unread activity is incoming to the reader, not an organization-sent follow-up.</summary>
public static class ConversationUnreadQuery
{
    public static IQueryable<ConversationTimelineEntry> ForReader(
        this IQueryable<ConversationTimelineEntry> entries, DataContext db,
        long organizationId, long userId, bool isStaff, long lastReadSequence)
    {
        var unread = entries.Where(entry => entry.Sequence > lastReadSequence &&
            (!entry.ActorUserId.HasValue || entry.ActorUserId.Value != userId));
        if (isStaff)
        {
            // Legacy notification attempts may not have an actor. They are outbound activity,
            // not a new resident message for staff. Other staff members' sends are outbound too.
            unread = unread.Where(entry =>
                (entry.Producer != "notification-service" ||
                 (entry.Kind != TimelineEntryKind.Reminder && entry.Kind != TimelineEntryKind.PercyFollowUp)) &&
                !db.OrganizationMembers.Any(member => member.OrganizationId == organizationId &&
                    member.IsActive && member.UserId == entry.ActorUserId));
        }
        return unread;
    }
}
