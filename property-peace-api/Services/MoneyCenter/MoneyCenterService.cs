using System.Globalization;
using System.Text;

namespace brownstone_hub_api.Services.MoneyCenter;

public sealed class MoneyCenterService(IMoneyCenterDataSource source, TimeProvider clock) : IMoneyCenterService
{
    private static readonly HashSet<string> FinalizedStatuses = new(StringComparer.OrdinalIgnoreCase)
        { "Completed", "Paid", "PartiallyRefunded", "Refunded", "Disputed" };
    private readonly IMoneyCenterDataSource _source = source;
    private readonly TimeProvider _clock = clock;

    public async Task<MoneyCenterOverviewResponse> GetOverviewAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct)
    {
        var data = await LoadValidatedAsync(organizationId, query, ct);
        var now = _clock.GetUtcNow();
        var upcomingEnd = now.AddDays(query.UpcomingDays);
        var recurrenceThrough = query.To > upcomingEnd ? query.To : upcomingEnd;
        var allItems = BuildItems(data, query, now, recurrenceThrough);
        var periodItems = allItems.Where(x => InRange(x.OccurredAt, query.From, query.To)
            && x.Direction is "cameIn" or "wentOut").ToList();
        var cameInItems = periodItems.Where(x => x.Direction == "cameIn").ToList();
        var wentOutItems = periodItems.Where(x => x.Direction == "wentOut").ToList();
        var cameIn = cameInItems.Sum(x => x.Amount);
        var wentOut = wentOutItems.Sum(x => x.Amount);
        var net = cameIn - wentOut;
        var obligations = BuildObligations(data, upcomingEnd)
            .Where(x => x.OccurredAt >= now && x.OccurredAt < upcomingEnd).ToList();
        var upcoming = obligations.Sum(x => x.Amount);
        var dueNow = CalculateDueNow(data, now);

        var paidExpenses = data.Expenses.Where(x => x.IsPaid && x.PaidDate.HasValue
            && InRange(x.PaidDate.Value, query.From, query.To)).ToList();
        // Attention badges and the activity drawer deliberately share the same period-item predicates.
        // Counts must never include an out-of-period record or a record the drawer cannot reveal.
        var attentionItems = allItems.Where(x => InRange(x.OccurredAt, query.From, query.To)).ToList();
        var uncategorized = attentionItems.Where(x => x.Direction == "wentOut"
            && IsUncategorized(x.Category)).ToList();
        var missingReceipts = attentionItems.Where(x => x.Direction == "wentOut"
            && x.SourceType == "expense" && !x.HasReceipt).ToList();
        var overdue = attentionItems.Where(x => x.Direction == "obligation" && x.NeedsAttention).ToList();
        var settlementCount = attentionItems.Count(x => x.SourceType == "payment" && x.NeedsAttention);
        var properties = BuildPropertyCashFlow(data, periodItems);
        var categories = periodItems.GroupBy(x => DisplayCategory(x.Category), StringComparer.OrdinalIgnoreCase)
            .Select(g => new MoneyCenterCategoryBreakdown(g.Key, g.Where(x => x.Direction == "cameIn").Sum(x => x.Amount),
                g.Where(x => x.Direction == "wentOut").Sum(x => x.Amount), g.Count()))
            .OrderByDescending(x => x.CameIn + x.WentOut).ThenBy(x => x.Category).ToList();
        var missingTaxCategories = paidExpenses.Count(x => x.IsTaxDeductible && IsUncategorized(x.Category));

        return new MoneyCenterOverviewResponse(
            query.From, query.To, cameIn, dueNow, wentOut, net, upcoming, net - upcoming,
            "recordedNetCashFlow", new(cameIn, cameInItems.Count), new(dueNow, dueNow > 0 ? 1 : 0),
            new(wentOut, wentOutItems.Count), new(upcoming, obligations.Count),
            [
                "Recorded cash flow uses a cash basis: finalized rent payments received less refunds and unrecovered losses, minus paid expenses.",
                "Due now is scheduled rent through the current UTC instant less finalized net rent payments; it is not forecast income.",
                "Upcoming obligations are recorded or planned unpaid bills, future expenses, and recurring occurrences with obvious duplicates counted once.",
                "Projected after upcoming subtracts planned obligations from recorded net cash flow; it is not a bank balance."
            ], properties, categories,
            new MoneyCenterAttention(uncategorized.Count, missingReceipts.Count, overdue.Count, settlementCount,
                new(uncategorized.Sum(x => x.Amount), uncategorized.Count),
                new(missingReceipts.Sum(x => x.Amount), missingReceipts.Count),
                new(overdue.Sum(x => x.Amount), overdue.Count)),
            allItems.Where(x => InRange(x.OccurredAt, query.From, query.To)
                    || (x.Direction == "obligation" && x.OccurredAt >= now && x.OccurredAt < upcomingEnd))
                .OrderByDescending(x => x.OccurredAt).Take(query.Limit).ToList(),
            [
                new("categories", "Review deductible expense categories", missingTaxCategories == 0,
                    missingTaxCategories, "Uses organization-scoped paid expense category and deductible fields."),
                new("receipts", "Attach supporting receipts", missingReceipts.Count == 0,
                    missingReceipts.Count, "Uses organization-scoped paid expense receipt records."),
                new("settlements", "Review payment settlement exceptions", settlementCount == 0,
                    settlementCount, "Failed, processing, refunded, or disputed payment state may require review."),
                new("export", "Export source records for professional review", true, 0,
                    "The accountant-review CSV discloses cash-basis treatment and source IDs; professional review is still required.")
            ],
            new(false, false,
            [
                "No bank feed is connected to this read-only operational view.",
                "Bank balance is unavailable; recorded net cash flow must not be treated as available bank funds.",
                "Operational records may be incomplete or entered outside the platform."
            ]));
    }

    public async Task<MoneyCenterItemsResponse> GetItemsAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct)
    {
        var data = await LoadValidatedAsync(organizationId, query, ct);
        var items = BuildItems(data, query, _clock.GetUtcNow(), query.To)
            .Where(x => InRange(x.OccurredAt, query.From, query.To))
            .OrderByDescending(x => x.OccurredAt).ThenBy(x => x.SourceId, StringComparer.Ordinal)
            .ToList();
        return new(query.From, query.To, items.Count, items.Take(query.Limit).ToList(), "cash basis",
        [
            "Income includes finalized operational payment records only; deposits and processing or failed payments are excluded.",
            "Went out includes paid expenses only. Recorded and planned obligations are labeled separately.",
            "This review data is not a bank balance and requires verification against external statements."
        ]);
    }

    public async Task<MoneyCenterExport> ExportAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct)
    {
        var data = await LoadValidatedAsync(organizationId, query, ct);
        // Export is an accounting handoff, not an interactive page. Build the complete selected-period
        // record set here so the UI response limit can never silently omit older source records.
        var items = BuildItems(data, query, _clock.GetUtcNow(), query.To)
            .Where(x => InRange(x.OccurredAt, query.From, query.To))
            .OrderByDescending(x => x.OccurredAt).ThenBy(x => x.SourceId, StringComparer.Ordinal)
            .ToList();
        var sb = new StringBuilder();
        sb.AppendLine("accounting_basis,cash basis");
        sb.AppendLine("disclosure,Operational records for accountant review; verify against source documents and external statements");
        sb.AppendLine("source_id,source_type,occurred_at_utc,direction,amount_usd,treatment,property_id,property_name,unit_id,unit_name,category,description,counterparty,method,reference,needs_attention,has_receipt");
        foreach (var item in items)
        {
            var fields = new[]
            {
                Text(item.SourceId), Text(item.SourceType), item.OccurredAt.UtcDateTime.ToString("O", CultureInfo.InvariantCulture),
                Text(item.Direction), item.Amount.ToString("0.00", CultureInfo.InvariantCulture), Text(item.Treatment),
                item.PropertyId.ToString(CultureInfo.InvariantCulture), Text(item.PropertyName),
                item.UnitId?.ToString(CultureInfo.InvariantCulture) ?? "", Text(item.UnitName), Text(item.Category),
                Text(item.Description), Text(item.Counterparty), Text(item.Method), Text(item.Reference),
                item.NeedsAttention ? "true" : "false", item.HasReceipt ? "true" : "false"
            };
            sb.AppendLine(string.Join(',', fields.Select(Csv)));
        }
        var fileName = $"money-center-accountant-review-{query.From:yyyyMMdd}-{query.To:yyyyMMdd}.csv";
        return new(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv; charset=utf-8", fileName);
    }

    private async Task<MoneyCenterOperationalData> LoadValidatedAsync(long organizationId, MoneyCenterQuery query, CancellationToken ct)
    {
        if (organizationId <= 0) throw new MoneyCenterScopeException("Validated organization context is required.");
        if (query.From.Offset != TimeSpan.Zero || query.To.Offset != TimeSpan.Zero)
            throw new MoneyCenterValidationException("from and to must be UTC timestamps.");
        if (query.From >= query.To) throw new MoneyCenterValidationException("from must be earlier than to.");
        if (query.UpcomingDays is < 1 or > 365) throw new MoneyCenterValidationException("upcomingDays must be between 1 and 365.");
        if (query.Limit is < 1 or > 1000) throw new MoneyCenterValidationException("limit must be between 1 and 1000.");
        if (query.PropertyId is <= 0 || query.UnitId is <= 0) throw new MoneyCenterValidationException("propertyId and unitId must be positive.");
        if (query.PropertyId.HasValue && !await _source.PropertyBelongsToOrganizationAsync(organizationId, query.PropertyId.Value, ct))
            throw new MoneyCenterScopeException("Property was not found in the active organization.");
        if (query.UnitId.HasValue && !await _source.UnitBelongsToOrganizationAsync(organizationId, query.UnitId.Value, query.PropertyId, ct))
            throw new MoneyCenterScopeException("Unit was not found in the active organization and property scope.");
        return await _source.LoadAsync(organizationId, query, ct);
    }

    private static List<MoneyCenterItem> BuildItems(MoneyCenterOperationalData data, MoneyCenterQuery query,
        DateTimeOffset now, DateTimeOffset recurrenceThrough)
    {
        var propertyNames = data.Properties.ToDictionary(x => x.Id, x => x.Name);
        var unitNames = data.Units.ToDictionary(x => x.Id, x => x.Name);
        string PropertyName(long id) => propertyNames.GetValueOrDefault(id) ?? $"Property {id}";
        string? UnitName(long? id) => id.HasValue ? unitNames.GetValueOrDefault(id.Value) ?? $"Unit {id}" : null;
        var items = new List<MoneyCenterItem>();
        foreach (var payment in data.Payments)
        {
            var finalized = FinalizedStatuses.Contains(payment.Status);
            var net = payment.Amount < 0 ? payment.Amount : Math.Max(0m, payment.Amount - payment.RefundedAmount - payment.UnrecoveredDisputeAmount);
            var included = finalized && !payment.IsDeposit;
            var direction = included ? "cameIn" : "excluded";
            items.Add(new($"payment:{payment.Id}", "payment", payment.OccurredAt, direction,
                included ? net : 0m, included ? "finalized net payment" : payment.IsDeposit ? "deposit excluded from income" : $"{payment.Status} payment excluded from income",
                payment.PropertyId, PropertyName(payment.PropertyId), payment.UnitId, UnitName(payment.UnitId),
                payment.Description, payment.Description, null, payment.Method, payment.Reference,
                payment.NeedsSettlementAttention || !finalized, true));
        }
        foreach (var expense in data.Expenses)
        {
            // IsPaid without a payment date cannot be placed on a cash-basis timeline without inventing
            // a cash event. Keep it out until the malformed record is corrected.
            if (expense.IsPaid && !expense.PaidDate.HasValue) continue;
            var occurred = expense.IsPaid ? expense.PaidDate!.Value : expense.DueDate ?? expense.ExpenseDate;
            items.Add(new($"expense:{expense.Id}", "expense", occurred, expense.IsPaid ? "wentOut" : "obligation",
                expense.Amount, expense.IsPaid ? "paid expense recorded on cash basis" : "recorded unpaid bill; not cash out",
                expense.PropertyId, PropertyName(expense.PropertyId), expense.UnitId, UnitName(expense.UnitId),
                DisplayCategory(expense.Category), expense.Description, expense.Vendor, null, null,
                !expense.IsPaid && expense.DueDate < now, expense.HasReceipt));
        }
        items.AddRange(BuildObligations(data, recurrenceThrough).Where(x => x.SourceType is "futureExpense" or "recurringExpense")
            .Select(x => x with
            {
                PropertyName = PropertyName(x.PropertyId),
                UnitName = UnitName(x.UnitId),
                NeedsAttention = x.OccurredAt < now
            }));
        return items;
    }

    private static List<MoneyCenterItem> BuildObligations(MoneyCenterOperationalData data, DateTimeOffset recurrenceThrough)
    {
        var result = new List<MoneyCenterItem>();
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var expense in data.Expenses.Where(x => !x.IsPaid))
        {
            var due = expense.DueDate ?? expense.ExpenseDate;
            keys.Add(ObligationKey(expense.PropertyId, expense.UnitId, expense.Amount, due, expense.Category, expense.Description));
            result.Add(new($"expense:{expense.Id}", "expense", due, "obligation", expense.Amount,
                "recorded unpaid bill; not cash out", expense.PropertyId, "", expense.UnitId, null,
                DisplayCategory(expense.Category), expense.Description, expense.Vendor, null, null, false, expense.HasReceipt));
        }
        foreach (var future in data.FutureExpenses)
        {
            var key = ObligationKey(future.PropertyId, future.UnitId, future.Amount, future.DueDate, future.Category, future.Description);
            if (!keys.Add(key)) continue;
            result.Add(new($"future-expense:{future.Id}", "futureExpense", future.DueDate, "obligation", future.Amount,
                "planned future expense; not cash out", future.PropertyId, "", future.UnitId, null,
                DisplayCategory(future.Category), future.Description, future.Vendor, null, null, false, false));
        }
        foreach (var recurring in data.RecurringExpenses)
        {
            var occurrence = recurring.NextOccurrenceDate;
            var occurrenceNumber = 0;
            while (occurrence < recurrenceThrough && (!recurring.EndDate.HasValue || occurrence <= recurring.EndDate.Value))
            {
                var key = ObligationKey(recurring.PropertyId, recurring.UnitId, recurring.Amount, occurrence, recurring.Category, recurring.Description);
                if (keys.Add(key))
                {
                    var suffix = occurrenceNumber == 0 ? "" : $":{occurrence:yyyyMMdd}";
                    result.Add(new($"recurring-expense:{recurring.Id}{suffix}", "recurringExpense", occurrence, "obligation", recurring.Amount,
                        $"planned {recurring.Frequency.ToLowerInvariant()} recurring occurrence; not cash out", recurring.PropertyId, "", recurring.UnitId, null,
                        DisplayCategory(recurring.Category), recurring.Description, recurring.Vendor, null, null, false, false));
                }
                occurrenceNumber++;
                if (occurrenceNumber > 1000) break;
                occurrence = NextOccurrence(occurrence, recurring.Frequency, recurring.DayOfPeriod);
            }
        }
        return result;
    }

    private static decimal CalculateDueNow(MoneyCenterOperationalData data, DateTimeOffset now)
    {
        decimal scheduled = 0;
        foreach (var lease in data.Leases)
            scheduled += ScheduledThrough(lease, now);
        var scheduledLeaseIds = data.Leases.Select(x => x.Id).ToHashSet();
        var credited = data.Payments.Where(x => scheduledLeaseIds.Contains(x.LeaseId)
                && !x.IsDeposit && x.Description.Equals("Rent", StringComparison.OrdinalIgnoreCase)
                && FinalizedStatuses.Contains(x.Status) && x.OccurredAt <= now)
            .Sum(x => x.Amount < 0 ? x.Amount : Math.Max(0m, x.Amount - x.RefundedAmount - x.UnrecoveredDisputeAmount));
        return Math.Max(0m, scheduled - credited);
    }

    private static decimal ScheduledThrough(MoneyCenterLeaseRecord lease, DateTimeOffset now)
    {
        if (lease.RentAmount <= 0 || lease.StartDate > now) return 0;
        var end = now < lease.EndDate ? now : lease.EndDate;
        var count = 0;
        var cursor = FirstDueDate(lease);
        var stepDays = lease.Frequency.Trim().ToLowerInvariant() switch { "weekly" => 7, "biweekly" or "bi-weekly" => 14, _ => 0 };
        while (cursor <= end)
        {
            count++;
            if (count > 10000) break;
            cursor = stepDays > 0 ? cursor.AddDays(stepDays) : lease.Frequency.Trim().ToLowerInvariant() switch
            {
                "quarterly" => cursor.AddMonths(3), "yearly" or "annually" => cursor.AddYears(1), _ => cursor.AddMonths(1)
            };
        }
        return count * lease.RentAmount;
    }

    private static DateTimeOffset FirstDueDate(MoneyCenterLeaseRecord lease)
    {
        var local = lease.StartDate;
        var day = lease.DueDay == -1 ? DateTime.DaysInMonth(local.Year, local.Month)
            : Math.Clamp(lease.DueDay, 1, DateTime.DaysInMonth(local.Year, local.Month));
        var due = new DateTimeOffset(local.Year, local.Month, day, 0, 0, 0, TimeSpan.Zero);
        return due < lease.StartDate ? due.AddMonths(1) : due;
    }

    private static IReadOnlyList<MoneyCenterPropertyCashFlow> BuildPropertyCashFlow(MoneyCenterOperationalData data, List<MoneyCenterItem> items) =>
        data.Properties.Select(property =>
        {
            var propertyItems = items.Where(x => x.PropertyId == property.Id).ToList();
            var units = data.Units.Where(x => x.PropertyId == property.Id).Select(unit =>
            {
                var unitItems = propertyItems.Where(x => x.UnitId == unit.Id).ToList();
                var income = unitItems.Where(x => x.Direction == "cameIn").Sum(x => x.Amount);
                var expense = unitItems.Where(x => x.Direction == "wentOut").Sum(x => x.Amount);
                return new MoneyCenterUnitCashFlow(unit.Id, unit.Name, income, expense, income - expense);
            }).ToList();
            var cameIn = propertyItems.Where(x => x.Direction == "cameIn").Sum(x => x.Amount);
            var wentOut = propertyItems.Where(x => x.Direction == "wentOut").Sum(x => x.Amount);
            return new MoneyCenterPropertyCashFlow(property.Id, property.Name, cameIn, wentOut, cameIn - wentOut, units);
        }).ToList();

    private static string ObligationKey(long propertyId, long? unitId, decimal amount, DateTimeOffset due, string category, string description) =>
        $"{propertyId}|{unitId}|{amount:0.00}|{due.UtcDateTime:yyyy-MM-dd}|{category.Trim()}|{description.Trim()}";
    private static DateTimeOffset NextOccurrence(DateTimeOffset occurrence, string frequency, int dayOfPeriod)
    {
        var advanced = frequency.Trim().ToLowerInvariant() switch
        {
            "quarterly" => occurrence.AddMonths(3),
            "yearly" or "annually" => occurrence.AddYears(1),
            _ => occurrence.AddMonths(1)
        };
        var requestedDay = dayOfPeriod > 0 ? dayOfPeriod : occurrence.Day;
        var day = Math.Min(requestedDay, DateTime.DaysInMonth(advanced.Year, advanced.Month));
        return new DateTimeOffset(advanced.Year, advanced.Month, day,
            advanced.Hour, advanced.Minute, advanced.Second, advanced.Offset);
    }
    private static bool InRange(DateTimeOffset value, DateTimeOffset from, DateTimeOffset to) => value >= from && value < to;
    private static bool IsUncategorized(string? value) => string.IsNullOrWhiteSpace(value) || value.Equals("Uncategorized", StringComparison.OrdinalIgnoreCase);
    private static string DisplayCategory(string? value) => IsUncategorized(value) ? "Uncategorized" : value!.Trim();
    private static string Text(string? value)
    {
        var text = value ?? "";
        var trimmed = text.TrimStart();
        return trimmed.Length > 0 && "=+-@".Contains(trimmed[0]) ? "'" + text : text;
    }
    private static string Csv(string value) => value.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
}
