using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ActionSuppressionService;
using brownstone_hub_api.Services.AICopilotService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.PercyActions;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.PercyActions;

public sealed class PercyTenantContactReadTests
{
    private const long OrganizationId = 930;
    private const long UserId = 931;

    [Fact]
    public void Policy_AllowsExplicitTenantContactReadForViewer()
    {
        PercyActionTypes.All.Should().Contain(PercyActionTypes.ReadTenantContacts);
        var decision = PercyActionPolicy.Evaluate(PercyActionTypes.ReadTenantContacts);

        decision.Should().BeEquivalentTo(new PercyActionDecision(
            PercyActionTypes.ReadTenantContacts,
            PercyActionCategory.ReadOnly,
            true,
            false,
            true,
            new OrganizationAuthorityRequirement(OrganizationRole.Viewer)));
        PercyActionPolicy.Authorize(PercyActionTypes.ReadTenantContacts,
            new OrganizationAuthorityFacts(OrganizationId, true, true, false),
            new OrganizationMembershipFacts(OrganizationId, MembershipState.Active, OrganizationRole.Viewer,
                "Viewer", Array.Empty<OrganizationPermission>())).IsAuthorized.Should().BeTrue();
    }

    [Fact]
    public void SourceBoundary_AcceptsOnlyCanonicalTenantContactRoute_AndOpaqueReferences()
    {
        var response = new PercyChatResponseDto
        {
            Sources =
            [
                new() { Kind = "tenant-contacts", Label = "Tenant contacts", WorkflowRoute = "/landlord/leases?tab=tenants", RecordReference = "tenant_0123456789abcdef0123456789abcdef", RetrievedAtUtc = DateTime.UtcNow },
                new() { Kind = "tenant-contacts", Label = "Wrong", WorkflowRoute = "/landlord/tenants", RecordReference = "tenant_43", RetrievedAtUtc = DateTime.UtcNow },
                new() { Kind = "tenant-contacts", Label = "Raw", WorkflowRoute = "/landlord/leases?tab=tenants", RecordReference = "44", RetrievedAtUtc = DateTime.UtcNow },
                new() { Kind = "tenant-contacts", Label = "Prefixed raw", WorkflowRoute = "/landlord/leases?tab=tenants", RecordReference = "tenant_42", RetrievedAtUtc = DateTime.UtcNow }
            ]
        };

        PercyDataBoundary.SanitizeResponse(response);

        response.Sources.Should().HaveCount(3);
        response.Sources[0].RecordReference.Should().Be("tenant_0123456789abcdef0123456789abcdef");
        response.Sources[1].RecordReference.Should().BeNull();
        response.Sources[2].RecordReference.Should().BeNull();
        response.Sources.Should().OnlyContain(source => source.WorkflowRoute == "/landlord/leases?tab=tenants");
    }

    [Fact]
    public async Task DirectoryRead_IsOrganizationScoped_ExcludesDeleted_AndReturnsStableBoundedOrder()
    {
        await using var db = Db();
        SeedAuthority(db);
        for (var index = 0; index < PercyDataBoundary.MaxItems + 3; index++)
            db.Tenants.Add(Tenant(100 + index, $"First{index:D2}", $"Last{10 - index:D2}", OrganizationId));
        db.Tenants.Add(Tenant(500, "Deleted", "Aardvark", OrganizationId, deleted: true));
        db.Tenants.Add(Tenant(501, "Other", "Aardvark", 999));
        await db.SaveChangesAsync();
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);

