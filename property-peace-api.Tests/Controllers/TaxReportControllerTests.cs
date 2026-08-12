using brownstone_hub_api;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Tax;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ScheduleEPdfService;
using brownstone_hub_api.Services.TaxReportService;
using brownstone_hub_api.Services.UserService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class TaxReportControllerTests
{
    [Theory]
    [InlineData("year-report")]
    [InlineData("category-summary")]
    [InlineData("deductible-expenses")]
    [InlineData("form1099")]
    [InlineData("readiness")]
    [InlineData("export")]
    public async Task TaxEndpoints_IgnoreCallerLandlordId_AndUseActiveOrganization(string endpoint)
    {
        var reports = new Mock<ITaxReportService>(MockBehavior.Strict);
        var pdf = new Mock<IScheduleEPdfService>(MockBehavior.Strict);
        SetupEndpoint(reports, endpoint, 71);
        var controller = Controller(reports, pdf, organizationId: 71, userId: 12);

        var result = endpoint switch
        {
            "year-report" => await controller.GetTaxYearReport(999, 2025),
            "category-summary" => await controller.GetTaxCategorySummary(999, 2025),
            "deductible-expenses" => await controller.GetTaxDeductibleExpenses(999, 2025),
            "form1099" => await controller.GetForm1099Data(999, 2025),
            "readiness" => await controller.GetTaxReadiness(999, 2025),
            _ => await controller.ExportToAccountingSoftware(999, "csv", 2025)
        };

        result.Should().BeAssignableTo<IActionResult>();
        reports.VerifyAll();
    }

    [Fact]
    public async Task EveryEndpoint_FailsClosed_WhenOrganizationContextIsMissing()
    {
        var reports = new Mock<ITaxReportService>(MockBehavior.Strict);
        var pdf = new Mock<IScheduleEPdfService>(MockBehavior.Strict);
        var controller = Controller(reports, pdf, organizationId: null, userId: 12);

        var results = new IActionResult[]
        {
            await controller.GetTaxYearReport(999, 2025),
            await controller.GetTaxCategorySummary(999, 2025),
            await controller.GetTaxDeductibleExpenses(999, 2025),
            await controller.GetForm1099Data(999, 2025),
            await controller.GetTaxReadiness(999, 2025),
            await controller.ExportToAccountingSoftware(999, "csv", 2025),
            await controller.GetScheduleEPdf(999, 2025)
        };

        results.Should().AllSatisfy(result =>
            result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status403Forbidden));
        reports.VerifyNoOtherCalls();
        pdf.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ScheduleE_UsesServerDerivedOrganizationAndUser_AndRejectsPerProperty()
    {
        var reports = new Mock<ITaxReportService>(MockBehavior.Strict);
        var pdf = new Mock<IScheduleEPdfService>(MockBehavior.Strict);
        pdf.Setup(x => x.GenerateScheduleEPdfAsync(71, 12, 2025, false))
            .ReturnsAsync(new ServiceResponse<byte[]> { Data = [1, 2, 3] });
        var controller = Controller(reports, pdf, organizationId: 71, userId: 12);

        (await controller.GetScheduleEPdf(999, 2025, false)).Should().BeOfType<FileContentResult>();
        var unsupported = await controller.GetScheduleEPdf(999, 2025, true);
        unsupported.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(StatusCodes.Status422UnprocessableEntity);

        pdf.VerifyAll();
    }

    private static void SetupEndpoint(Mock<ITaxReportService> reports, string endpoint, long organizationId)
    {
        switch (endpoint)
        {
            case "year-report":
                reports.Setup(x => x.GetTaxYearReport(organizationId, 2025)).ReturnsAsync(new ServiceResponse<TaxYearReportDto> { Data = new() });
                break;
            case "category-summary":
                reports.Setup(x => x.GetTaxCategorySummary(organizationId, 2025)).ReturnsAsync(new ServiceResponse<List<TaxCategorySummaryDto>> { Data = [] });
                break;
            case "deductible-expenses":
                reports.Setup(x => x.GetTaxDeductibleExpenses(organizationId, 2025, null, null)).ReturnsAsync(new ServiceResponse<List<TaxDeductibleExpenseDto>> { Data = [] });
                break;
            case "form1099":
                reports.Setup(x => x.GetForm1099Data(organizationId, 2025)).ReturnsAsync(new ServiceResponse<List<Form1099Dto>> { Data = [] });
                break;
            case "readiness":
                reports.Setup(x => x.GetTaxReadiness(organizationId, 2025)).ReturnsAsync(new ServiceResponse<TaxReadinessDto> { Data = new() });
                break;
            default:
                reports.Setup(x => x.ExportToAccountingSoftware(organizationId, "csv", 2025, null, null)).ReturnsAsync(new ServiceResponse<AccountingExportDto> { Data = new() { FileContent = "ok", FileName = "x.csv" } });
                break;
        }
    }

    private static TaxReportController Controller(Mock<ITaxReportService> reports, Mock<IScheduleEPdfService> pdf, long? organizationId, long? userId)
    {
        var users = new Mock<IUserService>();
        users.Setup(x => x.GetCurrentUserIdAsync()).ReturnsAsync(userId.HasValue
            ? new ServiceResponse<long?> { Data = userId }
            : ServiceResponse<long?>.CreateError("unauthorized"));
        var controller = new TaxReportController(reports.Object, pdf.Object, users.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        if (organizationId.HasValue) controller.HttpContext.Items["OrganizationId"] = organizationId.Value;
        return controller;
    }
}
