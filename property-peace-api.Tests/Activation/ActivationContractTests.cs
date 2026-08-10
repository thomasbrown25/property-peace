using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Activation;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Activation;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Activation;

public sealed class ActivationContractTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 20, 0, 0, TimeSpan.Zero);
    private static readonly string[] CoreKeys =
    [
        "account", "organization", "property-unit", "listing-application", "lease",
        "tenant-invite", "rent-readiness", "communication"
    ];

    [Fact]
    public async Task Evaluate_ReturnsCanonicalSafeContract_FromCurrentOrganizationEvidenceOnly()
    {
        await using var db = Context();
        SeedMembership(db, userId: 1, organizationId: 10, role: "Owner");
        SeedMembership(db, userId: 2, organizationId: 20, role: "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        var foreignProperty = AddProperty(db, 200, 20, 2);
        var foreignUnit = AddUnit(db, 201, 200, 20, foreignProperty);
        AddConfiguredLease(db, 300, 201, 20, foreignUnit, tenantId: 400);
        db.TenantInvites.Add(new TenantInvite
        {
            Id = 500, TenantId = 400, OrganizationId = 20, Email = "foreign@example.test",
            InviteToken = "secret", ExpiresAt = Now.UtcDateTime.AddDays(1), CreatedBy = 2
        });
        db.Messages.Add(new Message
        {
            Id = 600, ConversationId = 601, OrganizationId = 20, SenderId = 2,
            Content = "secret foreign message", Conversation = new Conversation
            {
                Id = 601, OrganizationId = 20, LandlordId = 2, Title = "foreign"
            }
        });
        db.Messages.Add(new Message
        {
            Id = 610, ConversationId = 611, OrganizationId = 10, SenderId = 1, Content = "",
            Conversation = new Conversation
            {
                Id = 611, OrganizationId = 10, LandlordId = 1, Title = "empty conversation"
            }
        });
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            Id = 620, UserId = 2, StripeAccountId = "acct_foreign",
            ApprovedOrganizationId = 20, Status = StripePayeeReviewStatus.PayoutApproved,
            ApprovedAt = Now, PropertyAuthorityAttested = true, StripeDetailsSubmitted = true,
            StripePayoutsEnabled = true, StripeTransfersActive = true,
            StripeTransferCapabilityStatus = "active", LastStripeSnapshotAt = Now
        });
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10, default);

        result.OrganizationId.Should().Be(10);
        result.Role.Should().Be("Owner");
        result.EvaluatedAt.Should().Be(Now);
        result.Steps.Select(x => x.Key).Should().Equal(CoreKeys);
        result.Progress.Total.Should().Be(8);
        result.Progress.Completed.Should().Be(3); // account, organization, property-unit
        result.Steps.SelectMany(x => x.Evidence.Values).Should().OnlyContain(v => v || !v);
        result.Steps.Single(x => x.Key == "property-unit").Evidence.Should().BeEquivalentTo(
            new Dictionary<string, bool> { ["hasProperty"] = true, ["hasUnit"] = true });
        result.Steps.Single(x => x.Key == "lease").Evidence["hasLease"].Should().BeFalse(
            "another organization's lease must never count");
        result.Steps.Single(x => x.Key == "tenant-invite").Evidence["inviteSent"].Should().BeFalse();
        result.Steps.Single(x => x.Key == "communication").Evidence["hasCommunication"].Should().BeFalse();
        result.Steps.Single(x => x.Key == "rent-readiness").Evidence["paymentSetupCompleted"].Should().BeFalse();
        result.Steps.SelectMany(x => x.Evidence.Keys).Should().NotContain(k =>
            k.Contains("amount", StringComparison.OrdinalIgnoreCase) ||
            k.Contains("stripeId", StringComparison.OrdinalIgnoreCase) ||
            k.Contains("content", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Evaluate_SerializesExactFrontendWireContract_WithOnlySafeScopedContextIdentifiers()
    {
        await using var db = Context();
        SeedMembership(db, userId: 1, organizationId: 10, role: "Owner");
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10, default);
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        var root = json.RootElement;

        root.EnumerateObject().Select(x => x.Name).Should().Equal(
            "organizationId", "role", "evaluatedAt", "context", "progress", "steps");
        root.GetProperty("organizationId").GetInt64().Should().Be(10);
        root.GetProperty("role").GetString().Should().Be("Owner");
        root.GetProperty("progress").EnumerateObject().Select(x => x.Name).Should().Equal("completed", "total");
        root.GetProperty("context").EnumerateObject().Select(x => x.Name).Should().Equal(
            "propertyId", "unitId", "listingId", "applicationId", "leaseId", "tenantId");
        root.GetProperty("context").EnumerateObject().Should().OnlyContain(x => x.Value.ValueKind == JsonValueKind.Null);

        var identifierFields = root.GetProperty("steps").EnumerateArray()
            .SelectMany(step => step.EnumerateObject())
            .Where(property => property.Name.EndsWith("Id", StringComparison.OrdinalIgnoreCase))
            .Select(property => property.Name);
        identifierFields.Should().BeEmpty("steps and evidence may expose only safe boolean evidence");
        root.GetProperty("steps").EnumerateArray()
            .SelectMany(step => step.GetProperty("evidence").EnumerateObject())
            .Should().OnlyContain(property => property.Value.ValueKind == JsonValueKind.True
                || property.Value.ValueKind == JsonValueKind.False);
    }

    [Fact]
    public async Task Evaluate_UsesConstrainedLegacyParentFallback_AndOccupiedLeaseMakesListingNotApplicable()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, null, property);
        unit.IsOccupied = true;
        var lease = AddConfiguredLease(db, 300, 101, null, unit, tenantId: 400);
        db.TenantInvites.Add(new TenantInvite
        {
            Id = 500, TenantId = 400, OrganizationId = null, Email = "tenant@example.test",
            InviteToken = "secret", ExpiresAt = Now.UtcDateTime.AddDays(1), CreatedBy = 1,
            Tenant = lease.TenantLeases.Single().Tenant
        });
        db.Messages.Add(new Message
        {
            Id = 600, ConversationId = 601, OrganizationId = null, SenderId = 1, Content = "hello",
            Conversation = new Conversation
            {
                Id = 601, OrganizationId = 10, LandlordId = 1, Title = "tenant",
                PropertyId = 100, LeaseId = 300, TenantId = 400
            }
        });
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10, default);

        var listing = result.Steps.Single(x => x.Key == "listing-application");
        listing.Status.Should().Be("notApplicable");
        listing.Complete.Should().BeTrue();
        listing.Evidence.Should().ContainKey("occupiedPath").WhoseValue.Should().BeTrue();
        result.Steps.Single(x => x.Key == "lease").Evidence.Should().BeEquivalentTo(
            new Dictionary<string, bool> { ["hasLease"] = true, ["leaseConfigured"] = true });
        result.Steps.Single(x => x.Key == "tenant-invite").Status.Should().Be("complete");
        result.Steps.Single(x => x.Key == "tenant-invite").Evidence.Should().BeEquivalentTo(
            new Dictionary<string, bool> { ["tenantAssigned"] = true, ["inviteSent"] = false, ["inviteAccepted"] = false });
        result.Steps.Single(x => x.Key == "communication").Complete.Should().BeTrue();
        result.Steps.Single(x => x.Key == "rent-readiness").Complete.Should().BeTrue(
            "a configured durable rent schedule is core; online payments are optional");
    }

    [Fact]
    public async Task Evaluate_ReportsTruthfulPersistedPaymentReadiness_WithoutBlockingCore()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        db.Users.Local.Single().StripeAccountId = "acct_must_not_leak";
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        AddConfiguredLease(db, 300, 101, 10, unit, 400);
        db.StripeConnectedPayeeReviews.Add(new StripeConnectedPayeeReview
        {
            Id = 700, UserId = 1, StripeAccountId = "acct_must_not_leak",
            ApprovedOrganizationId = 10, Status = StripePayeeReviewStatus.PayoutApproved,
            ApprovedAt = Now, PropertyAuthorityAttested = true, StripeDetailsSubmitted = true,
            StripePayoutsEnabled = true, StripeTransfersActive = true,
            StripeTransferCapabilityStatus = "active", LastStripeSnapshotAt = Now,
            CurrentlyDueRequirementCount = 0, PastDueRequirementCount = 0,
            ExternalAccountFingerprint = "persisted-fingerprint"
        });
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10, default);
        var rent = result.Steps.Single(x => x.Key == "rent-readiness");

        rent.Evidence.Should().BeEquivalentTo(new Dictionary<string, bool>
        {
            ["rentScheduleConfigured"] = true,
            ["manualTrackingConfigured"] = false,
            ["paymentSetupCompleted"] = true,
            ["currentlyReady"] = true
        });
        rent.Complete.Should().BeTrue();
        rent.Status.Should().Be("complete");

        db.StripeConnectedPayeeReviews.Local.Single().ExternalAccountFingerprint = null;
        await db.SaveChangesAsync();
        var missingExternalAccount = await Service(db).EvaluateAsync(1, 10, default);
        missingExternalAccount.Steps.Single(x => x.Key == "rent-readiness").Evidence["currentlyReady"].Should().BeFalse(
            "approval without the strongest persisted external-account evidence is not current readiness");

        db.StripeConnectedPayeeReviews.Local.Single().ExternalAccountFingerprint = "persisted-fingerprint";
        db.StripeConnectedPayeeReviews.Local.Single().LastStripeSnapshotAt = Now.AddMinutes(-6);
        await db.SaveChangesAsync();
        var stale = await Service(db).EvaluateAsync(1, 10, default);
        stale.Steps.Single(x => x.Key == "rent-readiness").Evidence["currentlyReady"].Should().BeFalse(
            "a stale provider snapshot is setup history, not truthful current readiness");

        db.Users.Local.Single().StripeAccountId = null;
        db.StripeConnectedPayeeReviews.Local.Single().LastStripeSnapshotAt = Now;
        await db.SaveChangesAsync();
        var unlinked = await Service(db).EvaluateAsync(1, 10, default);
        unlinked.Steps.Single(x => x.Key == "rent-readiness").Evidence.Should().Contain(new Dictionary<string, bool>
        {
            ["paymentSetupCompleted"] = false,
            ["currentlyReady"] = false
        }, "a removed or unlinked stale payee is not optional Stripe readiness");
    }

    [Fact]
    public async Task Evaluate_TreatsNullAccountFieldsAsIncomplete_InsteadOfThrowing()
    {
        await using var db = Context(enableNullChecks: false);
        SeedMembership(db, 1, 10, "Owner");
        var user = db.Users.Local.Single();
        user.FirstName = null!;
        user.LastName = null!;
        user.Email = null!;
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10, default);

        var account = result.Steps.Single(x => x.Key == "account");
        account.Complete.Should().BeFalse();
        account.Evidence.Should().BeEquivalentTo(
            new Dictionary<string, bool> { ["identityPresent"] = false });
    }

    [Theory]
    [InlineData("Viewer", false, true)]
    [InlineData("Manager", false, true)]
    [InlineData("ManagerWithPermission", true, false)]
    public async Task Evaluate_SharesCompletion_ButDerivesActionabilityFromMembershipPermissions(
        string roleCase, bool expectedActionable, bool expectedOwnerActionRequired)
    {
        await using var db = Context();
        var role = roleCase == "ManagerWithPermission" ? "Manager" : roleCase;
        SeedMembership(db, 1, 10, role, canManageProperties: roleCase == "ManagerWithPermission");
        await db.SaveChangesAsync();

        var step = (await Service(db).EvaluateAsync(1, 10, default)).Steps
            .Single(x => x.Key == "property-unit");

        step.Complete.Should().BeFalse();
        step.Actionable.Should().Be(expectedActionable);
        step.OwnerActionRequired.Should().Be(expectedOwnerActionRequired);
    }

    [Fact]
    public async Task Evaluate_RentReadinessUsesLeasePermission_AndRedactsPaymentEvidence()
    {
        await using var leaseManagerDb = Context();
        SeedMembership(leaseManagerDb, 1, 10, "Manager", canManageLeases: true, canManageBilling: false);
        await leaseManagerDb.SaveChangesAsync();

        var leaseManagerRent = (await Service(leaseManagerDb).EvaluateAsync(1, 10)).Steps
            .Single(x => x.Key == "rent-readiness");

        leaseManagerRent.Actionable.Should().BeTrue("lease authority controls the core rent-schedule action");
        leaseManagerRent.OwnerActionRequired.Should().BeFalse();
        leaseManagerRent.Evidence.Keys.Should().Equal("rentScheduleConfigured", "manualTrackingConfigured");
        leaseManagerRent.Evidence.Keys.Should().NotContain(["paymentSetupCompleted", "currentlyReady"],
            "payment-account state must be redacted without billing authority");

        await using var billingManagerDb = Context();
        SeedMembership(billingManagerDb, 2, 20, "Manager", canManageLeases: false, canManageBilling: true);
        await billingManagerDb.SaveChangesAsync();

        var billingManagerRent = (await Service(billingManagerDb).EvaluateAsync(2, 20)).Steps
            .Single(x => x.Key == "rent-readiness");

        billingManagerRent.Actionable.Should().BeFalse("billing authority alone cannot configure the core rent schedule");
        billingManagerRent.OwnerActionRequired.Should().BeTrue();
        billingManagerRent.Evidence.Keys.Should().Equal(
            "rentScheduleConfigured", "manualTrackingConfigured", "paymentSetupCompleted", "currentlyReady");
    }

    [Fact]
    public async Task Evaluate_ConfiguredLeaseWithoutTenant_DoesNotBypassVacancyStage()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        var lease = AddConfiguredLease(db, 300, 101, 10, unit, tenantId: 400);
        lease.TenantLeases.Clear();
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Steps.Single(x => x.Key == "listing-application").Status.Should().Be("incomplete");
        result.Steps.Single(x => x.Key == "listing-application").Evidence["occupiedPath"].Should().BeFalse();
        result.Steps.Single(x => x.Key == "tenant-invite").Complete.Should().BeFalse();
    }

    [Fact]
    public async Task Evaluate_InvitationExpiration_IgnoresExpiredUnusedButPreservesAcceptedHistory()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        var lease = AddConfiguredLease(db, 300, 101, 10, unit, 400);
        db.TenantInvites.Add(new TenantInvite
        {
            Id = 500, TenantId = 400, Tenant = lease.TenantLeases.Single().Tenant,
            OrganizationId = 10, Email = "tenant@example.test", InviteToken = "redacted",
            ExpiresAt = Now.UtcDateTime, CreatedBy = 1
        });
        await db.SaveChangesAsync();

        var expired = (await Service(db).EvaluateAsync(1, 10)).Steps.Single(x => x.Key == "tenant-invite");
        expired.Complete.Should().BeTrue("an authoritative lease assignment completes the tenant stage even when an invite expired");
        expired.Status.Should().Be("complete");
        expired.Evidence.Should().BeEquivalentTo(
            new Dictionary<string, bool> { ["tenantAssigned"] = true, ["inviteSent"] = false, ["inviteAccepted"] = false });

        var invite = db.TenantInvites.Local.Single();
        invite.IsUsed = true;
        invite.UsedAt = Now.UtcDateTime.AddDays(-1);
        invite.ExpiresAt = Now.UtcDateTime.AddDays(-2);
        await db.SaveChangesAsync();

        var accepted = (await Service(db).EvaluateAsync(1, 10)).Steps.Single(x => x.Key == "tenant-invite");
        accepted.Complete.Should().BeTrue("acceptance remains durable after token expiration");
        accepted.Status.Should().Be("complete");
        accepted.Evidence.Should().BeEquivalentTo(
            new Dictionary<string, bool> { ["tenantAssigned"] = true, ["inviteSent"] = true, ["inviteAccepted"] = true });
    }

    [Fact]
    public async Task Evaluate_FailsClosed_WhenOrganizationOrMembershipIsInactive()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        db.OrganizationMembers.Local.Single().IsActive = false;
        await db.SaveChangesAsync();

        var act = () => Service(db).EvaluateAsync(1, 10, default);

        await act.Should().ThrowAsync<ActivationAccessDeniedException>();
    }

    [Fact]
    public async Task Controller_RequiresNumericAuthenticatedUserAndValidatedOrganizationContext()
    {
        var service = new Mock<IActivationService>(MockBehavior.Strict);
        var controller = Controller(service.Object, "not-numeric", 10, 1);

        var badUser = await controller.Get(default);

        badUser.Result.Should().BeOfType<UnauthorizedResult>();
        service.VerifyNoOtherCalls();

        controller = Controller(service.Object, "1", null, 1);
        var missingOrg = await controller.Get(default);
        missingOrg.Result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        service.VerifyNoOtherCalls();

        typeof(ActivationController).GetCustomAttributes<AuthorizeAttribute>(true)
            .Should().ContainSingle(x => x.Roles == "Landlord,Admin");
        var cache = typeof(ActivationController).GetMethod(nameof(ActivationController.Get))!
            .GetCustomAttribute<ResponseCacheAttribute>();
        cache.Should().NotBeNull();
        cache!.NoStore.Should().BeTrue();
        cache.Location.Should().Be(ResponseCacheLocation.None);
        typeof(ActivationController).GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .SelectMany(x => x.GetParameters()).Select(x => x.Name)
            .Should().NotContain(x => x == "organizationId" || x == "landlordId");
    }

    [Fact]
    public async Task Evaluate_ConfiguredLeaseWithoutTenantLease_CompletesLeaseButLeavesTenantStageIncomplete()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        db.Leases.Add(new Lease
        {
            Id = 300, UnitId = unit.Id, Unit = unit, OrganizationId = 10,
            StartDate = Now.UtcDateTime.Date, EndDate = Now.UtcDateTime.Date.AddYears(1),
            RentAmount = 1200, RentDueDay = 1, RentFrequency = "Monthly"
        });
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Context.Should().Be(new ActivationContextDto(100, 101, null, null, 300, null));
        result.Steps.Single(x => x.Key == "lease").Complete.Should().BeTrue();
        result.Steps.Single(x => x.Key == "tenant-invite").Complete.Should().BeFalse();
    }

    [Fact]
    public async Task Scenario_CleanAccount_ReturnsOrderedIncompleteRentalChain()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Context.Should().Be(new ActivationContextDto(null, null, null, null, null, null));
        result.Steps.Select(x => x.Key).Should().Equal(CoreKeys);
        result.Steps.Take(2).Should().OnlyContain(x => x.Complete);
        result.Steps.Skip(2).Should().OnlyContain(x => !x.Complete);
    }

    [Fact]
    public async Task Scenario_SpreadsheetImportedPropertyAndUnit_ResumesAtDraftListingThenLease()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        db.Listings.Add(new Listing
        {
            Id = 200, PropertyId = 100, Property = property, UnitId = 101, Unit = unit,
            OrganizationId = 10, CreatedBy = 1, Status = EListingStatus.Draft
        });
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Context.Should().Be(new ActivationContextDto(100, 101, 200, null, null, null));
        result.Steps.Single(x => x.Key == "property-unit").Complete.Should().BeTrue();
        result.Steps.Single(x => x.Key == "listing-application").Complete.Should().BeFalse(
            "a draft listing is resumable context, not meaningful completion");
        result.Steps.Single(x => x.Key == "lease").Complete.Should().BeFalse();
    }

    [Fact]
    public async Task Scenario_DraftLease_IsResumableContextButDoesNotCompleteLeaseOrRent()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        db.Leases.Add(new Lease
        {
            Id = 300, UnitId = 101, Unit = unit, OrganizationId = 10,
            StartDate = Now.UtcDateTime.Date, RentAmount = 0m, RentDueDay = 0
        });
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Context.Should().Be(new ActivationContextDto(100, 101, null, null, 300, null));
        var leaseStep = result.Steps.Single(x => x.Key == "lease");
        leaseStep.Complete.Should().BeFalse();
        leaseStep.Evidence["hasLease"].Should().BeTrue();
        leaseStep.Evidence["leaseConfigured"].Should().BeFalse();
        result.Steps.Single(x => x.Key == "rent-readiness").Complete.Should().BeFalse();
    }

    [Fact]
    public async Task Scenario_UnrelatedRecordsAcrossSameOrganization_CannotManufactureCompletion()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var advertisedProperty = AddProperty(db, 100, 10, 1);
        var advertisedUnit = AddUnit(db, 101, 100, 10, advertisedProperty);
        db.Listings.Add(new Listing
        {
            Id = 200, PropertyId = 100, Property = advertisedProperty, UnitId = 101, Unit = advertisedUnit,
            OrganizationId = 10, CreatedBy = 1, Status = EListingStatus.Active
        });
        var occupiedProperty = AddProperty(db, 300, 10, 1);
        var occupiedUnit = AddUnit(db, 301, 300, 10, occupiedProperty);
        AddConfiguredLease(db, 400, 301, 10, occupiedUnit, 500);
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Context.PropertyId.Should().Be(300);
        result.Context.LeaseId.Should().Be(400);
        result.Context.ListingId.Should().BeNull();
        var leasingStep = result.Steps.Single(x => x.Key == "listing-application");
        leasingStep.Status.Should().Be("notApplicable",
            "a configured lease satisfies the occupied path without borrowing the other property's listing");
        leasingStep.Evidence["hasListing"].Should().BeFalse();
    }

    [Fact]
    public async Task Scenario_CoherentFullyActivatedOccupiedChain_CompletesAllStages()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        unit.IsOccupied = true;
        var lease = AddConfiguredLease(db, 300, 101, 10, unit, 400);
        var tenant = lease.TenantLeases.Single().Tenant;
        db.TenantInvites.Add(new TenantInvite
        {
            Id = 500, TenantId = 400, Tenant = tenant, OrganizationId = 10,
            Email = "tenant@example.test", InviteToken = "never-returned", ExpiresAt = Now.UtcDateTime.AddDays(1),
            IsUsed = true, UsedAt = Now.UtcDateTime, CreatedBy = 1
        });
        db.Messages.Add(new Message
        {
            Id = 600, ConversationId = 601, OrganizationId = 10, SenderId = 1, Content = "hello",
            Conversation = new Conversation
            {
                Id = 601, OrganizationId = 10, LandlordId = 1, PropertyId = 100,
                LeaseId = 300, TenantId = 400, Title = "canonical"
            }
        });
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Progress.Completed.Should().Be(8);
        result.Context.Should().Be(new ActivationContextDto(100, 101, null, null, 300, 400));
        result.Steps.Single(x => x.Key == "listing-application").Status.Should().Be("notApplicable");
        result.Steps.Single(x => x.Key == "tenant-invite").Evidence["inviteAccepted"].Should().BeTrue();
    }

    [Fact]
    public async Task Scenario_AcceptedInviteManagerAndViewer_ReceiveTruthfulRoleActionability()
    {
        await using var managerDb = Context();
        SeedMembership(managerDb, 1, 10, "Manager", canManageTenants: true);
        var property = AddProperty(managerDb, 100, 10, 1);
        var unit = AddUnit(managerDb, 101, 100, 10, property);
        var lease = AddConfiguredLease(managerDb, 300, 101, 10, unit, 400);
        managerDb.TenantInvites.Add(new TenantInvite
        {
            Id = 500, TenantId = 400, Tenant = lease.TenantLeases.Single().Tenant,
            OrganizationId = 10, Email = "tenant@example.test", InviteToken = "secret",
            ExpiresAt = Now.UtcDateTime.AddDays(1), IsUsed = true, UsedAt = Now.UtcDateTime, CreatedBy = 1
        });
        await managerDb.SaveChangesAsync();

        var manager = await Service(managerDb).EvaluateAsync(1, 10);
        manager.Steps.Single(x => x.Key == "tenant-invite").Status.Should().Be("complete");
        manager.Steps.Single(x => x.Key == "communication").Actionable.Should().BeTrue();

        await using var viewerDb = Context();
        SeedMembership(viewerDb, 2, 20, "Viewer");
        await viewerDb.SaveChangesAsync();
        var viewer = await Service(viewerDb).EvaluateAsync(2, 20);
        viewer.Steps.Skip(2).Should().OnlyContain(x => !x.Actionable && x.OwnerActionRequired);
    }

    [Fact]
    public async Task Scenario_ConflictingDirectOwnership_FailsClosedToSafeParentContext()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        AddUnit(db, 101, 100, 20, property);
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Context.Should().Be(new ActivationContextDto(100, null, null, null, null, null));
        result.Steps.Single(x => x.Key == "property-unit").Evidence["hasUnit"].Should().BeFalse();
    }

    [Fact]
    public async Task Evaluate_PrefersAuthoritativeTenantAssignmentOverStaleOccupiedFlag()
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var staleProperty = AddProperty(db, 100, 10, 1);
        var staleUnit = AddUnit(db, 101, 100, 10, staleProperty);
        staleUnit.IsOccupied = true;
        db.Leases.Add(new Lease
        {
            Id = 300, UnitId = 101, Unit = staleUnit, OrganizationId = 10, IsActive = true,
            StartDate = Now.UtcDateTime.Date, EndDate = Now.UtcDateTime.Date.AddYears(1),
            RentAmount = 1200m, RentDueDay = 1, RentFrequency = "Monthly"
        });

        var assignedProperty = AddProperty(db, 200, 10, 1);
        var assignedUnit = AddUnit(db, 201, 200, 10, assignedProperty);
        AddConfiguredLease(db, 400, 201, 10, assignedUnit, 500);
        await db.SaveChangesAsync();

        var result = await Service(db).EvaluateAsync(1, 10);

        result.Context.LeaseId.Should().Be(400);
        result.Context.TenantId.Should().Be(500);
        result.Steps.Single(x => x.Key == "listing-application").Status.Should().Be("notApplicable");
    }

    [Theory]
    [InlineData(false, 0)]
    [InlineData(true, 1)]
    public async Task Evaluate_InactiveOrFutureLease_DoesNotCompleteLeaseReadiness(bool isActive, int startOffsetDays)
    {
        await using var db = Context();
        SeedMembership(db, 1, 10, "Owner");
        var property = AddProperty(db, 100, 10, 1);
        var unit = AddUnit(db, 101, 100, 10, property);
        var lease = AddConfiguredLease(db, 300, 101, 10, unit, 400);
        lease.IsActive = isActive;
        lease.StartDate = Now.UtcDateTime.Date.AddDays(startOffsetDays);
        lease.EndDate = lease.StartDate.Value.AddYears(1);
        await db.SaveChangesAsync();

        var step = (await Service(db).EvaluateAsync(1, 10)).Steps.Single(x => x.Key == "lease");

        step.Complete.Should().BeFalse();
        step.Evidence["hasLease"].Should().BeTrue();
        step.Evidence["leaseConfigured"].Should().BeFalse();
    }

    private static ActivationController Controller(IActivationService service, string userClaim, long? organizationId, long? contextUserId)
    {
        var http = new DefaultHttpContext();
        http.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, userClaim), new Claim(ClaimTypes.Role, "Landlord")], "test"));
        if (organizationId.HasValue) http.Items["OrganizationId"] = organizationId.Value;
        if (contextUserId.HasValue) http.Items["UserId"] = contextUserId.Value;
        return new ActivationController(service)
        {
            ControllerContext = new ControllerContext { HttpContext = http }
        };
    }

    private static ActivationService Service(DataContext db) => new(db, new FixedTimeProvider(Now));

    private static DataContext Context(bool enableNullChecks = true) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase($"activation-{Guid.NewGuid()}", options => options.EnableNullChecks(enableNullChecks)).Options);

    private static void SeedMembership(DataContext db, long userId, long organizationId, string role,
        bool canManageProperties = false, bool canManageTenants = false,
        bool canManageLeases = false, bool canManageBilling = false)
    {
        var user = new User
        {
            Id = userId, FirstName = "Ada", LastName = "Owner", Email = $"u{userId}@example.test",
            CurrentOrganizationId = organizationId
        };
        var organization = new Organization { Id = organizationId, Name = $"Org {organizationId}" };
        db.Users.Add(user);
        db.Organizations.Add(organization);
        db.OrganizationMembers.Add(new OrganizationMember
        {
            Id = organizationId * 100 + userId, UserId = userId, OrganizationId = organizationId,
            User = user, Organization = organization, Role = role, IsActive = true,
            CanManageProperties = canManageProperties, CanManageTenants = canManageTenants,
            CanManageLeases = canManageLeases, CanManageBilling = canManageBilling
        });
    }

    private static Property AddProperty(DataContext db, long id, long organizationId, long landlordId)
    {
        var property = new Property
        {
            Id = id, OrganizationId = organizationId, LandlordId = landlordId, Name = $"P{id}",
            StreetAddress = "1 Test St", ContactEmail = "owner@example.test", ContactPhone = "555"
        };
        db.Properties.Add(property);
        return property;
    }

    private static Unit AddUnit(DataContext db, long id, long propertyId, long? organizationId, Property property)
    {
        var unit = new Unit
        {
            Id = id, PropertyId = propertyId, Property = property, OrganizationId = organizationId, Name = $"U{id}"
        };
        db.Units.Add(unit);
        return unit;
    }

    private static Lease AddConfiguredLease(DataContext db, long id, long unitId, long? organizationId,
        Unit unit, long tenantId)
    {
        var tenant = new Tenant
        {
            Id = tenantId, Firstname = "T", Lastname = "Tenant", UnitId = unitId,
            Unit = unit, OrganizationId = organizationId
        };
        var lease = new Lease
        {
            Id = id, UnitId = unitId, Unit = unit, OrganizationId = organizationId,
            StartDate = Now.UtcDateTime.Date, EndDate = Now.UtcDateTime.Date.AddYears(1),
            RentAmount = 1200m, RentDueDay = 1, RentFrequency = "Monthly"
        };
        lease.TenantLeases.Add(new TenantLease { LeaseId = id, Lease = lease, TenantId = tenantId, Tenant = tenant });
        db.AddRange(tenant, lease);
        return lease;
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
