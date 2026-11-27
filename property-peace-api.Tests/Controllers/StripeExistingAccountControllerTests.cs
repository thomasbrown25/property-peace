using System.Net;
using System.Security.Claims;
using System.Text;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripeExistingAccountControllerTests
{
    [Fact]
    public async Task Authorize_uses_Stripe_and_binds_state_to_current_user_and_organization()
    {
        var f = new Fixture();
        Assert.IsType<OkObjectResult>(await f.Controller.Begin(default));
        var url = new Uri(f.OAuth.CreateAuthorizationUrl(7, 12)!);
        var parameters = QueryHelpers.ParseQuery(url.Query);
        var state = parameters["state"].ToString();

        Assert.Equal("https://connect.stripe.com/oauth/authorize", url.GetLeftPart(UriPartial.Path));
        Assert.Equal("ca_TestClient", parameters["client_id"].ToString());
        Assert.Equal("read_write", parameters["scope"].ToString());
        Assert.Equal("https://app.example.com/landlord/settings?tab=payments&paymentTab=stripe&stripe=existing-return",
            parameters["redirect_uri"].ToString());
        Assert.NotNull(f.OAuth.ValidateState(state, 7, 12));
        Assert.Null(f.OAuth.ValidateState(state, 8, 12));
        Assert.Null(f.OAuth.ValidateState(state, 7, 13));
        Assert.Null(f.OAuth.ValidateState(state + "invalid", 7, 12));
    }

    [Fact]
    public async Task Unconfigured_or_impersonated_sessions_never_start_Stripe_authorization()
    {
        var unconfigured = new Fixture(configured: false);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable,
            Assert.IsType<ObjectResult>(await unconfigured.Controller.Begin(default)).StatusCode);

        var impersonated = new Fixture();
        ((ClaimsIdentity)impersonated.Controller.User.Identity!).AddClaim(new Claim("impersonation_session_id", "test-session"));
        Assert.Equal(StatusCodes.Status403Forbidden,
            Assert.IsType<ObjectResult>(await impersonated.Controller.Begin(default)).StatusCode);
    }

    [Fact]
    public async Task Completion_exchanges_only_a_claimed_code_and_registers_the_account_returned_by_Stripe()
    {
        var f = new Fixture();
        var state = f.GetState();
        var nonce = f.OAuth.ValidateState(state, 7, 12)!;
        f.Replay.SetupSequence(store => store.TryConsumeAsync("ac_TestCode", nonce, default))
            .ReturnsAsync(true).ReturnsAsync(false);
        f.Accounts.Setup(x => x.GetSnapshotAsync("acct_Existing", default)).ReturnsAsync(f.EligibleAccount());

        Assert.IsType<OkObjectResult>(await f.Controller.Complete(new("ac_TestCode", state, null), default));
        Assert.IsType<ConflictObjectResult>(await f.Controller.Complete(new("ac_TestCode", state, null), default));

        Assert.Equal(1, f.Stripe.RequestCount);
        Assert.Equal("https://connect.stripe.com/oauth/token", f.Stripe.RequestUrl);
        Assert.Equal("authorization_code", f.Stripe.Form!["grant_type"].ToString());
        Assert.Equal("ac_TestCode", f.Stripe.Form["code"].ToString());
        f.Payees.Verify(x => x.RegisterInitialAccountAsync(7, "acct_Existing", true, default), Times.Once);
    }

    [Fact]
    public async Task Cancelled_or_cross_organization_callbacks_never_exchange_a_code()
    {
        var f = new Fixture();
        Assert.IsType<OkObjectResult>(await f.Controller.Complete(new(null, f.GetState(), "access_denied"), default));
        Assert.IsType<BadRequestObjectResult>(await f.Controller.Complete(new("ac_TestCode", f.GetState(13), null), default));
        Assert.Equal(0, f.Stripe.RequestCount);
        f.Replay.VerifyNoOtherCalls();
        f.Payees.Verify(x => x.RegisterInitialAccountAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), default), Times.Never);
    }

    [Fact]
    public async Task Both_endpoints_require_preparation_and_an_unlinked_landlord()
    {
        var f = new Fixture();
        f.Preparation.Setup(x => x.GetValidatedForHandoffAsync(7, 12, default)).ReturnsAsync((StripeConnectPreparationDto?)null);
        Assert.IsType<ConflictObjectResult>(await f.Controller.Begin(default));
        Assert.IsType<ConflictObjectResult>(await f.Controller.Complete(new("ac_TestCode", f.GetState(), null), default));

        f.Payees.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(7, 12, default))
            .ReturnsAsync(new OwnedStripeAccount(7, "acct_AlreadyLinked"));
        Assert.IsType<ConflictObjectResult>(await f.Controller.Begin(default));
        Assert.Equal(0, f.Stripe.RequestCount);
    }

    [Theory]
    [InlineData("read_only", false, "US", "full")]
    [InlineData("read_write", true, "US", "full")]
    [InlineData("read_write", false, "CA", "full")]
    [InlineData("read_write", false, "US", "express")]
    public async Task Ineligible_Stripe_authorization_or_account_does_not_bind(
        string scope, bool liveMode, string country, string dashboard)
    {
        var f = new Fixture();
        f.Stripe.Scope = scope;
        f.Stripe.LiveMode = liveMode;
        f.Replay.Setup(x => x.TryConsumeAsync("ac_TestCode", It.IsAny<string>(), default)).ReturnsAsync(true);
        f.Accounts.Setup(x => x.GetSnapshotAsync("acct_Existing", default))
            .ReturnsAsync(f.EligibleAccount() with { Country = country, DashboardType = dashboard });

        Assert.IsType<BadRequestObjectResult>(await f.Controller.Complete(new("ac_TestCode", f.GetState(), null), default));
        f.Payees.Verify(x => x.RegisterInitialAccountAsync(It.IsAny<long>(), It.IsAny<string>(), It.IsAny<bool>(), default), Times.Never);
    }

    private sealed class Fixture
    {
        public Mock<IStripeConnectedPayeeService> Payees { get; } = new();
        public Mock<IStripeConnectPreparationService> Preparation { get; } = new();
        public Mock<IStripeConnectOAuthReplayStore> Replay { get; } = new(MockBehavior.Strict);
        public Mock<IStripeConnectedAccountGateway> Accounts { get; } = new(MockBehavior.Strict);
        public FakeStripe Stripe { get; } = new();
        public StripeConnectOAuth OAuth { get; }
        public StripeExistingAccountController Controller { get; }

        public Fixture(bool configured = true)
        {
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Stripe:ConnectOAuthClientId"] = configured ? "ca_TestClient" : null,
                ["Stripe:SecretKey"] = "sk_test_example",
                ["FrontendBaseUrl"] = "https://app.example.com"
            }).Build();
            var factory = new Mock<IHttpClientFactory>();
            factory.Setup(x => x.CreateClient(StripeConnectOAuth.HttpClientName))
                .Returns(() => new HttpClient(Stripe, disposeHandler: false));
            OAuth = new StripeConnectOAuth(configuration, new EphemeralDataProtectionProvider(), factory.Object);
            Payees.Setup(x => x.ResolveOwnedAccountForOnboardingAsync(7, 12, default)).ReturnsAsync(new OwnedStripeAccount(7, null));
            var now = DateTimeOffset.UtcNow;
            Preparation.Setup(x => x.GetValidatedForHandoffAsync(7, 12, default)).ReturnsAsync(
                new StripeConnectPreparationDto(1, 7, 12, "individual", "Owner", [30], "owner", true, now, now, now));
            var httpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "7")], "test"))
            };
            httpContext.Items["OrganizationId"] = 12L;
            httpContext.Items["UserId"] = 7L;
            Controller = new StripeExistingAccountController(configuration, OAuth, Replay.Object, Payees.Object,
                Preparation.Object, Accounts.Object) { ControllerContext = new() { HttpContext = httpContext } };
        }

        public string GetState(long organizationId = 12) =>
            QueryHelpers.ParseQuery(new Uri(OAuth.CreateAuthorizationUrl(7, organizationId)!).Query)["state"].ToString();

        public StripeConnectedAccountSnapshot EligibleAccount() => new("acct_Existing", DateTimeOffset.UtcNow,
            true, true, true, "active", [], [], null, null, DashboardType: "full", LossesPayments: "stripe",
            FeesPayer: "account", Country: "US");
    }

    private sealed class FakeStripe : HttpMessageHandler
    {
        public int RequestCount { get; private set; }
        public string? RequestUrl { get; private set; }
        public Dictionary<string, Microsoft.Extensions.Primitives.StringValues>? Form { get; private set; }
        public string Scope { get; set; } = "read_write";
        public bool LiveMode { get; set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            RequestUrl = request.RequestUri?.AbsoluteUri;
            Form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken));
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    $$"""{"stripe_user_id":"acct_Existing","scope":"{{Scope}}","livemode":{{(LiveMode ? "true" : "false")}}}""",
                    Encoding.UTF8, "application/json")
            };
        }
    }
}