        var result = await Service(db, model.Object).ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "tenant-directory-bounded-001", Message = "Show my tenant contact directory" });

        result.Success.Should().BeTrue();
        result.Data!.Items.Should().HaveCount(PercyDataBoundary.MaxItems);
        result.Data.Items.Select(item => item.Title).Should().Equal(
            "First10 Last00", "First09 Last01", "First08 Last02", "First07 Last03",
            "First06 Last04", "First05 Last05", "First04 Last06", "First03 Last07");
        result.Data.Content.Should().Contain("first 8");
        result.Data.Content.Should().NotContainAny("Deleted", "Other");
        result.Data.Sources.Should().OnlyContain(source => source.Kind == "tenant-contacts");
        model.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task UniqueNameRead_ReturnsOnlyApprovedContactLocationAndActiveFields_WithOpaqueSourceRef()
    {
        await using var db = Db();
        SeedAuthority(db);
        var property = new Property { Id = 300, OrganizationId = OrganizationId, LandlordId = UserId, Name = "Maple Court", StreetAddress = "10 Maple Street" };
        var unit = new Unit { Id = 301, OrganizationId = OrganizationId, Property = property, Name = "2B" };
        var lease = new Lease { Id = 302, OrganizationId = OrganizationId, Unit = unit, IsActive = true };
        var tenant = Tenant(303, "Jane", "Doe", OrganizationId);
        tenant.Email = "jane.doe@example.test";
        tenant.PhoneNumber = "312-555-0101";
        tenant.Unit = unit;
        tenant.TenantLeases.Add(new TenantLease { Tenant = tenant, Lease = lease });
        db.Add(tenant);
        await db.SaveChangesAsync();
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);

        var result = await Service(db, model.Object).ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "tenant-contact-unique-001", Message = "What is Jane Doe's contact information?" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().ContainAll("Jane Doe", "jane.doe@example.test", "312-555-0101");
        result.Data.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new PercyResultItemDto
        {
            Title = "Jane Doe",
            Detail = "Maple Court · 2B · Active",
            Value = "jane.doe@example.test · 312-555-0101"
        });
        result.Data.Sources.Should().ContainSingle(source =>
            source.Kind == "tenant-contacts" &&
            source.WorkflowRoute == "/landlord/leases?tab=tenants");
        result.Data.Sources.Single().RecordReference.Should().MatchRegex("^tenant_[0-9a-f]{32}$");
        result.Data.Sources.Single().RecordReference.Should().NotContain("303");
        model.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task NamedRead_TakesPrecedenceOverDirectoryWords_AndReturnsOnlyTheRequestedTenant()
    {
        await using var db = Db();
        SeedAuthority(db);
        db.Tenants.AddRange(
            Tenant(320, "Jane", "Doe", OrganizationId),
            Tenant(321, "John", "Smith", OrganizationId));
        await db.SaveChangesAsync();
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);

        var result = await Service(db, model.Object).ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "tenant-contact-named-list-001", Message = "List the email for tenant Jane Doe" });

        result.Success.Should().BeTrue();
        result.Data!.Items.Should().ContainSingle().Which.Title.Should().Be("Jane Doe");
        result.Data.Content.Should().Contain("jane.doe@example.test", Exactly.Once());
        result.Data.Content.Should().NotContain("312-555-0199");
        result.Data.Content.Should().NotContain("John Smith");
        model.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task NamedRead_SupportsUnicodeTenantNames()
    {
        await using var db = Db();
        SeedAuthority(db);
        db.Tenants.Add(Tenant(330, "José", "Núñez", OrganizationId));
        await db.SaveChangesAsync();
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);

        var result = await Service(db, model.Object).ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "tenant-contact-unicode-001", Message = "Can you tell me José Núñez's phone number?" });

        result.Success.Should().BeTrue();
        result.Data!.Items.Should().ContainSingle().Which.Title.Should().Be("José Núñez");
        result.Data.Content.Should().Contain("312-555-0199");
        result.Data.Content.Should().NotContain("josé.núñez@example.test");
        model.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ContactRead_DoesNotExposeCrossOrganizationRelatedUnitPropertyOrLeaseState()
    {
        await using var db = Db();
        SeedAuthority(db);
        var foreignProperty = new Property { Id = 350, OrganizationId = 999, LandlordId = UserId, Name = "Foreign Property" };
        var foreignUnit = new Unit { Id = 351, OrganizationId = 999, Property = foreignProperty, Name = "Foreign Unit" };
        var foreignLease = new Lease { Id = 352, OrganizationId = 999, Unit = foreignUnit, IsActive = true };
        var tenant = Tenant(353, "Scoped", "Tenant", OrganizationId);
        tenant.Unit = foreignUnit;
        tenant.TenantLeases.Add(new TenantLease { Tenant = tenant, Lease = foreignLease });
        db.Add(tenant);
        await db.SaveChangesAsync();
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);

        var result = await Service(db, model.Object).ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "tenant-contact-related-scope-001", Message = "What is Scoped Tenant's contact information?" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().NotContainAny("Foreign Property", "Foreign Unit");
        result.Data.Items.Should().ContainSingle().Which.Detail.Should().Be("No active lease");
        model.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task AmbiguousNameRead_ListsCandidatesWithoutGuessing()
    {
        await using var db = Db();
        SeedAuthority(db);
        var first = Tenant(401, "Alex", "Adams", OrganizationId);
        first.Email = "alex.adams@example.test";
        var second = Tenant(402, "Alex", "Baker", OrganizationId);
        second.Email = "alex.baker@example.test";
        db.AddRange(first, second);
        await db.SaveChangesAsync();
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);

        var result = await Service(db, model.Object).ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "tenant-contact-ambiguous-001", Message = "What is tenant Alex's email?" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Contain("multiple tenants").And.Contain("Alex Adams").And.Contain("Alex Baker");
        result.Data.Items.Select(item => item.Title).Should().Equal("Alex Adams", "Alex Baker");
        model.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task NoMatchRead_IsTruthfulAndDoesNotCallAnswerModel()
    {
        await using var db = Db();
        SeedAuthority(db);
        db.Tenants.Add(Tenant(601, "Jane", "Doe", OrganizationId));
        await db.SaveChangesAsync();
        var model = new Mock<IOpenAIService>(MockBehavior.Strict);

        var result = await Service(db, model.Object).ChatAsync(OrganizationId, UserId,
            new PercyChatRequestDto { ClientRequestId = "tenant-contact-none-001", Message = "What is Morgan Reed's phone number?" });

        result.Success.Should().BeTrue();
        result.Data!.Content.Should().Be("I couldn't find a current tenant named Morgan Reed in this organization.");
        result.Data.Items.Should().BeEmpty();
        result.Data.Sources.Should().ContainSingle(source => source.Kind == "tenant-contacts" && source.RecordReference == null);
        model.VerifyNoOtherCalls();
    }

    private static Tenant Tenant(long id, string first, string last, long organizationId, bool deleted = false) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        Firstname = first,
        Lastname = last,
        Email = $"{first}.{last}@example.test".ToLowerInvariant(),
        PhoneNumber = "312-555-0199",
        IsDeleted = deleted
    };

    private static void SeedAuthority(DataContext db)
    {
        db.Organizations.AddRange(
            new Organization { Id = OrganizationId, Name = "Current Org", IsActive = true },
            new Organization { Id = 999, Name = "Other Org", IsActive = true });
        db.Users.Add(new User { Id = UserId, FirstName = "Percy", Email = "percy-tenant-contact@example.test" });
        db.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = OrganizationId,
            UserId = UserId,
            Role = "Viewer",
            IsActive = true
        });
    }

    private static DataContext Db() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"percy-tenant-contacts-{Guid.NewGuid()}", options => options.EnableNullChecks(false))
        .Options);

    private static AICopilotService Service(DataContext db, IOpenAIService model) => new(
        Mock.Of<IPropertyRepository>(),
        Mock.Of<ITenantRepository>(),
        Mock.Of<ILeaseRepository>(),
        Mock.Of<IPaymentRepository>(),
        Mock.Of<IMaintenanceRequestRepository>(),
        Mock.Of<IApplicationRepository>(),
        Mock.Of<IChecklistRepository>(),
        Mock.Of<IConversationRepository>(),
        Mock.Of<IActionSuppressionService>(),
        Mock.Of<IUserRepository>(),
        db,
        model,
        NullLogger<AICopilotService>.Instance);
}
