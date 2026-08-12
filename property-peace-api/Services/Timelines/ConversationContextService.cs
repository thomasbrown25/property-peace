using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Timeline;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.Timelines;

public sealed class ConversationContextService(DataContext context)
{
    public async Task<IReadOnlyList<ConversationContextLink>> AddLinksAsync(
        long organizationId,
        long conversationId,
        IReadOnlyCollection<ConversationContextTarget> targets,
        CancellationToken cancellationToken = default)
    {
        if (targets.Count == 0) throw new ArgumentException("At least one context target is required.");
        if (targets.Any(x => x.TargetCount != 1)) throw new ArgumentException("Each context link must have exactly one target.");
        if (!await context.Conversations.AnyAsync(x => x.Id == conversationId && x.OrganizationId == organizationId, cancellationToken))
            throw new KeyNotFoundException("Conversation not found");

        var resolved = new List<(ConversationContextTarget Target, long OrganizationId, long? PropertyId, long? UnitId)>();
        foreach (var target in targets)
        {
            var resolvedTarget = await ResolveAsync(target, cancellationToken);
            resolved.Add((target, resolvedTarget.OrganizationId, resolvedTarget.PropertyId, resolvedTarget.UnitId));
        }

        if (resolved.Any(x => x.OrganizationId != organizationId))
            throw new InvalidOperationException("Context target belongs to a different organization.");

        var propertyIds = resolved.Where(x => x.PropertyId.HasValue).Select(x => x.PropertyId!.Value).Distinct().ToList();
        if (propertyIds.Count > 1)
            throw new InvalidOperationException("Context targets do not share the same property hierarchy.");
        var explicitUnitIds = resolved.Where(x => x.Target.UnitId.HasValue).Select(x => x.Target.UnitId!.Value).Distinct().ToList();
        if (explicitUnitIds.Count > 1)
            throw new InvalidOperationException("Context targets do not share the same unit hierarchy.");
        if (explicitUnitIds.Count == 1 && resolved.Any(x => x.UnitId.HasValue && x.UnitId != explicitUnitIds[0]))
            throw new InvalidOperationException("Context targets do not share the same unit hierarchy.");

        var links = resolved.Select(x => new ConversationContextLink
        {
            OrganizationId = organizationId,
            ConversationId = conversationId,
            PropertyId = x.Target.PropertyId,
            UnitId = x.Target.UnitId,
            ListingId = x.Target.ListingId,
            LeadId = x.Target.LeadId,
            RentalApplicationId = x.Target.RentalApplicationId,
            LeaseId = x.Target.LeaseId,
            PaymentId = x.Target.PaymentId,
            MaintenanceRequestId = x.Target.MaintenanceRequestId
        }).ToList();
        context.ConversationContextLinks.AddRange(links);
        await context.SaveChangesAsync(cancellationToken);
        return links;
    }

    private async Task<(long OrganizationId, long? PropertyId, long? UnitId)> ResolveAsync(
        ConversationContextTarget target,
        CancellationToken cancellationToken)
    {
        if (target.PropertyId.HasValue)
        {
            var value = await context.Properties.Where(x => x.Id == target.PropertyId).Select(x => new { x.OrganizationId, PropertyId = (long?)x.Id }).SingleOrDefaultAsync(cancellationToken);
            return value?.OrganizationId is long org ? (org, value.PropertyId, null) : throw TargetNotFound();
        }
        if (target.UnitId.HasValue)
        {
            var value = await context.Units.Where(x => x.Id == target.UnitId).Select(x => new { x.OrganizationId, x.PropertyId, UnitId = (long?)x.Id }).SingleOrDefaultAsync(cancellationToken);
            return value?.OrganizationId is long org ? (org, value.PropertyId, value.UnitId) : throw TargetNotFound();
        }
        if (target.ListingId.HasValue)
        {
            var value = await context.Listings.Where(x => x.Id == target.ListingId).Select(x => new { x.OrganizationId, x.PropertyId, x.UnitId }).SingleOrDefaultAsync(cancellationToken);
            return value?.OrganizationId is long org ? (org, value.PropertyId, value.UnitId) : throw TargetNotFound();
        }
        if (target.LeadId.HasValue)
        {
            var value = await context.Leads.Where(x => x.Id == target.LeadId).Select(x => new { x.OrganizationId, x.PropertyId, x.UnitId }).SingleOrDefaultAsync(cancellationToken);
            return value == null ? throw TargetNotFound() : (value.OrganizationId, value.PropertyId, value.UnitId);
        }
        if (target.RentalApplicationId.HasValue)
        {
            var value = await context.RentalApplications.Where(x => x.Id == target.RentalApplicationId).Select(x => new { x.OrganizationId, x.PropertyId, x.UnitId }).SingleOrDefaultAsync(cancellationToken);
            return value?.OrganizationId is long org ? (org, value.PropertyId, value.UnitId) : throw TargetNotFound();
        }
        if (target.LeaseId.HasValue)
        {
            var value = await context.Leases.Where(x => x.Id == target.LeaseId).Select(x => new { x.OrganizationId, x.UnitId, x.Unit.PropertyId }).SingleOrDefaultAsync(cancellationToken);
            return value?.OrganizationId is long org ? (org, value.PropertyId, value.UnitId) : throw TargetNotFound();
        }
        if (target.PaymentId.HasValue)
        {
            var value = await context.Payments.Where(x => x.Id == target.PaymentId).Select(x => new { x.OrganizationId, x.PropertyId, x.Lease.UnitId }).SingleOrDefaultAsync(cancellationToken);
            return value?.OrganizationId is long org ? (org, value.PropertyId, value.UnitId) : throw TargetNotFound();
        }
        if (target.MaintenanceRequestId.HasValue)
        {
            var value = await context.MaintenanceRequests.Where(x => x.Id == target.MaintenanceRequestId).Select(x => new { x.OrganizationId, x.PropertyId, x.UnitId }).SingleOrDefaultAsync(cancellationToken);
            return value?.OrganizationId is long org ? (org, value.PropertyId, value.UnitId) : throw TargetNotFound();
        }
        throw new ArgumentException("Each context link must have exactly one target.");
    }

    private static KeyNotFoundException TargetNotFound() => new("Context target not found or has no organization.");
}
