using System.Reflection;
using System.Text.Json;
using System.Security.Claims;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Payments;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Payments;

public sealed class LeaseChargeLedgerTests : IDisposable
{
    private readonly DataContext db = DbContextFactory.Create();
    private readonly DateTime today = new(2026, 3, 15);
    private LeaseChargeLedger Ledger => new(db);

    [Fact]
    public async Task Rent_UsesSignedStripeLossAndRecoveryRows_EvenWhenOriginalStatusChanges()
    {
        await Seed();
        db.Payments.AddRange(
            Payment(1, 100m, "PartiallyRefunded", intent: "pi_a"),
            Payment(2, -35m, "Completed", intent: "pi_a", method: "Stripe loss adjustment"),
            Payment(3, 100m, "Disputed", intent: "pi_b"),
            Payment(4, -80m, "Completed", intent: "pi_b", method: "Stripe loss adjustment"),
            Payment(5, 30m, "Completed", intent: "pi_b", method: "Stripe dispute recovery adjustment"),
            Payment(6, 100m, "Refunded", intent: "pi_c"),
            Payment(7, -100m, "Completed", intent: "pi_c", method: "Stripe loss adjustment"),
            Payment(8, 25m, "Processing"));
        await db.SaveChangesAsync();
        var rent = (await Ledger.ForLandlord(10, 40, today))!.Where(x => x.Type == "Rent").ToList();
        rent.Select(x => x.Paid).Should().Equal(100m, 15m, 0m);
        rent.Sum(x => x.Remaining).Should().Be(185m);
        rent.SelectMany(x => x.Payments).Should().NotContain(x => x.Id == 6 || x.Id == 8);
    }

    [Fact]
    public async Task DepositRefund_DoesNotUndoCollection_AndMultipleBillsArePooled()
    {
        await Seed();
        db.LeaseDeposits.AddRange(
            new LeaseDeposit { Id = 80, LeaseId = 10, OrganizationId = 40, Name = "Keys", Amount = 20m, DueDate = today },
            new LeaseDeposit { Id = 81, LeaseId = 10, OrganizationId = 40, Name = "Extra", Amount = 10m, DueDate = today });
        db.Deposits.Add(new Deposit { Id = 9, LeaseId = 10, OrganizationId = 40, Amount = 100m,
            ReceivedDate = today, RefundedDate = today.AddDays(1), RefundAmount = 100m, Notes = "Returned" });
        db.Payments.Add(Payment(1, 100m, "Completed", depositId: 9));
        await db.SaveChangesAsync();
        var deposit = (await Ledger.ForLandlord(10, 40, today))!.Single(x => x.Type == "Deposit");
        deposit.ChargeId.Should().Be("deposit:pooled:10");
        deposit.Amount.Should().Be(210m);
        deposit.Paid.Should().Be(100m);
        deposit.Remaining.Should().Be(110m);
        deposit.Payments.Should().ContainSingle(x => x.Id == 1 && x.Amount == 100m);
    }

    [Fact]
    public async Task TenantSelectedOrganization_MustMatchLeaseEvenIfTenantHasBothLeases()
    {
        await Seed();
        (await Ledger.ForTenant(10, 20, today, selectedOrganizationId: 41)).Should().BeNull();
        (await Ledger.ForTenant(10, 20, today, selectedOrganizationId: 40)).Should().NotBeNull();
        (await Ledger.ForTenant(10, 20, today)).Should().NotBeNull();
    }

    [Fact]
    public async Task Rent_UnmatchedSignedLossReducesCreditsWithoutNegativePaid()
    {
        await Seed();
        db.Payments.AddRange(Payment(1, 100m, "Completed"),
            Payment(2, -40m, "Completed", intent: "orphan", method: "Stripe loss adjustment"));
        await db.SaveChangesAsync();
        var rent = (await Ledger.ForLandlord(10, 40, today))!.Where(x => x.Type == "Rent").ToList();
        rent.Sum(x => x.Paid).Should().Be(60m);
        rent.Sum(x => x.Remaining).Should().Be(240m);
    }

