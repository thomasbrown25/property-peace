using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ScheduleEPdfService;
using brownstone_hub_api.Services.TaxReportService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Tax;

public sealed class ScheduleEPdfServiceSecurityTests
{
    [Fact]
    public async Task PerPropertyReport_IsExplicitlyUnavailable_AndDoesNotGenerateZeroIncomeFiction()
    {
        var reports = new Mock<ITaxReportService>(MockBehavior.Strict);
        var users = new Mock<IUserRepository>(MockBehavior.Strict);
        var service = new ScheduleEPdfService(reports.Object, users.Object, NullLogger<ScheduleEPdfService>.Instance);

        var response = await service.GenerateScheduleEPdfAsync(71, 12, 2025, perProperty: true);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(StatusCodes.Status422UnprocessableEntity);
        response.Data.Should().BeNull();
        response.Message.Should().Contain("unsupported").And.Contain("No PDF was generated");
        reports.VerifyNoOtherCalls();
        users.VerifyNoOtherCalls();
    }
}
