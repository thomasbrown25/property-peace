using System.Net;
using System.Security.Claims;
using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Tests.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Stripe;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class StripePaymentMethodsControllerTests
{
    [Fact]
    public async Task List_UsesConnectedCustomerAndExactContractIncludingBankMethods()
    {
        await using var db = await Seed();
        var http = new Transport(request => request.Uri.AbsolutePath switch
        {
            "/v1/customers/cus_acct_snapshot_7" => Json("""{"id":"cus_acct_snapshot_7","object":"customer","invoice_settings":{"default_payment_method":"pm_bank"}}"""),
            "/v1/payment_methods" when request.Uri.Query.Contains("us_bank_account") => Json("""{"object":"list","has_more":false,"data":[{"id":"pm_bank","object":"payment_method","customer":"cus_acct_snapshot_7","type":"us_bank_account","us_bank_account":{"bank_name":"Test Bank","last4":"6789"}}]}"""),
            "/v1/payment_methods" => Json("""{"object":"list","has_more":false,"data":[{"id":"pm_card","object":"payment_method","customer":"cus_acct_snapshot_7","type":"card","card":{"brand":"visa","last4":"4242"}}]}"""),
            _ => throw new Exception(request.Uri.ToString())
        });
        var result = (await Controller(db, http).List(44)).Should().BeOfType<OkObjectResult>().Subject;
        var json = JsonSerializer.SerializeToElement(result.Value);
        json.GetProperty("success").GetBoolean().Should().BeTrue();
        var data = json.GetProperty("data");
        data.GetProperty("stripeAccountId").GetString().Should().Be("acct_snapshot");
        var methods = data.GetProperty("paymentMethods").EnumerateArray().ToArray();
        methods.Should().HaveCount(2);
        methods[0].GetProperty("brand").GetString().Should().Be("visa");
        methods[0].GetProperty("last4").GetString().Should().Be("4242");
        methods[0].GetProperty("isDefault").GetBoolean().Should().BeFalse();
        methods[1].GetProperty("type").GetString().Should().Be("us_bank_account");
        methods[1].GetProperty("bankName").GetString().Should().Be("Test Bank");
        methods[1].GetProperty("isDefault").GetBoolean().Should().BeTrue();
        http.Requests.Should().HaveCount(3);
        http.Requests.Should().OnlyContain(r => r.StripeHeaders["Stripe-Account"] == "acct_snapshot");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Mutations_RejectAnotherCustomersMethodBeforeWrite(bool setDefault)
    {
        await using var db = await Seed();
        var http = new Transport(_ => Json("""{"id":"pm_foreign","object":"payment_method","customer":"cus_someone_else","type":"card"}"""));
        var controller = Controller(db, http);
        var result = setDefault ? await controller.SetDefault("pm_foreign", 44) : await controller.Delete("pm_foreign", 44);
        result.Should().BeOfType<NotFoundObjectResult>();
        http.Requests.Should().ContainSingle().Which.StripeHeaders["Stripe-Account"].Should().Be("acct_snapshot");
        http.Requests[0].Method.Should().Be(HttpMethod.Get);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Mutations_OnlyWriteToOwnedConnectedMethod(bool setDefault)
    {
        await using var db = await Seed();
        var http = new Transport(request => Json(request.Uri.AbsolutePath.StartsWith("/v1/customers/")
            ? """{"id":"cus_acct_snapshot_7","object":"customer"}"""
            : """{"id":"pm_own","object":"payment_method","customer":"cus_acct_snapshot_7","type":"card"}"""));
        var controller = Controller(db, http);
        var result = setDefault ? await controller.SetDefault("pm_own", 44) : await controller.Delete("pm_own", 44);
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        JsonSerializer.Serialize(ok.Value).Should().Be("{\"success\":true}");
        http.Requests.Should().HaveCount(2);
        http.Requests.Should().OnlyContain(r => r.StripeHeaders["Stripe-Account"] == "acct_snapshot");
        http.Requests[1].Method.Should().Be(HttpMethod.Post);
        if (setDefault)
        {
            http.Requests[1].Uri.AbsolutePath.Should().Be("/v1/customers/cus_acct_snapshot_7");
            var body = await http.Requests[1].Content.ReadAsStringAsync();
            Uri.UnescapeDataString(body).Should().Contain("invoice_settings[default_payment_method]=pm_own");
        }
        else http.Requests[1].Uri.AbsolutePath.Should().Be("/v1/payment_methods/pm_own/detach");
    }

    [Theory]
    [InlineData(8, 9, 44)]
    [InlineData(7, 99, 44)]
    [InlineData(7, 9, 55)]
    public async Task AllActions_RejectForeignTenantOrganizationOrLeaseWithoutStripe(long user, long org, long lease)
    {
        await using var db = await Seed();
        var http = new Transport(_ => throw new Exception("Stripe must not be called"));
        var controller = Controller(db, http, user, org);
        (await controller.List(lease)).Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        (await controller.Delete("pm_foreign", lease)).Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        (await controller.SetDefault("pm_foreign", lease)).Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
        http.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task CurrentPayeeChange_DoesNotReuseOldConnectedCustomerOrPlatformSubscriptionCustomer()
    {
        await using var db = await Seed();
        db.Users.Add(new User { Id = 7, StripeCustomerId = "cus_platform_subscription" });
        db.Users.Local.Single(u => u.Id == 10044).StripeAccountId = "acct_changed";
        db.StripeConnectedPayeeReviews.Local.Single().StripeAccountId = "acct_changed";
        db.Set<StripeRentCustomer>().Add(new() { TenantUserId = 7, StripeAccountId = "acct_changed", CustomerId = "cus_changed" });
        await db.SaveChangesAsync();
        var http = new Transport(request => Json(request.Uri.AbsolutePath.StartsWith("/v1/customers/")
            ? """{"id":"cus_changed","object":"customer"}"""
            : """{"object":"list","has_more":false,"data":[]}"""));
        await Controller(db, http).List(44);
        http.Requests.Should().OnlyContain(r => r.StripeHeaders["Stripe-Account"] == "acct_changed");
        http.Requests[0].Uri.AbsolutePath.Should().Be("/v1/customers/cus_changed");
    }

    private static async Task<DataContext> Seed()
    {
        var db = StripeRentPaymentFlowTests.CreateContext();
        await StripeRentPaymentFlowTests.SeedLeaseAsync(db, 44, 9);
        await StripeRentPaymentFlowTests.SeedLeaseDestinationAsync(db, 44, 9, "acct_snapshot");
        db.StripeConnectedPayeeReviews.Add(new() { UserId = 10044, StripeAccountId = "acct_snapshot" });
        await db.SaveChangesAsync();
        return db;
    }

    private static StripePaymentMethodsController Controller(DataContext db, Transport http, long user = 7, long org = 9)
    {
        var payees = new Mock<IStripeConnectedPayeeService>();
        payees.Setup(p => p.IsApprovedDestinationAsync(10044, 9, It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var controller = new StripePaymentMethodsController(db, Mock.Of<IStripeRentGateway>(MockBehavior.Strict), payees.Object,
            new StripeClient("sk_test_saved_methods", httpClient: http));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, user.ToString())], "test"))
        } };
        controller.HttpContext.Items["OrganizationId"] = org;
        return controller;
    }

    private static StripeResponse Json(string content) => new(HttpStatusCode.OK, new HttpResponseMessage().Headers, content);
    private sealed class Transport(Func<StripeRequest, StripeResponse> respond) : Stripe.IHttpClient
    {
        public List<StripeRequest> Requests { get; } = [];
        public Task<StripeResponse> MakeRequestAsync(StripeRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request));
        }
        public Task<StripeStreamedResponse> MakeStreamingRequestAsync(StripeRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
