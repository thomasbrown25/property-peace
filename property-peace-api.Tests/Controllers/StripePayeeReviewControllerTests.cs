using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripePayeeReviewControllerTests
{
    [Fact]
    public async Task BeginReview_RefreshesAndPersistsAuthoritativeStripeSnapshotBeforeReviewing()
    {
        const string accountId = "acct_remediated";
        var now = new DateTimeOffset(2026, 8, 2, 20, 0, 0, TimeSpan.Zero);
        var snapshot = new StripeConnectedAccountSnapshot(
            accountId, now, true, true, true, "active", [], [], null, "fp", "manual", false);
        var review = new StripeConnectedPayeeReview
        {
            StripeAccountId = accountId,
            Status = StripePayeeReviewStatus.UnderReview,
            CreatedAt = now.AddDays(-1),
            UpdatedAt = now
        };
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        var service = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        var sequence = new MockSequence();
        gateway.InSequence(sequence)
            .Setup(x => x.GetSnapshotAsync(accountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(snapshot);
        service.InSequence(sequence)
            .Setup(x => x.SyncStripeSnapshotAsync(snapshot, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(review);
        service.InSequence(sequence)
            .Setup(x => x.BeginReviewAsync(accountId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(review);
        var controller = new StripePayeeReviewController(service.Object, gateway.Object);

        var result = await controller.BeginReview(accountId, CancellationToken.None);

        result.Result.Should().BeOfType<OkObjectResult>();
        gateway.VerifyAll();
        service.VerifyAll();
    }

    [Fact]
    public async Task BeginReview_StillRestrictedSuspension_ReturnsConflictInsteadOfServerError()
    {
        const string accountId = "acct_still_restricted";
        var now = new DateTimeOffset(2026, 8, 2, 20, 0, 0, TimeSpan.Zero);
        var snapshot = new StripeConnectedAccountSnapshot(
            accountId, now, true, true, true, "active", [], [], null, "fp", "daily", false);
        var suspended = new StripeConnectedPayeeReview
        {
            StripeAccountId = accountId,
            Status = StripePayeeReviewStatus.Suspended,
            CreatedAt = now.AddDays(-1),
            UpdatedAt = now
        };
        var gateway = new Mock<IStripeConnectedAccountGateway>();
        gateway.Setup(x => x.GetSnapshotAsync(accountId, It.IsAny<CancellationToken>())).ReturnsAsync(snapshot);
        var service = new Mock<IStripeConnectedPayeeService>();
        service.Setup(x => x.SyncStripeSnapshotAsync(snapshot, null, It.IsAny<CancellationToken>())).ReturnsAsync(suspended);
        service.Setup(x => x.BeginReviewAsync(accountId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("A fresh healthy Stripe snapshot is required."));
        var controller = new StripePayeeReviewController(service.Object, gateway.Object);

        var result = await controller.BeginReview(accountId, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
    }

    [Fact]
    public async Task BeginReview_ConcurrentWebhookUpdate_ReturnsConflictInsteadOfServerError()
    {
        const string accountId = "acct_concurrent";
        var now = new DateTimeOffset(2026, 8, 2, 20, 0, 0, TimeSpan.Zero);
        var snapshot = new StripeConnectedAccountSnapshot(
            accountId, now, true, true, true, "active", [], [], null, "fp", "manual", false);
        var gateway = new Mock<IStripeConnectedAccountGateway>();
        gateway.Setup(x => x.GetSnapshotAsync(accountId, It.IsAny<CancellationToken>())).ReturnsAsync(snapshot);
        var service = new Mock<IStripeConnectedPayeeService>();
        service.Setup(x => x.SyncStripeSnapshotAsync(snapshot, null, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException("simulated webhook race"));
        var controller = new StripePayeeReviewController(service.Object, gateway.Object);

        var result = await controller.BeginReview(accountId, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
        service.Verify(x => x.BeginReviewAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Suspend_ConcurrentWebhookUpdate_ReturnsConflictInsteadOfServerError()
    {
        const string accountId = "acct_suspend_race";
        var service = new Mock<IStripeConnectedPayeeService>(MockBehavior.Strict);
        var gateway = new Mock<IStripeConnectedAccountGateway>(MockBehavior.Strict);
        service.Setup(x => x.SuspendAsync(accountId, 99, "manual hold", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateConcurrencyException("row changed"));
        var controller = new StripePayeeReviewController(service.Object, gateway.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.NameIdentifier, "99"),
                        new Claim(ClaimTypes.Role, "Admin")
                    ], "test"))
                }
            }
        };

        var result = await controller.Suspend(accountId,
            new brownstone_hub_api.Dtos.Stripe.SuspendStripePayeeRequest { Reason = "manual hold" }, CancellationToken.None);

        result.Result.Should().BeOfType<ConflictObjectResult>();
    }
}
