using System.Globalization;
using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.TaxReportService;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Tax;

public sealed class TaxReportServiceSecurityTests
{
    [Fact]
    public async Task ReportAndExport_QueryOnlyCanonicalOrganizationScope()
    {
        var expenses = new Mock<IExpenseRepository>(MockBehavior.Strict);
        var payments = new Mock<IPaymentRepository>(MockBehavior.Strict);
        expenses.Setup(x => x.GetExpensesByOrganizationId(71, null, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, null, null))
            .ReturnsAsync([]);
        payments.Setup(x => x.GetLifetimePaymentsByOrganizationId(71)).ReturnsAsync([]);
        var service = Service(expenses, payments);

        (await service.GetTaxYearReport(71, 2025)).Success.Should().BeTrue();
        (await service.ExportToAccountingSoftware(71, "csv", 2025)).Success.Should().BeTrue();

        expenses.Verify(x => x.GetExpensesByOrganizationId(71, null, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, null, null), Times.Exactly(2));
        payments.Verify(x => x.GetLifetimePaymentsByOrganizationId(71), Times.Exactly(2));
        expenses.Verify(x => x.GetExpensesByLandlordId(It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<string?>(), It.IsAny<long?>(), It.IsAny<bool?>()), Times.Never);
        payments.Verify(x => x.GetLifetimePaymentsByLandlordId(It.IsAny<long>()), Times.Never);
    }

    [Theory]
    [InlineData("csv")]
    [InlineData("accountant")]
    [InlineData("quickbooks")]
    [InlineData("xero")]
    public async Task EveryExportedUserTextField_IsSpreadsheetSafe_AndSingleLine(string format)
    {
        var expenses = new Mock<IExpenseRepository>();
        var payments = new Mock<IPaymentRepository>();
        expenses.Setup(x => x.GetExpensesByOrganizationId(71, null, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, null, null))
            .ReturnsAsync([MaliciousExpense()]);
        payments.Setup(x => x.GetLifetimePaymentsByOrganizationId(71)).ReturnsAsync([MaliciousPayment()]);
        var service = Service(expenses, payments);

        var priorCulture = CultureInfo.CurrentCulture;
        CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("de-DE");
        try
        {
            var export = (await service.ExportToAccountingSoftware(71, format, 2025)).Data!;

            export.FileContent.Should().NotContain("\tMETHOD");
            export.FileContent.Should().NotContain("\rINJECT");
            export.FileContent.Should().NotContain("\nINJECT");
            foreach (var marker in new[] { "=DESC", "+CAT", "-PROP", "@VENDOR", "=TENANT", "+PAYPROP", "@PAYMETHOD", "-FEE" })
            {
                if (export.FileContent.Contains(marker, StringComparison.Ordinal))
                    export.FileContent.Should().Contain("'" + marker);
            }
            export.FileContent.Should().Contain("1234.56").And.NotContain("1234,56");
            (export.FileContent.Contains("2025-02-03", StringComparison.Ordinal) ||
             export.FileContent.Contains("02/03/2025", StringComparison.Ordinal)).Should().BeTrue();
            export.FileContent.Split('\n').Should().NotContain(line => line.StartsWith('=') || line.StartsWith('+') || line.StartsWith('@'));
        }
        finally
        {
            CultureInfo.CurrentCulture = priorCulture;
        }
    }

    [Theory]
    [InlineData("quickbooks")]
    [InlineData("xero")]
    public async Task ThirdPartyFormats_AreExplicitlyExperimentalTemplates_NotImportClaims(string format)
    {
        var expenses = new Mock<IExpenseRepository>();
        var payments = new Mock<IPaymentRepository>();
        expenses.Setup(x => x.GetExpensesByOrganizationId(71, null, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, null, null)).ReturnsAsync([]);
        payments.Setup(x => x.GetLifetimePaymentsByOrganizationId(71)).ReturnsAsync([]);

        var export = (await Service(expenses, payments).ExportToAccountingSoftware(71, format, 2025)).Data!;

        export.FileName.Should().Contain("experimental-import-template");
        export.IsExperimentalTemplate.Should().BeTrue();
        export.ImportDisclaimer.Should().Contain("not guarantee");
    }

    [Fact]
    public async Task Form1099_MasksVendorTinAndDoesNotWriteRawValueToLogs()
    {
        const string tin = "12-3456789";
        var expenses = new Mock<IExpenseRepository>();
        var payments = new Mock<IPaymentRepository>();
        var logger = new RecordingLogger<TaxReportService>();
        expenses.Setup(x => x.GetExpensesByOrganizationId(71, null, It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), null, null, null))
            .ReturnsAsync([new LoadExpenseDto
            {
                Id = 1,
                ExpenseDate = new DateTime(2025, 2, 3),
                IsPaid = true,
                PaidDate = new DateTime(2025, 2, 3),
                Amount = 700m,
                IsTaxDeductible = true,
                TaxCategory = ETaxCategory.Services,
                VendorName = "Vendor",
                VendorTaxId = tin,
                VendorRequires1099 = true
            }]);

        var response = await new TaxReportService(expenses.Object, payments.Object, logger).GetForm1099Data(71, 2025);

        response.Success.Should().BeTrue();
        response.Data.Should().ContainSingle().Which.VendorTaxId.Should().Be("***-**-6789");
        logger.Messages.Should().NotContain(message => message.Contains(tin, StringComparison.Ordinal));
    }

    private static LoadExpenseDto MaliciousExpense() => new()
    {
        Id = 1,
        PropertyId = 2,
        ExpenseDate = new DateTime(2025, 2, 3),
        IsPaid = true,
        PaidDate = new DateTime(2025, 2, 3),
        Amount = 1234.56m,
        IsTaxDeductible = true,
        TaxCategory = null,
        Name = "=DESC,\r\nINJECT",
        Category = "+CAT,INJECT",
        PropertyName = "-PROP\nINJECT",
        VendorName = "@VENDOR\tINJECT",
        PaymentMethod = "\tMETHOD,INJECT"
    };

    private static LoadPaymentDto MaliciousPayment() => new()
    {
        Id = 3,
        LeaseId = 4,
        PropertyId = 2,
        PaymentDate = new DateTime(2025, 2, 3),
        Amount = 1234.56m,
        Status = "completed",
        TenantName = "=TENANT,\nINJECT",
        PropertyName = "+PAYPROP,INJECT",
        Method = "@PAYMETHOD\rINJECT",
        FeeId = 5,
        FeeName = "-FEE\tINJECT"
    };

    private static TaxReportService Service(Mock<IExpenseRepository> expenses, Mock<IPaymentRepository> payments) =>
        new(expenses.Object, payments.Object, NullLogger<TaxReportService>.Instance);

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }
}
