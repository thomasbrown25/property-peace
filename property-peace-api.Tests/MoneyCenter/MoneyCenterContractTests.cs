using System.Text;
using brownstone_hub_api.Services.MoneyCenter;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.MoneyCenter;

public sealed class MoneyCenterContractTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 9, 12, 0, 0, TimeSpan.Zero);
    private static readonly MoneyCenterQuery Query = new(
        new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero),
        new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.Zero), null, null, 30, 50);

    [Fact]
    public async Task Overview_UsesFinalizedNetCashAndLabelsNonCashObligationsWithoutDoubleCounting()
    {
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData(
                [new(10, "Oak House")],
                [new(100, 10, "1A")],
                [new(1000, 10, 100, 1000m, new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero), new DateTimeOffset(2027, 7, 31, 0, 0, 0, TimeSpan.Zero), "Monthly", 1)],
                [
                    new(1, 10, 100, 1000, 1000m, new DateTimeOffset(2026, 8, 2, 0, 0, 0, TimeSpan.Zero), "Completed", false, "Rent", "ACH", "ok", 0m, 0m, false),
                    new(2, 10, 100, 1000, 250m, new DateTimeOffset(2026, 8, 3, 0, 0, 0, TimeSpan.Zero), "Processing", false, "Rent", "ACH", null, 0m, 0m, true),
                    new(3, 10, 100, 1000, 500m, new DateTimeOffset(2026, 8, 4, 0, 0, 0, TimeSpan.Zero), "Completed", true, "Security deposit", "ACH", null, 0m, 0m, false),
                    new(4, 10, 100, 1000, 400m, new DateTimeOffset(2026, 8, 5, 0, 0, 0, TimeSpan.Zero), "PartiallyRefunded", false, "Rent", "Card", null, 100m, 50m, true)
                ],
                [
                    new(11, 10, null, 200m, new DateTimeOffset(2026, 8, 6, 0, 0, 0, TimeSpan.Zero), true, new DateTimeOffset(2026, 8, 7, 0, 0, 0, TimeSpan.Zero), null, "Insurance", "Policy", "=unsafe vendor", false, false),
                    new(12, 10, 100, 90m, new DateTimeOffset(2026, 8, 8, 0, 0, 0, TimeSpan.Zero), false, null, new DateTimeOffset(2026, 8, 15, 0, 0, 0, TimeSpan.Zero), "Utilities", "Water", "City", true, true)
                ],
                [new(21, 10, 100, 90m, new DateTimeOffset(2026, 8, 15, 0, 0, 0, TimeSpan.Zero), "Utilities", "Water", "City")],
                [new(31, 10, 100, 90m, new DateTimeOffset(2026, 8, 15, 0, 0, 0, TimeSpan.Zero), "Monthly", "Utilities", "Water", "City")])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var result = await service.GetOverviewAsync(7, Query, CancellationToken.None);

        result.CameIn.Should().Be(1250m, "completed cash is reduced by refunds and unrecovered disputes");
        result.WentOut.Should().Be(200m, "only paid expenses are recorded cash out");
        result.RecordedNetCashFlow.Should().Be(1050m);
        result.AvailableKind.Should().Be("recordedNetCashFlow");
        result.UpcomingObligations.Should().Be(90m, "matching unpaid/future/recurring records are one obligation, not three");
        result.ProjectedAfterUpcoming.Should().Be(960m);
        result.Properties.Single().Units.Single().WentOut.Should().Be(0m, "property-only expenses must not be allocated to a unit");
        result.Attention.SettlementCount.Should().Be(2);
        result.Attention.MissingReceiptCount.Should().Be(1);
        result.DataQuality.IsBankFeedConnected.Should().BeFalse();
        result.DataQuality.IsBankBalanceAvailable.Should().BeFalse();
        result.Explanations.Should().Contain(x => x.Contains("cash basis", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Items_AppliesUtcHalfOpenRangeAndScopeToEveryOperationalSource()
    {
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData(
                [new(10, "Oak")], [], [],
                [
                    new(1, 10, null, 1, 10m, Query.From, "Completed", false, "Rent", "Cash", null, 0, 0, false),
                    new(2, 10, null, 1, 20m, Query.To, "Completed", false, "Rent", "Cash", null, 0, 0, false)
                ],
                [new(3, 10, null, 5m, Query.From.UtcDateTime, true, Query.From, null, "Repair", "A", null, false, false)], [], [])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var result = await service.GetItemsAsync(7, Query, CancellationToken.None);

        result.Items.Select(x => x.SourceId).Should().BeEquivalentTo("payment:1", "expense:3");
        source.LastOrganizationId.Should().Be(7);
        source.LastQuery.Should().Be(Query);
    }

    [Fact]
    public async Task InvalidFiltersAndForeignPropertyFailClosed()
    {
        var source = new StubSource { OwnsProperty = false };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var invalidDays = Query with { UpcomingDays = 366 };
        await FluentActions.Invoking(() => service.GetOverviewAsync(7, invalidDays, default))
            .Should().ThrowAsync<MoneyCenterValidationException>();
        await FluentActions.Invoking(() => service.GetOverviewAsync(7, Query with { PropertyId = 999 }, default))
            .Should().ThrowAsync<MoneyCenterScopeException>();
        source.LoadCount.Should().Be(0);
    }

    [Fact]
    public async Task Export_MatchesDrilldownAndNeutralizesEveryTextCell()
    {
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData([new(10, "=cmd")], [], [],
                [new(1, 10, null, 1, 10.25m, Query.From, "Completed", false, "+Rent", "@ACH", "-ref", 0, 0, false)], [], [], [])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var export = await service.ExportAsync(7, Query, default);
        var csv = Encoding.UTF8.GetString(export.Content);

        export.ContentType.Should().Be("text/csv; charset=utf-8");
        csv.Should().Contain("cash basis");
        csv.Should().Contain("source_id");
        csv.Should().Contain("payment:1");
        csv.Should().Contain("'=cmd");
        csv.Should().Contain("'+Rent");
        csv.Should().Contain("'@ACH");
        csv.Should().Contain("'-ref");
        csv.Should().Contain("10.25");
    }


    [Fact]
    public async Task PaidExpenses_RequireAndUsePaidDateForCashBasis()
    {
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData([new(10, "Oak")], [], [], [],
            [
                new(1, 10, null, 100m, new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero), true,
                    new DateTimeOffset(2026, 8, 2, 0, 0, 0, TimeSpan.Zero), null, "Repair", "July bill paid in August", null, false, true),
                new(2, 10, null, 200m, new DateTimeOffset(2026, 8, 2, 0, 0, 0, TimeSpan.Zero), true,
                    new DateTimeOffset(2026, 9, 2, 0, 0, 0, TimeSpan.Zero), null, "Repair", "August bill paid in September", null, false, true),
                new(3, 10, null, 300m, new DateTimeOffset(2026, 8, 3, 0, 0, 0, TimeSpan.Zero), true,
                    null, null, "Repair", "Malformed paid bill", null, false, true)
            ], [], [])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var result = await service.GetOverviewAsync(7, Query, default);
        var items = await service.GetItemsAsync(7, Query, default);

        result.WentOut.Should().Be(100m);
        items.Items.Select(x => x.SourceId).Should().Contain("expense:1").And.NotContain(["expense:2", "expense:3"]);
    }

    [Fact]
    public async Task UpcomingObligations_ExpandEveryRecurringOccurrenceWithinTheWindowAndHonorEndDate()
    {
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData([new(10, "Oak")], [], [], [], [], [],
            [new(31, 10, null, 25m, new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero),
                "Monthly", "Utilities", "Service", null, new DateTimeOffset(2026, 10, 31, 0, 0, 0, TimeSpan.Zero), 31)])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var result = await service.GetOverviewAsync(7, Query with { UpcomingDays = 120 }, default);

        result.UpcomingObligations.Should().Be(75m);
        result.UpcomingDetail.Count.Should().Be(3);
        result.RecentItems.Where(x => x.SourceType == "recurringExpense")
            .Select(x => x.OccurredAt).Should().BeEquivalentTo(new[]
            {
                new DateTimeOffset(2026, 8, 31, 0, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 9, 30, 0, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 10, 31, 0, 0, 0, TimeSpan.Zero)
            });
    }

    [Fact]
    public async Task AttentionCounts_ExactlyMatchTheSelectedPeriodDrilldownPredicates()
    {
        var inRange = new DateTimeOffset(2026, 8, 3, 0, 0, 0, TimeSpan.Zero);
        var beforeRange = Query.From.AddDays(-1);
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData([new(10, "Oak")], [], [],
            [
                new(1, 10, null, 1, 10m, inRange, "Processing", false, "Rent", null, null, 0, 0, false),
                new(2, 10, null, 1, 10m, beforeRange, "Processing", false, "Rent", null, null, 0, 0, false)
            ],
            [
                new(11, 10, null, 20m, inRange, true, inRange, null, "", "Paid", null, true, false),
                new(12, 10, null, 30m, inRange, false, null, inRange, "Repairs", "Bill", null, true, true),
                new(13, 10, null, 40m, beforeRange, false, null, beforeRange, "Repairs", "Old bill", null, true, true)
            ],
            [new(21, 10, null, 50m, inRange, "Utilities", "Planned", null)],
            [new(31, 10, null, 60m, inRange, "Monthly", "Utilities", "Recurring", null, inRange, 3)])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var overview = await service.GetOverviewAsync(7, Query, default);
        var drilldown = await service.GetItemsAsync(7, Query with { Limit = 1000 }, default);

        overview.Attention.UncategorizedCount.Should().Be(drilldown.Items.Count(x =>
            x.Direction == "wentOut" && x.Category == "Uncategorized"));
        overview.Attention.MissingReceiptCount.Should().Be(drilldown.Items.Count(x =>
            x.Direction == "wentOut" && x.SourceType == "expense" && !x.HasReceipt));
        overview.Attention.OverdueObligationCount.Should().Be(drilldown.Items.Count(x =>
            x.Direction == "obligation" && x.NeedsAttention));
        overview.Attention.SettlementCount.Should().Be(drilldown.Items.Count(x =>
            x.SourceType == "payment" && x.NeedsAttention));
        overview.Attention.OverdueObligationCount.Should().Be(3,
            "recorded, future, and recurring obligations overdue in the selected period all drill down");
        overview.Attention.SettlementCount.Should().Be(1, "out-of-period settlement records must not inflate the badge");
    }

    [Fact]
    public async Task Export_IncludesEveryMatchingRecordBeyondTheInteractiveLimit()
    {
        var payments = Enumerable.Range(1, 1005)
            .Select(id => new MoneyCenterPaymentRecord(id, 10, null, 1, id, Query.From.AddMinutes(id),
                "Completed", false, "Rent", null, null, 0, 0, false))
            .ToList();
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData([new(10, "Oak")], [], [], payments, [], [], [])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var drilldown = await service.GetItemsAsync(7, Query with { Limit = 1000 }, default);
        var export = await service.ExportAsync(7, Query, default);
        var csv = Encoding.UTF8.GetString(export.Content);

        drilldown.Items.Should().HaveCount(1000, "the interactive response remains bounded");
        csv.Should().Contain("payment:1005", "accountant exports must never silently inherit the interactive cap");
        csv.Split('\n', StringSplitOptions.RemoveEmptyEntries).Should().HaveCount(1008,
            "two metadata rows, one header, and every matching source record are exported");
    }

    [Fact]
    public async Task DueNow_CreditsOnlyPaymentsForLeasesContributingScheduledRent_ButKeepsArchivedHistory()
    {
        var archivedPaymentDate = new DateTimeOffset(2026, 8, 2, 0, 0, 0, TimeSpan.Zero);
        var source = new StubSource
        {
            Data = new MoneyCenterOperationalData([new(10, "Oak")], [new(100, 10, "1A")],
                [new(2000, 10, 100, 1000m, new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero),
                    new DateTimeOffset(2027, 7, 31, 0, 0, 0, TimeSpan.Zero), "Monthly", 1)],
                [
                    new(1, 10, 100, 1000, 1000m, archivedPaymentDate, "Completed", false, "Rent", "ACH", "archived", 0, 0, false),
                    new(2, 10, 100, 2000, 250m, archivedPaymentDate, "Completed", false, "Rent", "ACH", "active", 0, 0, false)
                ], [], [], [])
        };
        var service = new MoneyCenterService(source, new FixedTimeProvider(Now));

        var overview = await service.GetOverviewAsync(7, Query, default);
        var items = await service.GetItemsAsync(7, Query, default);
        var export = Encoding.UTF8.GetString((await service.ExportAsync(7, Query, default)).Content);

        overview.DueNow.Should().Be(750m, "an archived lease receipt cannot satisfy the active lease obligation");
        items.Items.Select(x => x.SourceId).Should().Contain(["payment:1", "payment:2"]);
        export.Should().Contain("payment:1").And.Contain("archived");
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class StubSource : IMoneyCenterDataSource
    {
        public MoneyCenterOperationalData Data { get; set; } = MoneyCenterOperationalData.Empty;
        public bool OwnsProperty { get; set; } = true;
        public bool OwnsUnit { get; set; } = true;
        public long LastOrganizationId { get; private set; }
        public MoneyCenterQuery? LastQuery { get; private set; }
        public int LoadCount { get; private set; }

        public Task<bool> PropertyBelongsToOrganizationAsync(long organizationId, long propertyId, CancellationToken ct) => Task.FromResult(OwnsProperty);
        public Task<bool> UnitBelongsToOrganizationAsync(long organizationId, long unitId, long? propertyId, CancellationToken ct) => Task.FromResult(OwnsUnit);
        public Task<MoneyCenterOperationalData> LoadAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct)
        {
            LastOrganizationId = organizationId;
            LastQuery = query;
            LoadCount++;
            return Task.FromResult(Data);
        }
    }
}
