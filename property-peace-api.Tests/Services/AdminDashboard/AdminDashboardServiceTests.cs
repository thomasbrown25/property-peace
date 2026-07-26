using brownstone_hub_api.Dtos.AdminDashboard;
using brownstone_hub_api.Repositories.AdminDashboard;
using brownstone_hub_api.Services.AdminDashboardService;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.AdminDashboard;

public sealed class AdminDashboardServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 7, 25, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(-1, 7)]
    [InlineData(7, 7)]
    [InlineData(30, 30)]
    [InlineData(200, 90)]
    public async Task GetSummaryAsync_ClampsWindowAndUsesUtcClock(int requestedWindow, int expectedWindow)
    {
        var repository = new Mock<IAdminDashboardRepository>(MockBehavior.Strict);
        repository
            .Setup(item => item.GetSummaryAsync(expectedWindow, Now.UtcDateTime, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AdminDashboardSummaryDto { WindowDays = expectedWindow, GeneratedAtUtc = Now.UtcDateTime });
        var service = new AdminDashboardService(repository.Object, new FixedTimeProvider(Now));

        var result = await service.GetSummaryAsync(requestedWindow);

        Assert.Equal(expectedWindow, result.WindowDays);
        Assert.Equal(Now.UtcDateTime, result.GeneratedAtUtc);
        repository.VerifyAll();
    }

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
