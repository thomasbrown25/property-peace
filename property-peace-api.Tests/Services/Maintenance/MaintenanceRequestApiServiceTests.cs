using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Maintenance;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Maintenance;
using brownstone_hub_api.Services.MaintenanceTriage;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Maintenance;

public sealed class MaintenanceRequestApiServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Create_TenantWithActiveLease_PersistsCanonicalTriageAndIgnoresServerOwnedInput()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, userId: 10, tenantId: 20, leaseId: 30, propertyId: 40, unitId: 50, organizationId: 60);
        await db.SaveChangesAsync();
        var service = CreateService(db, new MaintenanceActor(10, true, false));

        var result = await service.CreateAsync(new CreateMaintenanceRequestDto
        {
            PropertyId = 40, UnitId = 50, Title = "  Sink leak  ", Description = " Water is dripping ",
            Location = " Kitchen ", Signals = [MaintenanceSignal.NoRunningWater],
            PreferredWindows = [new(Now.AddDays(1), Now.AddDays(1).AddHours(2), "Call first")]
        });

        result.Code.Should().Be(MaintenanceApiResultCode.Success);
        result.Value!.Status.Should().Be(EMaintenanceStatus.Reported);
        result.Value.Urgency.Should().Be(MaintenanceUrgency.Urgent);
        result.Value.TriagePolicyVersion.Should().Be("maintenance-triage-v1");
        result.Value.LandlordSummary.Should().Be("URGENT | Location: Kitchen | Issue: Water is dripping | Signals: NoRunningWater | Missing: photos");
        result.Value.MissingInformation.Should().Equal("photos");
        result.Value.AcknowledgeByUtc.Should().Be(Now.AddHours(4));
        result.Value.ActionByUtc.Should().Be(Now.AddHours(24));
        var stored = await db.MaintenanceRequests.SingleAsync();
        stored.OrganizationId.Should().Be(60);
        stored.StopTroubleshooting.Should().BeFalse();
        stored.StructuredIntakeJson.Should().Contain("NoRunningWater");
        (await db.MaintenancePreferredWindows.SingleAsync()).AccessInstructions.Should().Be("Call first");
    }

    [Fact]
    public async Task Create_RequiresTenantActiveLeaseForExactPropertyAndUnit()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60, active: false);
        await db.SaveChangesAsync();
        var service = CreateService(db, new MaintenanceActor(10, true, false));

        var result = await service.CreateAsync(new CreateMaintenanceRequestDto { PropertyId = 40, UnitId = 50, Description = "Leak", Location = "Kitchen" });

        result.Code.Should().Be(MaintenanceApiResultCode.NotFound);
        db.MaintenanceRequests.Should().BeEmpty();
    }

    [Theory]
    [InlineData(ActorKind.Tenant, true)]
    [InlineData(ActorKind.Landlord, true)]
    [InlineData(ActorKind.TeamWithPermission, true)]
    [InlineData(ActorKind.TeamWithoutPermission, false)]
    [InlineData(ActorKind.AssignedVendorUser, true)]
    [InlineData(ActorKind.Other, false)]
    public async Task DetailRead_IsRequestScoped_AndInaccessibleIdsAreNotFound(ActorKind kind, bool allowed)
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        db.MaintenanceRequests.Add(Request(100, 40, 50, 60, assignedUserId: 70));
        db.Vendors.Add(new Vendor { Id = 700, LandlordId = 60_001, OrganizationId = 60, PortalUserId = 70, Name = "Vendor", IsActive = true });
        db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 60, UserId = kind is ActorKind.TeamWithPermission or ActorKind.TeamWithoutPermission ? 80 : 999, IsActive = true, CanManageMaintenance = kind == ActorKind.TeamWithPermission });
        await db.SaveChangesAsync();
        var actor = kind switch
        {
            ActorKind.Tenant => new MaintenanceActor(10, true, false),
            ActorKind.Landlord => new MaintenanceActor(60_001, false, true),
            ActorKind.TeamWithPermission or ActorKind.TeamWithoutPermission => new MaintenanceActor(80, false, false),
            ActorKind.AssignedVendorUser => new MaintenanceActor(70, false, false),
            _ => new MaintenanceActor(90, false, false)
        };
        // Property landlord ownership is represented by the real Property.LandlordId field.
        db.Properties.Single(x => x.Id == 40).LandlordId = 60_001;
        await db.SaveChangesAsync();

        var result = await CreateService(db, actor).GetAsync(100);

        result.Code.Should().Be(allowed ? MaintenanceApiResultCode.Success : MaintenanceApiResultCode.NotFound);
    }

    [Theory]
    [InlineData(ActorKind.Landlord, true)]
    [InlineData(ActorKind.TeamWithPermission, true)]
    [InlineData(ActorKind.TeamWithoutPermission, false)]
    [InlineData(ActorKind.Tenant, false)]
    [InlineData(ActorKind.AssignedVendorUser, false)]
    public async Task Acknowledge_AllowsOnlyPropertyLandlordOrMaintenanceManager(ActorKind kind, bool allowed)
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        db.ChangeTracker.Entries<Property>().Single(x => x.Entity.Id == 40).Entity.LandlordId = 61;
        db.MaintenanceRequests.Add(Request(100, 40, 50, 60, 70));
        db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 60, UserId = 80, IsActive = true, CanManageMaintenance = kind == ActorKind.TeamWithPermission });
        await db.SaveChangesAsync();
        var actor = kind switch
        {
            ActorKind.Landlord => new MaintenanceActor(61, false, true),
            ActorKind.TeamWithPermission or ActorKind.TeamWithoutPermission => new MaintenanceActor(80, false, false),
            ActorKind.Tenant => new MaintenanceActor(10, true, false),
            _ => new MaintenanceActor(70, false, false)
        };

        var result = await CreateService(db, actor).AcknowledgeAsync(100);

        result.Code.Should().Be(allowed ? MaintenanceApiResultCode.Success : MaintenanceApiResultCode.NotFound);
        (await db.MaintenanceRequests.FindAsync(100L))!.Status.Should().Be(allowed ? EMaintenanceStatus.Acknowledged : EMaintenanceStatus.Reported);
    }

    [Fact]
    public async Task Percy_IsTenantOnly_DeniesEmergency_AndNeverPersistsClientInstruction()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        var emergency = Request(100, 40, 50, 60); emergency.Urgency = MaintenanceUrgency.Emergency;
        db.MaintenanceRequests.Add(emergency);
        await db.SaveChangesAsync();

        var denied = await CreateService(db, new MaintenanceActor(10, true, false)).TroubleshootAsync(100,
            new PercyTroubleshootingCommandDto("cycle-a", "step-a", "check-gfci-reset", false, false, "Turn off the breaker and remove the panel"));

        denied.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        denied.Message.Should().Contain("emergency");
        db.MaintenanceTroubleshootingSteps.Should().BeEmpty();
    }

    [Fact]
    public async Task Percy_AllowlistIsDeterministic_IdempotentAndBoundedToThreePerCycle()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        db.MaintenanceRequests.Add(Request(100, 40, 50, 60));
        await db.SaveChangesAsync();
        var service = CreateService(db, new MaintenanceActor(10, true, false));

        var first = await service.TroubleshootAsync(100, new("cycle-a", "one", "check-thermostat-settings", false, false, "unsafe client text"));
        var replay = await service.TroubleshootAsync(100, new("cycle-a", "one", "check-gfci-reset", false, false, null));
        await service.TroubleshootAsync(100, new("cycle-a", "two", "check-gfci-reset", false, false, null));
        await service.TroubleshootAsync(100, new("cycle-a", "three", "check-faucet-aerator", false, false, null));
        var fourth = await service.TroubleshootAsync(100, new("cycle-a", "four", "check-thermostat-settings", false, false, null));
        var unsafeCode = await service.TroubleshootAsync(100, new("cycle-b", "x", "remove-electrical-panel", false, false, null));

        first.Value!.Instruction.Should().Be("Confirm the thermostat is on, set to the intended mode, and set above or below the current room temperature as appropriate.");
        replay.Value!.Id.Should().Be(first.Value.Id);
        fourth.Value!.Id.Should().Be(first.Value.Id);
        unsafeCode.Code.Should().Be(MaintenanceApiResultCode.BadRequest);
        (await db.MaintenanceTroubleshootingSteps.ToListAsync()).Should().HaveCount(3).And.OnlyContain(x => !x.Instruction.Contains("breaker", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Percy_ReplaysServerStepCodePerCycle_EvenWhenClientChangesStepKey()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        db.MaintenanceRequests.Add(Request(100, 40, 50, 60));
        await db.SaveChangesAsync();
        var service = CreateService(db, new MaintenanceActor(10, true, false));

        var first = await service.TroubleshootAsync(100, new("ignored", "client-a", "check-gfci-reset", false, false, null));
        var repeated = await service.TroubleshootAsync(100, new("forged-cycle", "client-b", "check-gfci-reset", false, false, null));

        repeated.Value!.Id.Should().Be(first.Value!.Id);
        db.MaintenanceTroubleshootingSteps.Should().ContainSingle();
    }

    [Fact]
    public async Task LegacyRequest_UsesHistoricalConversationOrigin_NotCurrentUnitOccupant()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        db.Tenants.Add(new Tenant { Id = 21, UserId = 11, Firstname = "Future", Lastname = "Occupant", OrganizationId = 60 });
        var request = Request(100, 40, 50, 60);
        request.SubmittedByUserId = null;
        request.SubmittedByTenantId = null;
        request.SubmittedUnderLeaseId = null;
        request.ConversationId = 200;
        db.MaintenanceRequests.Add(request);
        db.Conversations.Add(new Conversation { Id = 200, LandlordId = 999, TenantId = 20, MaintenanceRequestId = 100, Title = "Legacy", OrganizationId = 60 });
        await db.SaveChangesAsync();

        (await CreateService(db, new MaintenanceActor(10, true, false)).GetAsync(100)).Code.Should().Be(MaintenanceApiResultCode.Success);
        (await CreateService(db, new MaintenanceActor(11, true, false)).GetAsync(100)).Code.Should().Be(MaintenanceApiResultCode.NotFound);
    }

    [Fact]
    public async Task Percy_IsHiddenFromLandlordTeamAndAssignedVendor()
    {
        foreach (var actor in new[]
        {
            new MaintenanceActor(61, false, true),
            new MaintenanceActor(80, false, false),
            new MaintenanceActor(70, false, false)
        })
        {
            await using var db = CreateDb();
            SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
            db.ChangeTracker.Entries<Property>().Single(x => x.Entity.Id == 40).Entity.LandlordId = 61;
            db.OrganizationMembers.Add(new OrganizationMember { Id = 1, OrganizationId = 60, UserId = 80, IsActive = true, CanManageMaintenance = true });
            db.MaintenanceRequests.Add(Request(100, 40, 50, 60, 70));
            await db.SaveChangesAsync();

            var result = await CreateService(db, actor).TroubleshootAsync(100, new("cycle-a", "one", "check-gfci-reset", false, false, null));

            result.Code.Should().Be(MaintenanceApiResultCode.NotFound);
            db.MaintenanceTroubleshootingSteps.Should().BeEmpty();
        }
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Percy_WorseningOrNewEmergencyStopsFurtherTroubleshooting(bool worsening, bool newEmergency)
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        db.MaintenanceRequests.Add(Request(100, 40, 50, 60));
        await db.SaveChangesAsync();
        var service = CreateService(db, new MaintenanceActor(10, true, false));

        var stopped = await service.TroubleshootAsync(100, new("cycle-a", "one", "check-gfci-reset", worsening, newEmergency, null));
        var afterStop = await service.TroubleshootAsync(100, new("cycle-a", "two", "check-gfci-reset", false, false, null));

        stopped.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        afterStop.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        (await db.MaintenanceRequests.FindAsync(100L))!.StopTroubleshooting.Should().BeTrue();
        db.MaintenanceTroubleshootingSteps.Should().BeEmpty();
    }

    [Fact]
    public async Task Percy_UsesServerResolutionCycle_AndSafetySignalWinsOverIdempotentReplay()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        var request = Request(100, 40, 50, 60);
        request.ResolutionCycle = 2;
        db.MaintenanceRequests.Add(request);
        await db.SaveChangesAsync();
        var service = CreateService(db, new MaintenanceActor(10, true, false));

        var issued = await service.TroubleshootAsync(100, new("client-bypass", "one", "check-gfci-reset", false, false));
        var replayWithWorsening = await service.TroubleshootAsync(100, new("another-client-cycle", "one", "check-gfci-reset", true, false));

        issued.Value!.ResolutionCycleKey.Should().Be("2");
        replayWithWorsening.Code.Should().Be(MaintenanceApiResultCode.Conflict);
        (await db.MaintenanceRequests.FindAsync(100L))!.StopTroubleshooting.Should().BeTrue();
    }

    [Fact]
    public async Task PercyOutcome_CompletesPendingStep_OrStopsEntireFlowForSafety()
    {
        await using var db = CreateDb();
        SeedTenantLease(db, 10, 20, 30, 40, 50, 60);
        db.MaintenanceRequests.Add(Request(100, 40, 50, 60));
        await db.SaveChangesAsync();
        var service = CreateService(db, new MaintenanceActor(10, true, false));
        var first = (await service.TroubleshootAsync(100, new("ignored", "one", "check-gfci-reset", false, false))).Value!;

        var completed = await service.RecordTroubleshootingOutcomeAsync(100, first.Id,
            new(MaintenanceTroubleshootingOutcome.Completed, "Reset did not solve it"));
        var second = (await service.TroubleshootAsync(100, new("ignored", "two", "check-faucet-aerator", false, false))).Value!;
        var stopped = await service.RecordTroubleshootingOutcomeAsync(100, second.Id,
            new(MaintenanceTroubleshootingOutcome.StoppedForSafety, "Smell of burning"));

        completed.Value!.Outcome.Should().Be(MaintenanceTroubleshootingOutcome.Completed);
        stopped.Value!.Outcome.Should().Be(MaintenanceTroubleshootingOutcome.StoppedForSafety);
        (await db.MaintenanceRequests.FindAsync(100L))!.StopTroubleshooting.Should().BeTrue();
        (await service.TroubleshootAsync(100, new("ignored", "three", "check-gfci-reset", false, false))).Code
            .Should().Be(MaintenanceApiResultCode.Conflict);
    }

    private static MaintenanceRequestApiService CreateService(DataContext db, MaintenanceActor actor) =>
        new(db, new StubActorAccessor(actor), new MaintenanceTriagePolicyV1(new FixedTimeProvider(Now)), new FixedTimeProvider(Now));

    private static DataContext CreateDb() => new(new DbContextOptionsBuilder<DataContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static void SeedTenantLease(DataContext db, long userId, long tenantId, long leaseId, long propertyId, long unitId, long organizationId, bool active = true)
    {
        db.Properties.Add(new Property { Id = propertyId, LandlordId = 999, OrganizationId = organizationId, Name = "Home" });
        db.Units.Add(new Unit { Id = unitId, PropertyId = propertyId, Name = "1A" });
        db.Tenants.Add(new Tenant { Id = tenantId, UserId = userId, Firstname = "T", Lastname = "User", OrganizationId = organizationId });
        db.Leases.Add(new Lease { Id = leaseId, UnitId = unitId, OrganizationId = organizationId, IsActive = active, IsDeleted = false });
        db.TenantLeases.Add(new TenantLease { TenantId = tenantId, LeaseId = leaseId });
    }

    private static MaintenanceRequest Request(long id, long propertyId, long unitId, long organizationId, long? assignedUserId = null) => new()
    {
        Id = id, PropertyId = propertyId, UnitId = unitId, OrganizationId = organizationId, SubmittedByUserId = 10, SubmittedByTenantId = 20, SubmittedUnderLeaseId = 30, Title = "Leak", Description = "Leak", UnitName = "1A",
        AssignedToType = assignedUserId.HasValue ? EAssignedToType.Vendor : EAssignedToType.Unassigned,
        VendorId = assignedUserId.HasValue ? 700 : null,
        Status = EMaintenanceStatus.Reported, Urgency = MaintenanceUrgency.Routine
    };

    public enum ActorKind { Tenant, Landlord, TeamWithPermission, TeamWithoutPermission, AssignedVendorUser, Other }

    private sealed class StubActorAccessor(MaintenanceActor actor) : IMaintenanceActorAccessor
    {
        public Task<MaintenanceActor?> GetCurrentAsync(CancellationToken cancellationToken = default) => Task.FromResult<MaintenanceActor?>(actor);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
