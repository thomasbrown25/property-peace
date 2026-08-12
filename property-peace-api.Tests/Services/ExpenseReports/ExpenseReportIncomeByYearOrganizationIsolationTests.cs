using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.ExpenseReportService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.ExpenseReports;

public sealed class ExpenseReportIncomeByYearOrganizationIsolationTests
{
    [Fact]
    public async Task GetIncomeByYear_WithProperty_UsesOneAtomicOrganizationScopedPaymentQuery()
    {
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var payments = new Mock<IPaymentRepository>(MockBehavior.Strict);
        payments
            .Setup(x => x.GetPaymentsByOrganizationAndPropertyId(
                10,
                101,
                new DateTime(2024, 1, 1),
                new DateTime(2026, 1, 1)))
            .ReturnsAsync(
            [
                new LoadPaymentDto { PropertyId = 101, PaymentDate = new DateTime(2024, 6, 1), Amount = 125m },
                new LoadPaymentDto { PropertyId = 101, PaymentDate = new DateTime(2025, 7, 1), Amount = 250m }
            ]);
        using var context = DbContextFactory.Create();
        var service = Service(properties, payments, context);

        var response = await service.GetIncomeByYear(10, 101, 2024, 2025);

        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.Select(x => (x.Year, x.TotalAmount)).Should().Equal((2024, 125m), (2025, 250m));
        properties.VerifyNoOtherCalls();
        payments.VerifyAll();
        payments.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetIncomeByYear_ForeignProperty_ReturnsEmptyFromAtomicScopedQuery()
    {
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var payments = new Mock<IPaymentRepository>(MockBehavior.Strict);
        payments
            .Setup(x => x.GetPaymentsByOrganizationAndPropertyId(
                10,
                202,
                new DateTime(2024, 1, 1),
                new DateTime(2026, 1, 1)))
            .ReturnsAsync([]);
        using var context = DbContextFactory.Create();
        var service = Service(properties, payments, context);

        var response = await service.GetIncomeByYear(10, 202, 2024, 2025);

        response.Success.Should().BeTrue();
        response.Data.Should().HaveCount(2).And.OnlyContain(x => x.TotalAmount == 0m && x.Count == 0);
        properties.VerifyNoOtherCalls();
        payments.VerifyAll();
        payments.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetIncomeByYear_WithoutPropertyFilter_QueriesOrganizationOnceAndDerivesRequestedYears()
    {
        var properties = new Mock<IPropertyRepository>(MockBehavior.Strict);
        var payments = new Mock<IPaymentRepository>(MockBehavior.Strict);
        payments
            .Setup(x => x.GetPaymentsByOrganizationAndPropertyId(
                10,
                null,
                new DateTime(2023, 1, 1),
                new DateTime(2026, 1, 1)))
            .ReturnsAsync(
            [
                new LoadPaymentDto { PaymentDate = new DateTime(2023, 1, 1), Amount = 10m },
                new LoadPaymentDto { PaymentDate = new DateTime(2024, 1, 1), Amount = 999m },
                new LoadPaymentDto { PaymentDate = new DateTime(2025, 12, 31).AddDays(1).AddTicks(-1), Amount = 20m }
            ]);
        using var context = DbContextFactory.Create();
        var service = Service(properties, payments, context);

        var response = await service.GetIncomeByYear(10, null, 2023, 2025);

        response.Success.Should().BeTrue();
        response.Data!.Select(x => (x.Year, x.TotalAmount)).Should().Equal((2023, 10m), (2025, 20m));
        properties.VerifyNoOtherCalls();
        payments.VerifyAll();
        payments.VerifyNoOtherCalls();
    }

    private static ExpenseReportService Service(
        Mock<IPropertyRepository> properties,
        Mock<IPaymentRepository> payments,
        Data.DataContext context) =>
        new(
            Mock.Of<IExpenseRepository>(),
            payments.Object,
            properties.Object,
            context,
            NullLogger<ExpenseReportService>.Instance);
}
