using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.TaxReportService;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Tax;

public sealed class TaxReportServiceAccountingTests
{
    [Fact]
    public async Task TaxYearReport_NetsFinalizedSettlementLossRows()
    {
        var expenses = ExpenseRepository([]);
        var payments = PaymentRepository(
        [
            Payment(1, 1_000m, "Disputed"),
            Payment(2, -150m, "Completed"),
            Payment(3, 400m, "Processing")
        ]);

        var report = (await Service(expenses, payments).GetTaxYearReport(71, 2025)).Data!;

        report.RentIncome.Should().Be(850m,
            "the original settled receipt and its durable negative loss adjustment must be netted");
        report.TotalIncome.Should().Be(850m);
        report.NetIncome.Should().Be(850m);
    }

    [Fact]
    public async Task ExpenseReports_UsePaidDateAndExcludeUnpaidOrMalformedExpensesConsistently()
    {
        var included = Expense(1, new DateTime(2024, 12, 20), true, new DateTime(2025, 1, 5), 700m);
        var unpaid = Expense(2, new DateTime(2025, 2, 1), false, null, 800m);
        var malformed = Expense(3, new DateTime(2025, 3, 1), true, null, 900m);
        var paidNextYear = Expense(4, new DateTime(2025, 4, 1), true, new DateTime(2026, 1, 2), 1_000m);
        var expenses = ExpenseRepository([included, unpaid, malformed, paidNextYear]);
        var payments = PaymentRepository([]);
        var service = Service(expenses, payments);

        var report = (await service.GetTaxYearReport(71, 2025)).Data!;
        var categories = (await service.GetTaxCategorySummary(71, 2025)).Data!;
        var deductible = (await service.GetTaxDeductibleExpenses(71, 2025)).Data!;
        var forms1099 = (await service.GetForm1099Data(71, 2025)).Data!;
        var readiness = (await service.GetTaxReadiness(71, 2025)).Data!;
        var export = (await service.ExportToAccountingSoftware(71, "csv", 2025)).Data!;

        report.AccountingBasis.Should().Be("cash");
        report.TotalExpenses.Should().Be(700m);
        report.DeductibleExpenses.Should().ContainSingle().Which.ExpenseDate.Should().Be(new DateTime(2025, 1, 5));
        categories.Should().ContainSingle().Which.TotalAmount.Should().Be(700m);
        deductible.Should().ContainSingle().Which.ExpenseId.Should().Be(1);
        forms1099.Should().ContainSingle().Which.TotalAmount.Should().Be(700m);
        readiness.TotalExpenseCount.Should().Be(1);
        readiness.DeductibleExpenseCount.Should().Be(1);
        export.FileContent.Should().Contain("2025-01-05");
        export.FileContent.Should().NotContain("2024-12-20").And.NotContain("Expense 2").And.NotContain("Expense 3").And.NotContain("Expense 4");

        expenses.Verify(x => x.GetExpensesByOrganizationId(71, null, null, null, null, null, null),
            Times.AtLeastOnce, "cash-basis filtering must not pre-filter invoices by ExpenseDate");
    }

    [Fact]
    public async Task YearFilters_IncludeSubSecondFinalInstant_AndExcludeNextYearAcrossReportsAndExports()
    {
        var finalInstant = new DateTime(2025, 12, 31, 23, 59, 59, DateTimeKind.Utc).AddTicks(9_999_999);
        var nextYear = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var inYearExpense = Expense(1, finalInstant, true, finalInstant, 700m);
        var nextYearExpense = Expense(2, nextYear, true, nextYear, 900m);
        var inYearPayment = Payment(1, 100m, "Completed");
        inYearPayment.PaymentDate = finalInstant;
        var nextYearPayment = Payment(2, 200m, "Completed");
        nextYearPayment.PaymentDate = nextYear;
        var service = Service(ExpenseRepository([inYearExpense, nextYearExpense]),
            PaymentRepository([inYearPayment, nextYearPayment]));

        var report = (await service.GetTaxYearReport(71, 2025)).Data!;
        var deductible = (await service.GetTaxDeductibleExpenses(71, 2025)).Data!;
        var export = (await service.ExportToAccountingSoftware(71, "csv", 2025)).Data!;

        report.RentIncome.Should().Be(100m);
        report.TotalExpenses.Should().Be(700m);
        report.EndDate.Should().Be(nextYear, "the year range has an exclusive upper bound");
        deductible.Select(x => x.ExpenseId).Should().Equal(1);
        export.FileContent.Should().Contain("100.00").And.Contain("Expense 1");
        export.FileContent.Should().NotContain("200.00").And.NotContain("Expense 2");
    }

    private static LoadExpenseDto Expense(long id, DateTime expenseDate, bool isPaid, DateTime? paidDate, decimal amount) => new()
    {
        Id = id,
        PropertyId = 10,
        PropertyName = "Oak",
        Name = $"Expense {id}",
        Amount = amount,
        ExpenseDate = expenseDate,
        IsPaid = isPaid,
        PaidDate = paidDate,
        IsTaxDeductible = true,
        TaxCategory = ETaxCategory.Services,
        VendorName = "Vendor",
        VendorRequires1099 = true,
        ReceiptUrl = "receipt.pdf"
    };

    private static LoadPaymentDto Payment(long id, decimal amount, string status) => new()
    {
        Id = id,
        LeaseId = 20,
        PropertyId = 10,
        PaymentDate = new DateTime(2025, 6, 1),
        Amount = amount,
        Status = status
    };

    private static Mock<IExpenseRepository> ExpenseRepository(List<LoadExpenseDto> rows)
    {
        var repository = new Mock<IExpenseRepository>();
        repository.Setup(x => x.GetExpensesByOrganizationId(71, null, null, null, null, null, null))
            .ReturnsAsync(rows);
        return repository;
    }

    private static Mock<IPaymentRepository> PaymentRepository(List<LoadPaymentDto> rows)
    {
        var repository = new Mock<IPaymentRepository>();
        repository.Setup(x => x.GetLifetimePaymentsByOrganizationId(71)).ReturnsAsync(rows);
        return repository;
    }

    private static TaxReportService Service(Mock<IExpenseRepository> expenses, Mock<IPaymentRepository> payments) =>
        new(expenses.Object, payments.Object, NullLogger<TaxReportService>.Instance);
}