    [Fact]
    public async Task HistoricalRent_AllocatesFinalPaymentsOldestFirst_AndKeepsPartialDetails()
    {
        await Seed();
        db.Payments.AddRange(
            Payment(1, 150m, "Completed"), Payment(2, 25m, "Processing"),
            Payment(3, 40m, "Paid"), Payment(4, 10m, "Disputed"));
        await db.SaveChangesAsync();
        var rows = await Ledger.ForLandlord(10, 40, today);
        rows.Should().NotBeNull();
        var rent = rows!.Where(x => x.Type == "Rent").ToList();
        rent.Should().HaveCount(3);
        rent.Select(x => x.ChargeId).Should().Equal("rent:10:2026-01-01", "rent:10:2026-02-01", "rent:10:2026-03-01");
        rent.Select(x => x.Paid).Should().Equal(100m, 90m, 0m);
        rent.Select(x => x.Remaining).Should().Equal(0m, 10m, 100m);
        rent[0].Payments.Should().ContainSingle(x => x.Id == 1 && x.Amount == 100m);
        rent[1].Payments.Select(x => x.Amount).Should().Equal(50m, 40m);
        rent[1].Payments.Should().ContainSingle(x => x.Id == 3 && x.Status == "Paid");
    }

    [Fact]
    public async Task FeeLossAndRecovery_NetSignedCollectionWithoutCreditingRentOrOtherOrganization()
    {
        await Seed();
        db.LeaseFees.Add(new LeaseFee { Id = 70, LeaseId = 10, OrganizationId = 40,
            Name = "Pet fee", Amount = 100m, DueDate = today });
        db.Payments.AddRange(
            Payment(1, 100m, "PartiallyRefunded", feeId: 70, intent: "pi_fee"),
            Payment(2, -80m, "Completed", feeId: 70, intent: "pi_fee", method: "Stripe loss adjustment"),
            Payment(3, 50m, "Completed", feeId: 70, intent: "pi_fee", method: "Stripe dispute recovery adjustment"),
            Payment(4, 100m, "Completed", feeId: 70, organizationId: 41));
        await db.SaveChangesAsync();
        var rows = (await Ledger.ForLandlord(10, 40, today))!;
        var fee = rows.Single(x => x.ChargeId == "fee:70");
        fee.Paid.Should().Be(70m);
        fee.Remaining.Should().Be(30m);
        rows.Where(x => x.Type == "Rent").Should().OnlyContain(x => x.Paid == 0m);
    }

    [Fact]
    public async Task Fees_CreditOnlyLinkedFinalPayments_AndRetainSettledRows()
    {
        await Seed();
        db.LeaseFees.Add(new LeaseFee { Id = 70, LeaseId = 10, OrganizationId = 40, Name = "Pet fee", Amount = 80m, DueDate = today });
        db.Payments.AddRange(Payment(1, 80m, "Completed", feeId: 70), Payment(2, 15m, "Processing", feeId: 70));
        await db.SaveChangesAsync();
        var rows = await Ledger.ForLandlord(10, 40, today);
        var fee = rows!.Single(x => x.ChargeId == "fee:70");
        fee.Amount.Should().Be(80m);
        fee.Paid.Should().Be(80m);
        fee.Remaining.Should().Be(0m);
        fee.Payments.Should().ContainSingle().Which.Id.Should().Be(1);
        rows.Where(x => x.Type == "Rent").Should().OnlyContain(x => x.Paid == 0m);
    }

    [Fact]
    public async Task Deposits_ReconcileReceivedRecordsAndLinkedPaymentsWithoutDoubleCounting()
    {
        await Seed();
        var receipt = new Deposit { Id = 9, LeaseId = 10, OrganizationId = 40, Amount = 70m, ReceivedDate = today, Notes = "Received" };
        db.Deposits.Add(receipt);
        db.Payments.AddRange(Payment(1, 70m, "Completed", depositId: 9), Payment(2, 20m, "Processing", depositId: 9));
        await db.SaveChangesAsync();
        var rows = await Ledger.ForLandlord(10, 40, today);
        rows!.Where(x => x.Type == "Deposit").Sum(x => x.Amount).Should().Be(180m);
        rows.Where(x => x.Type == "Deposit").Sum(x => x.Paid).Should().Be(70m);
        rows.Where(x => x.Type == "Deposit").Sum(x => x.Remaining).Should().Be(110m);
    }

    [Fact]
    public async Task TenantAndOrganizationScope_FailClosed_AndNeverLeakForeignRows()
    {
        await Seed();
        db.LeaseFees.Add(new LeaseFee { Id = 71, LeaseId = 10, OrganizationId = 41, Name = "Foreign", Amount = 100m, DueDate = today });
        db.Payments.Add(Payment(1, 100m, "Completed", organizationId: 41));
        await db.SaveChangesAsync();
        (await Ledger.ForTenant(10, 21, today)).Should().BeNull();
        (await Ledger.ForLandlord(10, 41, today)).Should().BeNull();
        var rows = await Ledger.ForTenant(10, 20, today);
        rows.Should().NotBeNull();
        rows!.Should().NotContain(x => x.Title == "Foreign");
        rows.Where(x => x.Type == "Rent").Should().OnlyContain(x => x.Paid == 0m);
    }

