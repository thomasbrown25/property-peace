using System.Text.RegularExpressions;
using Xunit;

namespace brownstone_hub_api.Tests.Activation;

public sealed class TenantInviteSecurityContractTests
{
    private static string ReadSource(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(new[] { current.FullName }.Concat(segments).ToArray());
            if (File.Exists(candidate)) return File.ReadAllText(candidate);
            current = current.Parent;
        }
        throw new FileNotFoundException(string.Join(Path.DirectorySeparatorChar, segments));
    }

    [Fact]
    public void ManagementEndpointsRequireValidatedNumericUserAndOrganizationContext()
    {
        var source = ReadSource("property-peace-api", "Controllers", "TenantInviteController.cs");
        Assert.Contains("TryGetValidatedManagementContext", source, StringComparison.Ordinal);
        Assert.Contains("HttpContext.Items.TryGetValue(\"UserId\"", source, StringComparison.Ordinal);
        Assert.Contains("HttpContext.Items.TryGetValue(\"OrganizationId\"", source, StringComparison.Ordinal);
        Assert.DoesNotMatch(new Regex(@"CreateInvite\(invite\)"), source);
        Assert.Contains("CreateInvite(invite, userId, organizationId)", source, StringComparison.Ordinal);
        Assert.Contains("GetInvitesByTenantId(tenantId, userId, organizationId)", source, StringComparison.Ordinal);
    }

    [Fact]
    public void InviteCreationIsPermissionOrganizationAndStoredEmailScoped()
    {
        var source = ReadSource("property-peace-api", "Services", "TenantInviteService", "TenantInviteService.cs");
        Assert.Contains("CanManageTenantsAsync(userId, organizationId)", source, StringComparison.Ordinal);
        Assert.Contains("t.Id == invite.TenantId && t.OrganizationId == organizationId && !t.IsDeleted", source, StringComparison.Ordinal);
        Assert.Contains("string.Equals(tenant.Email.Trim(), invite.Email.Trim(), StringComparison.OrdinalIgnoreCase)", source, StringComparison.Ordinal);
        Assert.Contains("CreateInvite(invite, userId, organizationId, token", source, StringComparison.Ordinal);
        Assert.Contains("if (!await SendInviteEmailAsync(created, token))", source, StringComparison.Ordinal);
        Assert.Contains("DeleteInvite(created.Id)", source, StringComparison.Ordinal);
    }

    [Fact]
    public void ManagementResponsesAndLogsDoNotExposeBearerTokens()
    {
        var source = ReadSource("property-peace-api", "Services", "TenantInviteService", "TenantInviteService.cs");
        Assert.Contains("SanitizeManagementInvite", source, StringComparison.Ordinal);
        Assert.DoesNotMatch(new Regex(
            @"_logger\.Log(?:Trace|Debug|Information|Warning|Error|Critical)\s*\([^;]*(?:InviteToken|\{Token\})",
            RegexOptions.Singleline | RegexOptions.IgnoreCase), source);
        Assert.DoesNotContain("CreateError(\"Error validating invite\", ex.Message)", source, StringComparison.Ordinal);
        Assert.DoesNotContain("CreateError(\"Error accepting invite\", ex.Message)", source, StringComparison.Ordinal);
        Assert.DoesNotMatch(new Regex(
            @"_logger\.Log(?:Trace|Debug|Information|Warning|Error|Critical)\s*\([^;]*(?:\{Email\}|\{InviteEmail\}|\{UserEmail\})",
            RegexOptions.Singleline | RegexOptions.IgnoreCase), source);
    }

    [Fact]
    public void LeaseMutationFamilyRequiresSelectedOrganizationPermissionAndScopedTargets()
    {
        var service = ReadSource("property-peace-api", "Services", "LeaseService", "LeaseService.cs");
        var controller = ReadSource("property-peace-api", "Controllers", "LeaseController.cs");

        foreach (var method in new[] { "CompleteDraft", "SetMoveInReportTemplateCompletedAt", "DeleteLease", "EndLease", "ReopenLease" })
        {
            var start = service.IndexOf($" {method}(", StringComparison.Ordinal);
            Assert.True(start >= 0, $"{method} must exist");
            var end = service.IndexOf("\n        public ", start + 1, StringComparison.Ordinal);
            var body = service[start..(end < 0 ? service.Length : end)];
            Assert.Contains("HasOrganizationPermissionAsync(organizationId.Value, tenantPermission: false)", body, StringComparison.Ordinal);
            Assert.Contains("GetLeaseById", body, StringComparison.Ordinal);
        }

        Assert.Contains("OrganizationMembers.AsNoTracking().AnyAsync", controller, StringComparison.Ordinal);
        Assert.Contains("la.Lease.Unit.Property.OrganizationId == organizationId", controller, StringComparison.Ordinal);
        Assert.DoesNotContain("error = ex.Message", controller, StringComparison.Ordinal);
    }

    [Fact]
    public void ESignatureMutationEndpointsRequireLeaseManagementPermission()
    {
        var controller = ReadSource("property-peace-api", "Controllers", "LeaseController.cs");
        Assert.Contains("RequireLeaseManagementPermissionAsync", controller, StringComparison.Ordinal);
        foreach (var method in new[] { "SignLandlordOnly", "SendLeaseForSignature", "CancelLeaseSignature", "SyncSignatureStatus", "ResendLeaseSignature" })
        {
            var start = controller.IndexOf($" {method}(", StringComparison.Ordinal);
            Assert.True(start >= 0, $"{method} must exist");
            var end = controller.IndexOf("\n        [Authorize", start + 1, StringComparison.Ordinal);
            var body = controller[start..(end < 0 ? controller.Length : end)];
            Assert.Contains("RequireLeaseManagementPermissionAsync", body, StringComparison.Ordinal);
        }

        var service = ReadSource("property-peace-api", "Services", "LeaseService", "LeaseService.cs");
        var syncStart = service.IndexOf("private async Task<ServiceResponse<SyncSignatureStatusResultDto>> SyncLeaseSignatureStatusCoreAsync(", StringComparison.Ordinal);
        Assert.True(syncStart >= 0, "signature sync core must exist");
        var syncEnd = service.IndexOf("\n        private ", syncStart + 1, StringComparison.Ordinal);
        var syncBody = service[syncStart..(syncEnd < 0 ? service.Length : syncEnd)];
        Assert.DoesNotContain("ex.Message", syncBody, StringComparison.Ordinal);
        Assert.DoesNotContain("ex.InnerException", syncBody, StringComparison.Ordinal);
    }

    [Fact]
    public void LeaseAddedNotificationRequiresPermissionAndExactTenantLeaseOrganizationRelationship()
    {
        var service = ReadSource("property-peace-api", "Services", "LeaseService", "LeaseService.cs");
        Assert.Contains("HasOrganizationPermissionAsync(organizationId.Value, tenantPermission: true)", service, StringComparison.Ordinal);
        Assert.Contains("t.OrganizationId == organizationId.Value", service, StringComparison.Ordinal);
        Assert.Contains("t.TenantLeases.Any(tl => tl.LeaseId == leaseId)", service, StringComparison.Ordinal);
    }

    [Fact]
    public void InviteOrganizationProvenanceIsPersistedAndEnforced()
    {
        var service = ReadSource("property-peace-api", "Services", "TenantInviteService", "TenantInviteService.cs");
        var repository = ReadSource("property-peace-api", "Repositories", "Tenants", "TenantInviteRepository.cs");
        Assert.Contains("OrganizationId = organizationId", repository, StringComparison.Ordinal);
        Assert.Contains("GetInviteById(inviteId, organizationId)", service, StringComparison.Ordinal);
        Assert.Contains("invite.OrganizationId != organizationId", service, StringComparison.Ordinal);
        Assert.Contains("invite.OrganizationId <= 0", service, StringComparison.Ordinal);
        Assert.Contains("m.Organization.IsActive && !m.Organization.IsDeleted", service, StringComparison.Ordinal);
    }
}
