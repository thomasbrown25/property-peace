using System.Security.Claims;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.AttachmentAccess;

// The selected organization alone does not authorize a record: always resolve its parent
// and check the authenticated actor against that parent's real organization and property.
public sealed class AttachmentAccessService(DataContext db, IHttpContextAccessor contextAccessor)
{
    private (long UserId, long OrganizationId)? Actor()
    {
        var context = contextAccessor.HttpContext;
        var claim = context?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context?.User.FindFirst("userId")?.Value;
        if (context?.User.Identity?.IsAuthenticated != true || !long.TryParse(claim, out var userId) || userId <= 0 ||
            !context.Items.TryGetValue("OrganizationId", out var selected) || selected is not long organizationId || organizationId <= 0)
            return null;
        return (userId, organizationId);
    }

    public async Task<bool> CanAccessMaintenanceAsync(long requestId)
    {
        var actor = Actor();
        if (actor is null) return false;
        var (userId, orgId) = actor.Value;
        var request = await db.MaintenanceRequests.AsNoTracking().Where(r => r.Id == requestId &&
            r.OrganizationId == orgId && r.Property.OrganizationId == orgId && !r.Property.IsDeleted)
            .Select(r => new { r.PropertyId, r.SubmittedByUserId, r.SubmittedByTenantId, r.ConversationId, r.Id }).SingleOrDefaultAsync();
        if (request is null) return false;
        if (contextAccessor.HttpContext!.User.IsInRole("Tenant"))
            return request.SubmittedByUserId == userId ||
                request.SubmittedByUserId == null && request.SubmittedByTenantId != null &&
                    await db.Tenants.AnyAsync(t => t.Id == request.SubmittedByTenantId && t.UserId == userId && !t.IsDeleted && t.OrganizationId == orgId) ||
                request.SubmittedByUserId == null && request.SubmittedByTenantId == null &&
                    await db.Conversations.AnyAsync(c => (c.Id == request.ConversationId || c.MaintenanceRequestId == request.Id) &&
                        c.TenantId != null && db.Tenants.Any(t => t.Id == c.TenantId && t.UserId == userId && !t.IsDeleted && t.OrganizationId == orgId));
        if (!contextAccessor.HttpContext.User.IsInRole("Landlord") && !contextAccessor.HttpContext.User.IsInRole("Admin")) return false;
        return await db.OrganizationMembers.AnyAsync(m => m.OrganizationId == orgId && m.UserId == userId && m.IsActive &&
            (m.Role == "Owner" || m.Role == "Manager" && m.CanManageMaintenance ||
                db.Properties.Any(p => p.Id == request.PropertyId && p.LandlordId == userId)));
    }

    public async Task<bool> CanAccessExpenseAsync(long expenseId)
    {
        var actor = Actor();
        if (actor is null) return false;
        var (userId, orgId) = actor.Value;
        if (!contextAccessor.HttpContext!.User.IsInRole("Landlord") && !contextAccessor.HttpContext.User.IsInRole("Admin")) return false;
        return await db.Expenses.AsNoTracking().AnyAsync(e => e.Id == expenseId && e.OrganizationId == orgId &&
            e.Property.OrganizationId == orgId && !e.Property.IsDeleted &&
            db.OrganizationMembers.Any(m => m.OrganizationId == orgId && m.UserId == userId && m.IsActive &&
                (m.Role == "Owner" || m.Role == "Manager" && m.CanManageBilling || e.Property.LandlordId == userId)));
    }

    public async Task<bool> CanAccessMaintenanceImageAsync(long imageId)
    {
        var refId = await db.MaintenanceImages.AsNoTracking().Where(x => x.Id == imageId).Select(x => (long?)x.RefId).SingleOrDefaultAsync();
        return refId.HasValue && await CanAccessMaintenanceAsync(refId.Value);
    }

    public async Task<bool> CanAccessExpenseReceiptAsync(long receiptId)
    {
        var refId = await db.ExpenseReceipts.AsNoTracking().Where(x => x.Id == receiptId).Select(x => (long?)x.RefId).SingleOrDefaultAsync();
        return refId.HasValue && await CanAccessExpenseAsync(refId.Value);
    }

    public async Task<bool> CanAccessMaintenanceBlobAsync(string blobName)
    {
        var refId = await db.MaintenanceImages.AsNoTracking().Where(x => x.BlobName == blobName).Select(x => (long?)x.RefId).SingleOrDefaultAsync();
        return refId.HasValue && await CanAccessMaintenanceAsync(refId.Value);
    }

    public async Task<bool> CanAccessExpenseBlobAsync(string blobName)
    {
        var refId = await db.ExpenseReceipts.AsNoTracking().Where(x => x.BlobName == blobName).Select(x => (long?)x.RefId).SingleOrDefaultAsync();
        return refId.HasValue && await CanAccessExpenseAsync(refId.Value);
    }
}