    [Fact]
    public async Task MonthEndDueDate_ClampsFebruary_WithoutSkippingMarch()
    {
        await Seed();
        var lease = await db.Leases.FindAsync(10L);
        lease!.RentDueDay = 31;
        await db.SaveChangesAsync();
        var rent = (await Ledger.ForLandlord(10, 40, new DateTime(2026, 4, 1)))!
            .Where(x => x.Type == "Rent").ToList();
        rent.Select(x => x.DueDate).Should().Equal(new DateTime(2026, 1, 31),
            new DateTime(2026, 2, 28), new DateTime(2026, 3, 31));
    }

    [Fact]
    public async Task StandaloneDepositReceipt_CreditsDepositNotRent_AndWireIsCamelCase()
    {
        await Seed();
        db.LeaseDeposits.Add(new LeaseDeposit { Id = 80, LeaseId = 10, OrganizationId = 40,
            Name = "Key deposit", Amount = 20m, DueDate = today });
        db.Deposits.Add(new Deposit { Id = 9, LeaseId = 10, OrganizationId = 40,
            Amount = 80m, ReceivedDate = today, Notes = "Cash" });
        await db.SaveChangesAsync();
        var rows = (await Ledger.ForTenant(10, 20, today))!;
        rows.Where(x => x.Type == "Deposit").Sum(x => x.Amount).Should().Be(200m);
        rows.Where(x => x.Type == "Deposit").Sum(x => x.Paid).Should().Be(80m);
        rows.Where(x => x.Type == "Rent").Sum(x => x.Paid).Should().Be(0m);
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(rows, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        var first = json.RootElement[0];
        first.GetProperty("chargeId").GetString().Should().StartWith("rent:");
        first.GetProperty("payments").ValueKind.Should().Be(JsonValueKind.Array);
        first.GetProperty("remaining").GetDecimal().Should().Be(100m);
    }

    [Fact]
    public void Routes_EnforceSeparateRoles_AndTenantSelfOrganizationMiddleware()
    {
        var tenant = typeof(PaymentController).GetMethod("GetTenantLeaseCharges")!;
        var landlord = typeof(PaymentController).GetMethod("GetLeaseCharges")!;
        tenant.Should().NotBeNull();
        landlord.Should().NotBeNull();
        tenant.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Tenant");
        landlord.GetCustomAttribute<AuthorizeAttribute>()!.Roles.Should().Be("Landlord,Admin");
        tenant.GetCustomAttributes().Should().Contain(x => x.GetType().Name == "TenantSelfOrganizationAttribute");
        tenant.GetCustomAttribute<HttpGetAttribute>()!.Template.Should().Be("{leaseId}/tenant-charges");
        landlord.GetCustomAttribute<HttpGetAttribute>()!.Template.Should().Be("{leaseId}/charges");
    }

    private async Task Seed()
    {
        db.Organizations.Add(new Organization { Id = 40, Name = "Owner", IsActive = true });
        db.Properties.Add(new Property { Id = 30, Name = "Home", OrganizationId = 40 });
        db.Units.Add(new Unit { Id = 31, Name = "Main", PropertyId = 30 });
        db.Leases.Add(new Lease { Id = 10, UnitId = 31, OrganizationId = 40, StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 12, 31), RentDueDay = 1, RentAmount = 100m, DepositAmount = 150m, PetDepositAmount = 30m });
        db.Tenants.Add(new Tenant { Id = 22, UserId = 20, OrganizationId = 40, Firstname = "A", Lastname = "B", Email = "tenant@example.test" });
        db.TenantLeases.Add(new TenantLease { LeaseId = 10, TenantId = 22 });
        await db.SaveChangesAsync();
    }

    private Payment Payment(long id, decimal amount, string status, long? feeId = null, long? depositId = null, long organizationId = 40, string? intent = null, string? method = null) =>
        new() { Id = id, LeaseId = 10, PropertyId = 30, OrganizationId = organizationId, Amount = amount, Status = status, FeeId = feeId, DepositId = depositId, PaymentDate = today, StripePaymentIntentId = intent, Method = method };

    public void Dispose() => db.Dispose();
}
