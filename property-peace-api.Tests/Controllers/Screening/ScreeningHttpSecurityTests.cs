using System.Reflection;
using brownstone_hub_api.Config;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Domain.Screening;
using brownstone_hub_api.Dtos.Screening;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers.Screening;

public sealed class ScreeningHttpSecurityTests
{
    [Fact]
    public void Staff_controller_has_fixed_route_roles_and_feature_gate()
    {
        var type = typeof(ScreeningsController);
        type.GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/screenings");
        type.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Landlord,Admin");
        type.GetCustomAttributes().Should().Contain(x => x is RequireFeatureReadyAttribute);
        typeof(CreateScreeningInvitationDto).GetProperties().Select(x => x.Name)
            .Should().NotContain(x => x.Contains("Organization", StringComparison.OrdinalIgnoreCase) || x.Contains("UserId", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Applicant_and_webhook_controllers_are_anonymous_with_fixed_routes()
    {
        typeof(ScreeningApplicantController).GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/screenings/applicant");
        typeof(ScreeningApplicantController).GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
        typeof(ScreeningWebhooksController).GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/screenings/webhooks/{providerKey}");
        typeof(ScreeningWebhooksController).GetCustomAttribute<AllowAnonymousAttribute>().Should().NotBeNull();
    }

    [Fact]
    public async Task Invitation_requires_idempotency_header_before_service_call()
    {
        var screening = new Mock<ITenantScreeningService>(MockBehavior.Strict);
        var controller = StaffController(screening);
        var result = await controller.CreateInvitation(new CreateScreeningInvitationDto
            { ApplicationId = 1, Package = "basic", Payer = ScreeningPayer.Landlord }, null, default);
        result.Should().BeOfType<BadRequestObjectResult>();
        screening.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Invitation_derives_org_and_user_from_authenticated_context_and_returns_staff_safe_shape()
    {
        CreateTenantScreeningInvitationCommand? captured = null;
        var service = new Mock<ITenantScreeningService>();
        service.Setup(x => x.CreateInvitationAsync(It.IsAny<CreateTenantScreeningInvitationCommand>(), default))
            .Callback<CreateTenantScreeningInvitationCommand, CancellationToken>((command, _) => captured = command)
            .ReturnsAsync(new StaffScreeningOrderResult(3, 44, 5, ScreeningStatus.Invited, 1, "basic",
                ScreeningPayer.Landlord, 100, 0, 100, "USD", DateTimeOffset.UtcNow.AddMinutes(5), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow));
        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new LoadUserDto { Id = 77 });
        var controller = WithContext(new ScreeningsController(service.Object, Mock.Of<ITenantScreeningDecisionService>(),
            Mock.Of<ITenantScreeningAdverseActionService>(), users.Object));
        controller.HttpContext.Items["OrganizationId"] = 99L;
        var result = await controller.CreateInvitation(new CreateScreeningInvitationDto
            { ApplicationId = 44, Package = "basic", Payer = ScreeningPayer.Landlord }, "never-echo-this-key", default);
        result.Should().BeOfType<AcceptedResult>();
        captured!.OrganizationId.Should().Be(99);
        captured.RequesterUserId.Should().Be(77);
        captured.IdempotencyKey.Should().Be("never-echo-this-key");
        result.ToString().Should().NotContain("never-echo-this-key").And.NotContain("http");
    }

    [Fact]
    public async Task Unavailable_exception_maps_to_generic_503_without_raw_details()
    {
        var service = new Mock<ITenantScreeningService>();
        service.Setup(x => x.GetStaffOrderAsync(99, 77, 3, default))
            .ThrowsAsync(new ScreeningUnavailableException(new Exception("provider-secret")));
        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new LoadUserDto { Id = 77 });
        var controller = WithContext(new ScreeningsController(service.Object, Mock.Of<ITenantScreeningDecisionService>(),
            Mock.Of<ITenantScreeningAdverseActionService>(), users.Object));
        controller.HttpContext.Items["OrganizationId"] = 99L;
        var result = await controller.GetOrder(3, default);
        var status = result.Should().BeOfType<ObjectResult>().Subject;
        status.StatusCode.Should().Be(503);
        status.Value!.ToString().Should().NotContain("provider-secret");
    }

    [Fact]
    public async Task Applicant_requires_header_and_always_sets_secure_response_headers()
    {
        var controller = ApplicantController(new Mock<ITenantScreeningService>(MockBehavior.Strict));
        var result = await controller.Invitation(default);
        result.Should().BeOfType<UnauthorizedObjectResult>();
        controller.Response.Headers.CacheControl.ToString().Should().Be("no-store");
        controller.Response.Headers["Referrer-Policy"].ToString().Should().Be("no-referrer");
    }

    [Fact]
    public async Task Applicant_session_exchanges_header_for_secure_short_lived_cookie()
    {
        const string token = "raw-secret-token";
        var service = new Mock<ITenantScreeningService>();
        service.Setup(x => x.GetApplicantStatusAsync(token, default))
            .ReturnsAsync((ApplicantScreeningStatusResult)null!);
        var controller = WithContext(new ScreeningApplicantController(service.Object,
            Mock.Of<ITenantScreeningDecisionService>(), dataProtectionProvider: new EphemeralDataProtectionProvider()));
        controller.Request.Headers["X-Screening-Access"] = token;

        var action = await controller.CreateSession(default);

        action.Should().BeOfType<NoContentResult>();
        var cookie = controller.Response.Headers.SetCookie.ToString().ToLowerInvariant();
        cookie.Should().Contain("pp-screening-session=").And.Contain("httponly").And.Contain("secure")
            .And.Contain("samesite=strict").And.Contain("path=/api/screenings/applicant");
        cookie.Should().NotContain(token);
        controller.Response.Headers["X-Robots-Tag"].ToString().Should().Be("noindex, nofollow");
        service.VerifyAll();
    }

    [Fact]
    public async Task Applicant_continuation_is_no_store_json_for_explicit_top_level_navigation()
    {
        const string token = "raw-secret-token";
        var service = new Mock<ITenantScreeningService>();
        service.Setup(x => x.ConsentAndStartAsync(token, "quote", "d1", "a1", It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync(new ApplicantScreeningConsentResult(1, ScreeningStatus.Processing, ScreeningConsentOutcome.Started,
                new Uri("https://provider.invalid/continue"), DateTimeOffset.UtcNow.AddMinutes(5)));
        var controller = ApplicantController(service);
        controller.Request.Headers["X-Screening-Access"] = token;
        var action = await controller.ConsentAndStart(new ApplicantConsentDto { ExpectedQuoteReference = "quote", DisclosureAccepted = true,
            AuthorizationAccepted = true, DisclosureVersion = "d1", AuthorizationVersion = "a1" }, default);
        var body = action.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<ScreeningContinuationExchangeDto>().Subject;
        body.ContinuationUrl.Should().Be("https://provider.invalid/continue");
        body.ExpiresAt.Should().BeAfter(DateTimeOffset.UtcNow);
        body.GetType().GetProperties().Select(x => x.Name).Should().BeEquivalentTo("ContinuationUrl", "ExpiresAt");
        controller.Response.Headers.CacheControl.ToString().Should().Be("no-store");
        controller.Response.Headers.Location.Should().BeEmpty();
    }

    [Fact]
    public async Task Staff_report_access_is_no_store_safe_json_not_a_redirect_or_provider_shape()
    {
        var expires = DateTimeOffset.UtcNow.AddMinutes(5);
        var decisions = new Mock<ITenantScreeningDecisionService>();
        decisions.Setup(x => x.RequestReportAccessAsync(99, 77, 3, ScreeningReportAccessPurpose.RentalDecision, null, default))
            .ReturnsAsync(ScreeningReportAccessResult.Create(new Uri("https://reports.provider.test/secret"), expires,
                "provider-grant-secret", [new Uri("https://reports.provider.test/")], DateTimeOffset.UtcNow));
        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new LoadUserDto { Id = 77 });
        var controller = WithContext(new ScreeningsController(Mock.Of<ITenantScreeningService>(), decisions.Object,
            Mock.Of<ITenantScreeningAdverseActionService>(), users.Object));
        controller.HttpContext.Items["OrganizationId"] = 99L;

        var action = await controller.ReportAccess(3, new ScreeningReportAccessDto { Purpose = ScreeningReportAccessPurpose.RentalDecision }, default);

        var body = action.Should().BeOfType<OkObjectResult>().Subject.Value.Should().BeOfType<ScreeningReportAccessExchangeDto>().Subject;
        body.AccessUrl.Should().Be("https://reports.provider.test/secret");
        body.GetType().GetProperties().Select(x => x.Name).Should().BeEquivalentTo("AccessUrl", "ExpiresAt");
        (body.ToString() + action).Should().NotContain("provider-grant-secret");
        controller.Response.Headers.CacheControl.ToString().Should().Be("no-store");
        controller.Response.Headers.Location.Should().BeEmpty();
    }

    [Fact]
    public async Task Applicant_adverse_action_returns_complete_immutable_applicant_notice_with_no_store_no_referrer_and_no_provider_references()
    {
        const string token = "applicant-capability";
        var notice = new ApplicantAdverseActionNoticeSummary(
            ScreeningAdverseActionType.FinalAdverseAction, DateTimeOffset.UtcNow, ["income"],
            ScreeningDeliveryAttemptStatus.Delivered, DateTimeOffset.UtcNow,
            ScreeningReconsiderationStatus.NotRequested, "/support/screening", "notice-v7", new string('a', 64),
            "immutable complete notice", "Example CRA", "1 CRA Way", "800-555-0100",
            "CRA did not decide", "dispute rights", "free-copy rights", "CA", "CA-2026", "California rights");
        var adverse = new Mock<ITenantScreeningAdverseActionService>(MockBehavior.Strict);
        adverse.Setup(x => x.GetApplicantNoticeAsync(token, default)).ReturnsAsync(notice);
        var controller = WithContext(new ScreeningApplicantController(Mock.Of<ITenantScreeningService>(),
            Mock.Of<ITenantScreeningDecisionService>(), adverse.Object));
        controller.Request.Headers["X-Screening-Access"] = token;

        var action = await controller.AdverseAction(default);

        var body = action.Should().BeOfType<OkObjectResult>().Which.Value
            .Should().BeOfType<ApplicantAdverseActionNoticeSummary>().Subject;
        body.Should().Be(notice);
        body.ImmutableNoticeContent.Should().Be("immutable complete notice");
        body.CraDidNotDecideStatement.Should().Be("CRA did not decide");
        body.DisputeRightsStatement.Should().Be("dispute rights");
        body.FreeCopyRightsStatement.Should().Be("free-copy rights");
        body.JurisdictionDisclosure.Should().Be("California rights");
        body.GetType().GetProperties().Should().NotContain(x =>
            x.Name.Contains("Provider", StringComparison.OrdinalIgnoreCase) ||
            x.Name.Contains("Reference", StringComparison.OrdinalIgnoreCase));
        controller.Response.Headers.CacheControl.ToString().Should().Be("no-store");
        controller.Response.Headers["Referrer-Policy"].ToString().Should().Be("no-referrer");
        controller.Response.Headers.Location.Should().BeEmpty();
        adverse.VerifyAll();
    }

    [Fact]
    public async Task Applicant_report_access_uses_capability_scope_and_fixed_dispute_review_purpose()
    {
        const string token = "applicant-capability";
        var decisions = new Mock<ITenantScreeningDecisionService>(MockBehavior.Strict);
        decisions.Setup(x => x.RequestApplicantReportAccessAsync(token, ScreeningReportAccessPurpose.DisputeReview, default))
            .ReturnsAsync(ScreeningReportAccessResult.Create(new Uri("https://reports.provider.test/dispute"),
                DateTimeOffset.UtcNow.AddMinutes(5), "grant", [new Uri("https://reports.provider.test/")], DateTimeOffset.UtcNow));
        var controller = WithContext(new ScreeningApplicantController(Mock.Of<ITenantScreeningService>(), decisions.Object));
        controller.Request.Headers["X-Screening-Access"] = token;

        var action = await controller.ReportAccess(default);

        action.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeOfType<ScreeningReportAccessExchangeDto>();
        controller.Response.Headers.CacheControl.ToString().Should().Be("no-store");
        decisions.VerifyAll();
    }

    [Fact]
    public async Task Application_quote_options_are_server_resolved_under_authenticated_scope()
    {
        var screening = new Mock<ITenantScreeningService>();
        screening.Setup(x => x.GetQuoteOptionsAsync(99, 77, 44, default)).ReturnsAsync(
            new ScreeningQuoteOptionsResult([new ScreeningQuoteOption("standard", ScreeningPayer.Applicant)]));
        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new LoadUserDto { Id = 77 });
        var controller = WithContext(new ScreeningsController(screening.Object, Mock.Of<ITenantScreeningDecisionService>(),
            Mock.Of<ITenantScreeningAdverseActionService>(), users.Object));
        controller.HttpContext.Items["OrganizationId"] = 99L;

        var action = await controller.QuoteOptions(44, default);

        action.Should().BeOfType<OkObjectResult>().Which.Value.Should().BeOfType<ScreeningQuoteOptionsResult>();
        screening.VerifyAll();
    }

    [Fact]
    public void Staff_and_applicant_safe_results_expose_milestone_three_local_state_only()
    {
        typeof(StaffScreeningDetailResult).GetProperties().Select(x => x.Name).Should().Contain(
            "RentalCriteriaVersion", "RentalCriteriaStatement", "ReasonCodeOptions",
            "ApplicantAccessExpiresAt", "ApplicantAccessRevoked", "LatestReportRevisionId");
        typeof(ApplicantScreeningStatusResult).GetProperties().Select(x => x.Name).Should().Contain("LatestReportRevision");
        new[] { typeof(StaffScreeningDetailResult), typeof(ApplicantScreeningStatusResult), typeof(ScreeningQuoteOptionsResult) }
            .SelectMany(x => x.GetProperties()).Should().NotContain(x =>
                x.Name.Contains("ProviderReference", StringComparison.OrdinalIgnoreCase) ||
                x.Name.Contains("ProviderOrder", StringComparison.OrdinalIgnoreCase) ||
                x.Name.Contains("Token", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Webhook_preserves_exact_body_and_all_header_values()
    {
        var bytes = new byte[] { 0, 1, 2, 255 };
        ScreeningCallbackRequest? captured = null;
        var service = new Mock<ITenantScreeningService>();
        service.Setup(x => x.ApplyVerifiedCallbackAsync("vendor", It.IsAny<ScreeningCallbackRequest>(), default))
            .Callback<string, ScreeningCallbackRequest, CancellationToken>((_, r, _) => captured = r)
            .ReturnsAsync(new ScreeningCallbackApplyResult(ScreeningCallbackOutcome.Applied, 1, 1));
        var controller = WebhookController(service, bytes);
        controller.Request.Headers.Append("X-Signature", "one");
        controller.Request.Headers.Append("X-Signature", "two");
        (await controller.Receive("vendor", default)).Should().BeOfType<AcceptedResult>();
        captured!.Payload.ToArray().Should().Equal(bytes);
        captured.Headers["X-Signature"].Should().Equal("one", "two");
        captured.ToString().Should().NotContain("one").And.NotContain("255");
    }

    [Fact]
    public async Task Webhook_rejects_oversize_before_service()
    {
        var service = new Mock<ITenantScreeningService>(MockBehavior.Strict);
        var controller = WebhookController(service, []);
        controller.Request.ContentLength = ScreeningWebhooksController.MaximumBodyBytes + 1;
        var result = await controller.Receive("vendor", default);
        result.Should().BeOfType<StatusCodeResult>().Which.StatusCode.Should().Be(413);
        service.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Unavailable_adapters_fail_closed_and_redact_ToString()
    {
        var gateway = new UnavailableScreeningProviderGateway();
        await gateway.Invoking(x => x.GetStatusAsync(null!)).Should().ThrowAsync<ScreeningUnavailableException>();
        var verifier = new UnavailableScreeningCallbackVerifier();
        await verifier.Invoking(x => x.VerifyAsync("vendor", null!).AsTask()).Should().ThrowAsync<ScreeningUnavailableException>();
        new UnavailableScreeningApplicantLinkFactory().Invoking(x => x.CreateApplicantAccessLink("secret"))
            .Should().Throw<ScreeningUnavailableException>();
        new object[] { gateway, verifier, new UnavailableScreeningPolicyResolver(), new UnavailableScreeningApplicantInvitationDelivery(),
            new UnavailableScreeningApplicantLinkFactory(), new UnavailableAdverseActionPolicyResolver(), new UnavailableScreeningNoticeDelivery() }
            .Should().OnlyContain(x => x.ToString()!.Contains("[REDACTED]") && !x.ToString()!.Contains("secret"));
        new ScreeningUnavailableException(new Exception("raw-secret")).ToString().Should().NotContain("raw-secret");
    }

    private static ScreeningsController StaffController(Mock<ITenantScreeningService> screening) => WithContext(new ScreeningsController(
        screening.Object, Mock.Of<ITenantScreeningDecisionService>(), Mock.Of<ITenantScreeningAdverseActionService>(), Mock.Of<IUserRepository>()));
    private static ScreeningApplicantController ApplicantController(Mock<ITenantScreeningService> service) =>
        WithContext(new ScreeningApplicantController(service.Object, Mock.Of<ITenantScreeningDecisionService>()));
    private static ScreeningWebhooksController WebhookController(Mock<ITenantScreeningService> service, byte[] body)
    {
        var controller = WithContext(new ScreeningWebhooksController(service.Object));
        controller.Request.Body = new MemoryStream(body);
        return controller;
    }
    private static T WithContext<T>(T controller) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        return controller;
    }
}
