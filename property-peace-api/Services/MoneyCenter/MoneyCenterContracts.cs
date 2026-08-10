namespace brownstone_hub_api.Services.MoneyCenter;

public sealed record MoneyCenterQuery(
    DateTimeOffset From, DateTimeOffset To, long? PropertyId, long? UnitId,
    int UpcomingDays = 30, int Limit = 50);

public sealed record MoneyCenterPropertyRecord(long Id, string Name);
public sealed record MoneyCenterUnitRecord(long Id, long PropertyId, string Name);
public sealed record MoneyCenterLeaseRecord(long Id, long PropertyId, long UnitId, decimal RentAmount,
    DateTimeOffset StartDate, DateTimeOffset EndDate, string Frequency, int DueDay);
public sealed record MoneyCenterPaymentRecord(long Id, long PropertyId, long? UnitId, long LeaseId,
    decimal Amount, DateTimeOffset OccurredAt, string Status, bool IsDeposit, string Description,
    string? Method, string? Reference, decimal RefundedAmount, decimal UnrecoveredDisputeAmount,
    bool NeedsSettlementAttention);
public sealed record MoneyCenterExpenseRecord(long Id, long PropertyId, long? UnitId, decimal Amount,
    DateTimeOffset ExpenseDate, bool IsPaid, DateTimeOffset? PaidDate, DateTimeOffset? DueDate,
    string Category, string Description, string? Vendor, bool IsTaxDeductible, bool HasReceipt);
public sealed record MoneyCenterFutureExpenseRecord(long Id, long PropertyId, long? UnitId, decimal Amount,
    DateTimeOffset DueDate, string Category, string Description, string? Vendor);
public sealed record MoneyCenterRecurringExpenseRecord(long Id, long PropertyId, long? UnitId, decimal Amount,
    DateTimeOffset NextOccurrenceDate, string Frequency, string Category, string Description, string? Vendor,
    DateTimeOffset? EndDate = null, int DayOfPeriod = 0);

public sealed record MoneyCenterOperationalData(
    IReadOnlyList<MoneyCenterPropertyRecord> Properties,
    IReadOnlyList<MoneyCenterUnitRecord> Units,
    IReadOnlyList<MoneyCenterLeaseRecord> Leases,
    IReadOnlyList<MoneyCenterPaymentRecord> Payments,
    IReadOnlyList<MoneyCenterExpenseRecord> Expenses,
    IReadOnlyList<MoneyCenterFutureExpenseRecord> FutureExpenses,
    IReadOnlyList<MoneyCenterRecurringExpenseRecord> RecurringExpenses)
{
    public static MoneyCenterOperationalData Empty { get; } = new([], [], [], [], [], [], []);
}

public sealed record MoneyCenterItem(
    string SourceId, string SourceType, DateTimeOffset OccurredAt, string Direction,
    decimal Amount, string Treatment, long PropertyId, string PropertyName, long? UnitId,
    string? UnitName, string Category, string Description, string? Counterparty,
    string? Method, string? Reference, bool NeedsAttention, bool HasReceipt);

public sealed record MoneyCenterItemsResponse(
    DateTimeOffset From, DateTimeOffset To, int TotalCount, IReadOnlyList<MoneyCenterItem> Items,
    string AccountingBasis, IReadOnlyList<string> Disclosures);

public sealed record MoneyCenterAmountCount(decimal Amount, int Count);
public sealed record MoneyCenterCategoryBreakdown(string Category, decimal CameIn, decimal WentOut, int Count);
public sealed record MoneyCenterUnitCashFlow(long UnitId, string Name, decimal CameIn, decimal WentOut, decimal RecordedNetCashFlow);
public sealed record MoneyCenterPropertyCashFlow(long PropertyId, string Name, decimal CameIn, decimal WentOut,
    decimal RecordedNetCashFlow, IReadOnlyList<MoneyCenterUnitCashFlow> Units);
public sealed record MoneyCenterAttention(int UncategorizedCount, int MissingReceiptCount, int OverdueObligationCount,
    int SettlementCount, MoneyCenterAmountCount Uncategorized, MoneyCenterAmountCount MissingReceipts,
    MoneyCenterAmountCount OverdueObligations);
public sealed record MoneyCenterTaxChecklistItem(string Key, string Label, bool Complete, int AttentionCount, string Explanation);
public sealed record MoneyCenterDataQuality(bool IsBankFeedConnected, bool IsBankBalanceAvailable, IReadOnlyList<string> Warnings);

public sealed record MoneyCenterOverviewResponse(
    DateTimeOffset From, DateTimeOffset To, decimal CameIn, decimal DueNow, decimal WentOut,
    decimal RecordedNetCashFlow, decimal UpcomingObligations, decimal ProjectedAfterUpcoming,
    string AvailableKind, MoneyCenterAmountCount CameInDetail, MoneyCenterAmountCount DueNowDetail,
    MoneyCenterAmountCount WentOutDetail, MoneyCenterAmountCount UpcomingDetail,
    IReadOnlyList<string> Explanations, IReadOnlyList<MoneyCenterPropertyCashFlow> Properties,
    IReadOnlyList<MoneyCenterCategoryBreakdown> Categories, MoneyCenterAttention Attention,
    IReadOnlyList<MoneyCenterItem> RecentItems, IReadOnlyList<MoneyCenterTaxChecklistItem> TaxPreparationChecklist,
    MoneyCenterDataQuality DataQuality);

public sealed record MoneyCenterExport(byte[] Content, string ContentType, string FileName);

public interface IMoneyCenterDataSource
{
    Task<bool> PropertyBelongsToOrganizationAsync(long organizationId, long propertyId, CancellationToken ct);
    Task<bool> UnitBelongsToOrganizationAsync(long organizationId, long unitId, long? propertyId, CancellationToken ct);
    Task<MoneyCenterOperationalData> LoadAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct);
}

public interface IMoneyCenterService
{
    Task<MoneyCenterOverviewResponse> GetOverviewAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct);
    Task<MoneyCenterItemsResponse> GetItemsAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct);
    Task<MoneyCenterExport> ExportAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct);
}

public sealed class MoneyCenterValidationException(string message) : ArgumentException(message);
public sealed class MoneyCenterScopeException(string message) : InvalidOperationException(message);
