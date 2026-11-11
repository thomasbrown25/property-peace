using System.Security.Claims;
using brownstone_hub_api.Attributes;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Middleware;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace brownstone_hub_api.Controllers;

[ApiController]
[Route("api/stripe/payment-methods")]
[Authorize(Roles = "Tenant")]
public sealed class StripePaymentMethodsController : ControllerBase
{
    private readonly DataContext context;
    private readonly IStripeRentGateway gateway;
    private readonly IStripeConnectedPayeeService payees;
    private readonly IStripeClient client;

    [Microsoft.Extensions.DependencyInjection.ActivatorUtilitiesConstructor]
    public StripePaymentMethodsController(DataContext context, IStripeRentGateway gateway,
        IStripeConnectedPayeeService payees, IConfiguration configuration)
        : this(context, gateway, payees, new StripeClient(configuration["Stripe:SecretKey"])) { }

    public StripePaymentMethodsController(DataContext context, IStripeRentGateway gateway,
        IStripeConnectedPayeeService payees, IStripeClient client)
    {
        this.context = context;
        this.gateway = gateway;
        this.payees = payees;
        this.client = client;
    }

    [TenantSelfOrganization]
    [HttpGet]
    public Task<IActionResult> List([FromQuery] long leaseId, CancellationToken cancellationToken = default) =>
        Execute(leaseId, async (scope, ct) =>
        {
            var customer = await new CustomerService(client).GetAsync(scope.CustomerId, null, scope.Options, ct);
            var methods = new List<object>();
            foreach (var type in new[] { "card", "us_bank_account" })
            {
                await foreach (var method in new PaymentMethodService(client).ListAutoPagingAsync(
                    new PaymentMethodListOptions { Customer = scope.CustomerId, Type = type, Limit = 100 }, scope.Options, ct))
                {
                    if (!string.Equals(method.CustomerId, scope.CustomerId, StringComparison.Ordinal)) continue;
                    methods.Add(new
                    {
                        id = method.Id, type = method.Type, brand = method.Card?.Brand,
                        bankName = method.UsBankAccount?.BankName,
                        last4 = method.Card?.Last4 ?? method.UsBankAccount?.Last4,
                        isDefault = customer.InvoiceSettings?.DefaultPaymentMethodId == method.Id
                    });
                }
            }
            return Ok(new { success = true, data = new { stripeAccountId = scope.AccountId, paymentMethods = methods } });
        }, cancellationToken);

    [TenantSelfOrganization]
    [HttpDelete("{methodId}")]
    public Task<IActionResult> Delete(string methodId, [FromQuery] long leaseId, CancellationToken cancellationToken = default) =>
        Execute(leaseId, async (scope, ct) =>
        {
            if (!await OwnsMethod(scope, methodId, ct)) return NotFound(new { success = false, message = "Payment method not found." });
            await new PaymentMethodService(client).DetachAsync(methodId, null, scope.Options, ct);
            return Ok(new { success = true });
        }, cancellationToken);

    [TenantSelfOrganization]
    [HttpPost("{methodId}/default")]
    public Task<IActionResult> SetDefault(string methodId, [FromQuery] long leaseId, CancellationToken cancellationToken = default) =>
        Execute(leaseId, async (scope, ct) =>
        {
            if (!await OwnsMethod(scope, methodId, ct)) return NotFound(new { success = false, message = "Payment method not found." });
            await new CustomerService(client).UpdateAsync(scope.CustomerId, new CustomerUpdateOptions
            {
                InvoiceSettings = new CustomerInvoiceSettingsOptions { DefaultPaymentMethod = methodId }
            }, scope.Options, ct);
            return Ok(new { success = true });
        }, cancellationToken);

    private async Task<bool> OwnsMethod(MethodScope scope, string id, CancellationToken ct)
    {
        var method = await new PaymentMethodService(client).GetAsync(id, null, scope.Options, ct);
        return string.Equals(method.CustomerId, scope.CustomerId, StringComparison.Ordinal)
            && method.Type is "card" or "us_bank_account";
    }

    private async Task<IActionResult> Execute(long leaseId,
        Func<MethodScope, CancellationToken, Task<IActionResult>> action, CancellationToken ct)
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("userId"), out var userId))
            return Unauthorized(new { success = false });
        var organizationId = this.GetCurrentOrganizationIdOrForbid();
        if (leaseId <= 0 || !organizationId.HasValue) return StatusCode(403, new { success = false });
        // Saved methods belong to the current authorized lease payee. Historical charge reads
        // instead use immutable StripeRentPayment.ChargeStripeAccountId (never this resolver).
        var accountId = await context.Leases.AsNoTracking().Where(l => l.Id == leaseId
            && l.OrganizationId == organizationId && l.IsActive && !l.IsDeleted
            && l.Unit.RentalMode == ERentalMode.LongTerm
            && !l.Unit.Property.IsDeleted
            && l.TenantLeases.Any(t => t.Tenant.UserId == userId && !t.Tenant.IsDeleted
                && t.Tenant.OrganizationId == l.OrganizationId))
            .Select(l => l.OperatingAccount != null && l.OperatingAccount.IsActive ? l.OperatingAccount.StripeAccountId
                : l.Unit.Property.OperatingAccount != null && l.Unit.Property.OperatingAccount.IsActive ? l.Unit.Property.OperatingAccount.StripeAccountId
                : l.Unit.Property.Landlord.StripeAccountEnabled && !l.Unit.Property.Landlord.IsDeleted ? l.Unit.Property.Landlord.StripeAccountId : null)
            .SingleOrDefaultAsync(ct);
        if (string.IsNullOrWhiteSpace(accountId)) return StatusCode(403, new { success = false });
        var ownerId = await context.StripeConnectedPayeeReviews.AsNoTracking()
            .Where(x => x.StripeAccountId == accountId).Select(x => x.UserId).SingleOrDefaultAsync(ct);
        if (!ownerId.HasValue || !await payees.IsApprovedDestinationAsync(ownerId.Value, organizationId.Value, accountId, ct))
            return StatusCode(403, new { success = false });
        try
        {
            var customerId = await StripeRentCustomerAccounts.GetOrCreateAsync(context, gateway, userId, accountId, ct);
            return await action(new(accountId, customerId, new RequestOptions { StripeAccount = accountId }), ct);
        }
        catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return NotFound(new { success = false, message = "Payment method not found." });
        }
        catch (StripeException)
        {
            return StatusCode(502, new { success = false, message = "Stripe payment methods are temporarily unavailable." });
        }
    }

    private sealed record MethodScope(string AccountId, string CustomerId, RequestOptions Options);
}
