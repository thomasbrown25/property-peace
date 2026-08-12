using brownstone_hub_api.Models;
using brownstone_hub_api.Services.MaintenanceTriage;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Domain.Maintenance;

public sealed class MaintenanceTriagePolicyV1Tests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 8, 12, 0, 0, TimeSpan.Zero);
    private readonly MaintenanceTriagePolicyV1 _policy = new(new FixedTimeProvider(Now));

    public static TheoryData<MaintenanceSignal> EmergencySignals => new()
    {
        MaintenanceSignal.ActiveFire,
        MaintenanceSignal.GasOdor,
        MaintenanceSignal.CarbonMonoxideAlarm,
        MaintenanceSignal.ElectricalSparking,
        MaintenanceSignal.UncontrolledFlooding
    };

    public static TheoryData<MaintenanceSignal> UrgentSignals => new()
    {
        MaintenanceSignal.NoHeatInColdWeather,
        MaintenanceSignal.NoRunningWater,
        MaintenanceSignal.SewageBackup,
        MaintenanceSignal.OnlyToiletUnusable,
        MaintenanceSignal.EntryCannotBeSecured
    };

    [Theory]
    [MemberData(nameof(EmergencySignals))]
    public void Evaluate_EmergencySignal_StopsTroubleshootingAndUsesEmergencySla(MaintenanceSignal signal)
    {
        var result = _policy.Evaluate(new MaintenanceTriageInput("Kitchen", "Tenant report", [signal]));

        result.Urgency.Should().Be(MaintenanceUrgency.Emergency);
        result.StopTroubleshooting.Should().BeTrue();
        result.AcknowledgeByUtc.Should().Be(Now.AddMinutes(15));
        result.ActionByUtc.Should().Be(Now.AddHours(4));
        result.LandlordSummary.Should().Contain("EMERGENCY").And.Contain(signal.ToString());
    }

    [Theory]
    [MemberData(nameof(UrgentSignals))]
    public void Evaluate_UrgentSignal_UsesUrgentSla(MaintenanceSignal signal)
    {
        var result = _policy.Evaluate(new MaintenanceTriageInput("Bathroom", "Tenant report", [signal]));

        result.Urgency.Should().Be(MaintenanceUrgency.Urgent);
        result.StopTroubleshooting.Should().BeFalse();
        result.AcknowledgeByUtc.Should().Be(Now.AddHours(4));
        result.ActionByUtc.Should().Be(Now.AddHours(24));
    }

    [Fact]
    public void Evaluate_MixedSignals_SelectsHighestUrgencyAndIsOrderIndependent()
    {
        var first = _policy.Evaluate(new MaintenanceTriageInput("Basement", "Leak", [MaintenanceSignal.NoRunningWater, MaintenanceSignal.GasOdor]));
        var second = _policy.Evaluate(new MaintenanceTriageInput("Basement", "Leak", [MaintenanceSignal.GasOdor, MaintenanceSignal.NoRunningWater]));

        first.Should().BeEquivalentTo(second);
        first.Urgency.Should().Be(MaintenanceUrgency.Emergency);
    }

    [Fact]
    public void Evaluate_IncompleteRoutineIntake_ReturnsStableSummaryChecklistAndRoutineSla()
    {
        var result = _policy.Evaluate(new MaintenanceTriageInput(null, null, []));

        result.Urgency.Should().Be(MaintenanceUrgency.Routine);
        result.StopTroubleshooting.Should().BeFalse();
        result.MissingInformation.Should().Equal("description", "location", "photos", "preferredAccessWindows");
        result.LandlordSummary.Should().Be("ROUTINE | Location: not provided | Issue: not provided | Signals: none | Missing: description, location, photos, preferredAccessWindows");
        result.AcknowledgeByUtc.Should().Be(Now.AddHours(24));
        result.ActionByUtc.Should().Be(Now.AddHours(72));
    }

    [Fact]
    public void LegacyStatusNumericValues_RemainStableWhileCanonicalWorkflowStatusesAreAvailable()
    {
        ((int)EMaintenanceStatus.Reported).Should().Be(0);
        ((int)EMaintenanceStatus.Acknowledged).Should().Be(1);
        ((int)EMaintenanceStatus.Scheduled).Should().Be(2);
        ((int)EMaintenanceStatus.InProgress).Should().Be(3);
        ((int)EMaintenanceStatus.Resolved).Should().Be(4);
        Enum.GetNames<EMaintenanceStatus>().Should().Contain(["AwaitingTenant", "AwaitingApproval", "Assigned", "Cancelled"]);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
