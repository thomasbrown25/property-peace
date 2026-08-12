using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.MaintenanceTriage;

public enum MaintenanceSignal
{
    ActiveFire = 1,
    GasOdor = 2,
    CarbonMonoxideAlarm = 3,
    ElectricalSparking = 4,
    UncontrolledFlooding = 5,
    NoHeatInColdWeather = 20,
    NoRunningWater = 21,
    SewageBackup = 22,
    OnlyToiletUnusable = 23,
    EntryCannotBeSecured = 24
}

public sealed record MaintenanceTriageInput(
    string? Location,
    string? Description,
    IReadOnlyCollection<MaintenanceSignal> Signals,
    bool HasPhotos = false,
    bool HasPreferredAccessWindows = false);

public sealed record MaintenanceTriageResult(
    string PolicyVersion,
    MaintenanceUrgency Urgency,
    bool StopTroubleshooting,
    string LandlordSummary,
    IReadOnlyList<string> MissingInformation,
    DateTimeOffset TriagedAtUtc,
    DateTimeOffset AcknowledgeByUtc,
    DateTimeOffset ActionByUtc);

/// <summary>
/// Versioned, side-effect-free decision policy. Inputs and TimeProvider are the only sources of state.
/// Signal precedence, checklist order, summary formatting and SLA durations are deliberately explicit.
/// </summary>
public sealed class MaintenanceTriagePolicyV1
{
    public const string Version = "maintenance-triage-v1";

    private static readonly HashSet<MaintenanceSignal> EmergencySignals =
    [
        MaintenanceSignal.ActiveFire,
        MaintenanceSignal.GasOdor,
        MaintenanceSignal.CarbonMonoxideAlarm,
        MaintenanceSignal.ElectricalSparking,
        MaintenanceSignal.UncontrolledFlooding
    ];

    private static readonly HashSet<MaintenanceSignal> UrgentSignals =
    [
        MaintenanceSignal.NoHeatInColdWeather,
        MaintenanceSignal.NoRunningWater,
        MaintenanceSignal.SewageBackup,
        MaintenanceSignal.OnlyToiletUnusable,
        MaintenanceSignal.EntryCannotBeSecured
    ];

    private readonly TimeProvider _timeProvider;

    public MaintenanceTriagePolicyV1(TimeProvider timeProvider) =>
        _timeProvider = timeProvider ?? throw new ArgumentNullException(nameof(timeProvider));

    public MaintenanceTriageResult Evaluate(MaintenanceTriageInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(input.Signals);

        var signals = input.Signals.Distinct().OrderBy(signal => signal.ToString(), StringComparer.Ordinal).ToArray();
        var urgency = signals.Any(EmergencySignals.Contains)
            ? MaintenanceUrgency.Emergency
            : signals.Any(UrgentSignals.Contains)
                ? MaintenanceUrgency.Urgent
                : MaintenanceUrgency.Routine;

        var missing = MissingInformation(input);
        var now = _timeProvider.GetUtcNow();
        var (acknowledgeWithin, actionWithin) = urgency switch
        {
            MaintenanceUrgency.Emergency => (TimeSpan.FromMinutes(15), TimeSpan.FromHours(4)),
            MaintenanceUrgency.Urgent => (TimeSpan.FromHours(4), TimeSpan.FromHours(24)),
            _ => (TimeSpan.FromHours(24), TimeSpan.FromHours(72))
        };

        var summary = string.Join(" | ",
            urgency.ToString().ToUpperInvariant(),
            $"Location: {ValueOrFallback(input.Location)}",
            $"Issue: {ValueOrFallback(input.Description)}",
            $"Signals: {(signals.Length == 0 ? "none" : string.Join(", ", signals))}",
            $"Missing: {(missing.Count == 0 ? "none" : string.Join(", ", missing))}");

        return new MaintenanceTriageResult(
            Version,
            urgency,
            urgency == MaintenanceUrgency.Emergency,
            summary,
            missing,
            now,
            now.Add(acknowledgeWithin),
            now.Add(actionWithin));
    }

    private static IReadOnlyList<string> MissingInformation(MaintenanceTriageInput input)
    {
        var missing = new List<string>(4);
        if (string.IsNullOrWhiteSpace(input.Description)) missing.Add("description");
        if (string.IsNullOrWhiteSpace(input.Location)) missing.Add("location");
        if (!input.HasPhotos) missing.Add("photos");
        if (!input.HasPreferredAccessWindows) missing.Add("preferredAccessWindows");
        return missing;
    }

    private static string ValueOrFallback(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "not provided" : value.Trim();
}
