using System.Security.Claims;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Services.ShortStay;
using Microsoft.Extensions.Configuration;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Attributes;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class UnitRentalModeSwitchTests
{
    [Fact]
    public void Rental_mode_routes_require_organization_manager_or_owner()
    {
        foreach (var name in new[] { nameof(UnitController.RentalModePreflight), nameof(UnitController.ChangeRentalMode) })
        {
            var attribute = Assert.Single(typeof(UnitController).GetMethod(name)!
                .GetCustomAttributes(typeof(RequireOrganizationRoleAttribute), true).Cast<RequireOrganizationRoleAttribute>());
            Assert.Contains("Owner", attribute.AllowedRoles);
            Assert.Contains("Manager", attribute.AllowedRoles);
            Assert.DoesNotContain("Viewer", attribute.AllowedRoles);
        }
    }

    [Theory]
    [InlineData("Viewer", true, true)]
    [InlineData("Manager", false, true)]
    [InlineData("Manager", true, true)]
    [InlineData("Manager", true, false)]
    [InlineData("Owner", true, true)]
    [InlineData("Owner", true, false)]
    public async Task Only_active_owner_or_property_managing_manager_can_switch(string role, bool canManageProperties, bool isActive)
    {
        await using var fixture = await Fixture.Create();
        var member = await fixture.Db.OrganizationMembers.SingleAsync();
        member.Role = role;
        member.CanManageProperties = canManageProperties;
        member.IsActive = isActive;
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        var permitted = isActive && (role == "Owner" || role == "Manager" && canManageProperties);
        Assert.Equal(permitted ? 200 : 403, (await service.Preflight(10, ERentalMode.ShortTerm)).StatusCode);
        Assert.Equal(permitted ? 200 : 403, (await service.Change(10, new(ERentalMode.ShortTerm, true))).StatusCode);
    }

    [Theory]
    [InlineData("Owner")]
    [InlineData("Manager")]
    public async Task Deleted_property_cannot_preflight_or_change_its_unit(string role)
    {
        await using var fixture = await Fixture.Create();
        var member = await fixture.Db.OrganizationMembers.SingleAsync();
        member.Role = role;
        member.CanManageProperties = true;
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);

        var active = await service.Preflight(10, ERentalMode.ShortTerm);
        Assert.True(active.Success);
        Assert.True(active.Data!.CanChange);

        (await fixture.Db.Properties.SingleAsync(p => p.Id == 7)).IsDeleted = true;
        await fixture.Db.SaveChangesAsync();

        var preflight = await service.Preflight(10, ERentalMode.ShortTerm);
        Assert.Equal(404, preflight.StatusCode);
        Assert.False(preflight.Success);
        Assert.Null(preflight.Data);

        var change = await service.Change(10, new(ERentalMode.ShortTerm, true));
        Assert.Equal(404, change.StatusCode);
        Assert.False(change.Success);
        Assert.Null(change.Data);
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.AsNoTracking().SingleAsync(u => u.Id == 10)).RentalMode);
    }

    [Fact]
    public async Task Refunded_date_without_refund_amount_does_not_settle_deposit()
    {
        await using var fixture = await Fixture.Create();
        var lease = new Lease { UnitId = 10, EndDate = DateTime.Today.AddDays(-5) };
        fixture.Db.Leases.Add(lease);
        await fixture.Db.SaveChangesAsync();
        fixture.Db.Deposits.Add(new Deposit { LeaseId = lease.Id, Amount = 100, RefundedDate = DateTime.Today, RefundAmount = null, Notes = "pending" });
        await fixture.Db.SaveChangesAsync();
        var result = await fixture.Service(20).Change(10, new(ERentalMode.ShortTerm, true));
        Assert.Equal(409, result.StatusCode);
        Assert.Contains(result.Data!.Blockers, b => b.Code == "tenant_obligation");
    }
    [Fact]
    public async Task Scope_and_confirmation_are_required()
    {
        await using var fixture = await Fixture.Create();
        var missing = fixture.Service(organizationId: null);
        Assert.Equal(403, (await missing.Preflight(10, ERentalMode.ShortTerm)).StatusCode);
        Assert.Equal(403, (await missing.Change(10, new(ERentalMode.ShortTerm, true))).StatusCode);
        Assert.Equal(403, (await fixture.Service(21).Preflight(10, ERentalMode.ShortTerm)).StatusCode);
        Assert.Equal(400, (await fixture.Service(20).Change(10, new(ERentalMode.ShortTerm, false))).StatusCode);
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync()).RentalMode);
    }

    [Fact]
    public async Task Preflight_lists_unit_only_blockers_and_change_rechecks_them()
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        var ready = await service.Preflight(10, ERentalMode.ShortTerm);
        Assert.True(ready.Success);
        Assert.True(ready.Data!.CanChange);
        fixture.Db.Leases.Add(new Lease { UnitId = 10, IsActive = true, StartDate = DateTime.Today.AddDays(5), EndDate = DateTime.Today.AddMonths(3) });
        await fixture.Db.SaveChangesAsync();
        var blocked = await service.Change(10, new(ERentalMode.ShortTerm, true));
        Assert.Equal(409, blocked.StatusCode);
        Assert.Contains(blocked.Data!.Blockers, b => b.Code == "lease" && b.Resolution.Length > 0);
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync(u => u.Id == 10)).RentalMode);
    }

    [Fact]
    public async Task Historical_lease_is_retained_but_unresolved_money_blocks()
    {
        await using var fixture = await Fixture.Create();
        var lease = new Lease { UnitId = 10, IsActive = false, EndDate = DateTime.Today.AddDays(-30), OverdueAmount = 25 };
        fixture.Db.Leases.Add(lease);
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        var blocked = await service.Preflight(10, ERentalMode.ShortTerm);
        Assert.Contains(blocked.Data!.Blockers, b => b.Code == "tenant_obligation");
        lease.OverdueAmount = 0;
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.Equal(1, await fixture.Db.Leases.CountAsync());
        Assert.True((await service.Change(10, new(ERentalMode.LongTerm, true))).Success);
    }

    [Fact]
    public async Task Invalid_target_and_no_op_are_not_mutations()
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        Assert.Equal(400, (await service.Preflight(10, (ERentalMode)999)).StatusCode);
        Assert.Equal(400, (await service.Change(10, new(ERentalMode.LongTerm, true))).StatusCode);
    }

    [Fact]
    public async Task Sibling_lease_does_not_block_empty_unit_but_unreturned_deposit_does()
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20 });
        var siblingLease = new Lease { UnitId = 11, IsActive = true };
        var historical = new Lease { UnitId = 10, IsActive = false, EndDate = DateTime.Today.AddDays(-10) };
        fixture.Db.Leases.AddRange(siblingLease, historical);
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        fixture.Db.Deposits.Add(new Deposit { LeaseId = historical.Id, Amount = 100, Notes = "held" });
        await fixture.Db.SaveChangesAsync();
        Assert.Contains((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.Blockers,
            b => b.Code == "tenant_obligation");
    }

    [Fact]
    public async Task Pending_stripe_rent_obligation_blocks_even_when_lease_is_historical()
    {
        await using var fixture = await Fixture.Create();
        var lease = new Lease { UnitId = 10, IsActive = false, EndDate = DateTime.Today.AddDays(-10) };
        fixture.Db.Leases.Add(lease);
        await fixture.Db.SaveChangesAsync();
        fixture.Db.StripeRentPayments.Add(new StripeRentPayment
        {
            LeaseId = lease.Id, OrganizationId = 20, AmountCents = 100, Status = StripeRentPaymentStatus.Held
        });
        await fixture.Db.SaveChangesAsync();
        var result = await fixture.Service(20).Change(10, new(ERentalMode.ShortTerm, true));
        Assert.Equal(409, result.StatusCode);
        Assert.Contains(result.Data!.Blockers, b => b.Code == "tenant_obligation");
    }

    [Fact]
    public async Task Direct_tenant_assignment_blocks_and_is_rechecked_even_without_a_lease()
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        fixture.Db.Tenants.Add(new Tenant { Id = 90, UnitId = 10, Firstname = "Current", Lastname = "Tenant" });
        await fixture.Db.SaveChangesAsync();
        Assert.Contains((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.Blockers, b => b.Code == "tenant_assignment");
        Assert.Equal(409, (await service.Change(10, new(ERentalMode.ShortTerm, true))).StatusCode);
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync()).RentalMode);
        fixture.Db.Tenants.Single().IsDeleted = true;
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
    }

    [Fact]
    public async Task Unpaid_historical_rent_blocks_despite_zero_cached_overdue_and_non_rent_payment()
    {
        await using var fixture = await Fixture.Create();
        var lease = new Lease { UnitId = 10, IsActive = false, StartDate = new DateTime(2025, 1, 1),
            EndDate = new DateTime(2025, 1, 31), RentAmount = 100, RentFrequency = "Monthly", OverdueAmount = 0 };
        fixture.Db.Leases.Add(lease);
        await fixture.Db.SaveChangesAsync();
        fixture.Db.Payments.Add(new Payment { LeaseId = lease.Id, Amount = 100, Status = "Completed", FeeId = 5 });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.Contains((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.Blockers, b => b.Code == "tenant_obligation");
        fixture.Db.Payments.Add(new Payment { LeaseId = lease.Id, Amount = 100, Status = "Completed" });
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
    }

    [Theory]
    [InlineData("RefundPending")]
    [InlineData("Refunding")]
    [InlineData("Disputed")]
    public async Task Unresolved_legacy_payment_blocks_historical_lease(string status)
    {
        await using var fixture = await Fixture.Create();
        var lease = new Lease { UnitId = 10, IsActive = false, EndDate = DateTime.Today.AddDays(-10) };
        fixture.Db.Leases.Add(lease);
        await fixture.Db.SaveChangesAsync();
        fixture.Db.Payments.Add(new Payment { LeaseId = lease.Id, Amount = 100, Status = status });
        await fixture.Db.SaveChangesAsync();
        Assert.Contains((await fixture.Service(20).Preflight(10, ERentalMode.ShortTerm)).Data!.Blockers,
            b => b.Code == "tenant_obligation");
    }

    [Theory]
    [InlineData(StripeRentPaymentStatus.Transferred, 0, 0)]
    [InlineData(StripeRentPaymentStatus.Reversed, 50, 0)]
    [InlineData(StripeRentPaymentStatus.Failed, 0, 50)]
    public async Task Stripe_transfer_or_incomplete_refund_blocks_historical_lease(
        StripeRentPaymentStatus status, long reversed, long refunded)
    {
        await using var fixture = await Fixture.Create();
        var lease = new Lease { UnitId = 10, IsActive = false, EndDate = DateTime.Today.AddDays(-10) };
        fixture.Db.Leases.Add(lease);
        await fixture.Db.SaveChangesAsync();
        fixture.Db.StripeRentPayments.Add(new StripeRentPayment { LeaseId = lease.Id, OrganizationId = 20,
            AmountCents = 100, Status = status, ReversedAmountCents = reversed, RefundedAmountCents = refunded,
            StripeRefundId = refunded > 0 ? "refund" : null });
        await fixture.Db.SaveChangesAsync();
        Assert.Contains((await fixture.Service(20).Preflight(10, ERentalMode.ShortTerm)).Data!.Blockers,
            b => b.Code == "tenant_obligation");
    }

    [Fact]
    public async Task Closed_but_unrecovered_stripe_dispute_blocks_and_sibling_obligations_do_not()
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20 });
        var lease = new Lease { UnitId = 11, IsActive = false, EndDate = DateTime.Today.AddDays(-10) };
        fixture.Db.Leases.Add(lease);
        await fixture.Db.SaveChangesAsync();
        fixture.Db.StripeRentPayments.Add(new StripeRentPayment { LeaseId = lease.Id, OrganizationId = 20,
            AmountCents = 100, Status = StripeRentPaymentStatus.Reversed, DisputedAt = DateTimeOffset.UtcNow.AddDays(-5),
            DisputeClosedAt = DateTimeOffset.UtcNow, DisputedAmountCents = 100, DisputeRecoveredAmountCents = 0 });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        Assert.Contains((await service.Preflight(11, ERentalMode.ShortTerm)).Data!.Blockers,
            b => b.Code == "tenant_obligation");
    }

    [Fact]
    public async Task Active_listing_added_after_preflight_blocks_change_and_is_preserved()
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        fixture.Db.Listings.Add(new Listing { PropertyId = 7, UnitId = 10, OrganizationId = 20,
            Status = EListingStatus.Active, CreatedBy = 42 });
        await fixture.Db.SaveChangesAsync();
        Assert.Contains((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.Blockers,
            b => b.Code == "lease_listing" && b.Resolution.Contains("unpublish", StringComparison.OrdinalIgnoreCase));
        var change = await service.Change(10, new(ERentalMode.ShortTerm, true));
        Assert.Equal(409, change.StatusCode);
        Assert.Contains(change.Data!.Blockers, b => b.Code == "lease_listing");
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync()).RentalMode);
        Assert.Equal(EListingStatus.Active, (await fixture.Db.Listings.SingleAsync()).Status);
        (await fixture.Db.Listings.SingleAsync()).Status = EListingStatus.Unlisted;
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.Equal(1, await fixture.Db.Listings.CountAsync());
    }

    [Fact]
    public async Task Application_added_after_preflight_blocks_change_without_modifying_application()
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        fixture.Db.RentalApplications.Add(new RentalApplication { PropertyId = 7, UnitId = 10,
            OrganizationId = 20, LandlordId = 42, Status = EApplicationStatus.Submitted });
        await fixture.Db.SaveChangesAsync();
        var blocked = await service.Change(10, new(ERentalMode.ShortTerm, true));
        Assert.Equal(409, blocked.StatusCode);
        Assert.Contains(blocked.Data!.Blockers, b => b.Code == "lease_application");
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync()).RentalMode);
        Assert.Equal(EApplicationStatus.Submitted, (await fixture.Db.RentalApplications.SingleAsync()).Status);
    }

    [Theory]
    [InlineData(EListingStatus.Draft)]
    [InlineData(EListingStatus.Unlisted)]
    [InlineData(EListingStatus.Expired)]
    public async Task Nonpublished_listing_is_retained_on_safe_switch(EListingStatus status)
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Listings.Add(new Listing { PropertyId = 7, UnitId = 10, OrganizationId = 20,
            Status = status, CreatedBy = 42 });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.Equal(status, (await fixture.Db.Listings.SingleAsync()).Status);
    }

    [Theory]
    [InlineData(EApplicationStatus.Pending, true)]
    [InlineData(EApplicationStatus.Submitted, true)]
    [InlineData(EApplicationStatus.UnderReview, true)]
    [InlineData(EApplicationStatus.OnHold, true)]
    [InlineData(EApplicationStatus.Approved, true)]
    [InlineData(EApplicationStatus.Draft, false)]
    [InlineData(EApplicationStatus.Rejected, false)]
    [InlineData(EApplicationStatus.Withdrawn, false)]
    [InlineData(EApplicationStatus.LeaseSigned, false)]
    public async Task Only_actionable_applications_block_conversion(EApplicationStatus status, bool active)
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.RentalApplications.Add(new RentalApplication { PropertyId = 7, UnitId = 10,
            OrganizationId = 20, LandlordId = 42, Status = status });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        var preflight = await service.Preflight(10, ERentalMode.ShortTerm);
        Assert.Equal(!active, preflight.Data!.CanChange);
        Assert.Equal(active, preflight.Data.Blockers.Any(b => b.Code == "lease_application" &&
            b.Resolution.Contains("withdraw", StringComparison.OrdinalIgnoreCase)));
        var change = await service.Change(10, new(ERentalMode.ShortTerm, true));
        Assert.Equal(active ? 409 : 200, change.StatusCode);
        Assert.Equal(active ? ERentalMode.LongTerm : ERentalMode.ShortTerm,
            (await fixture.Db.Units.SingleAsync()).RentalMode);
        Assert.Equal(status, (await fixture.Db.RentalApplications.SingleAsync()).Status);
    }

    [Fact]
    public async Task Sibling_specific_records_do_not_block_multi_unit_conversion()
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20 });
        fixture.Db.Listings.Add(new Listing { PropertyId = 7, UnitId = 11, OrganizationId = 20,
            Status = EListingStatus.Active, CreatedBy = 42 });
        fixture.Db.RentalApplications.Add(new RentalApplication { PropertyId = 7, UnitId = 11,
            OrganizationId = 20, LandlordId = 42, Status = EApplicationStatus.Submitted });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync(u => u.Id == 11)).RentalMode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(20L)]
    public async Task Published_property_wide_listing_blocks_each_unit_and_is_rechecked_on_change(long? recordOrg)
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20 });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        var listing = new Listing { PropertyId = 7, OrganizationId = recordOrg,
            Status = EListingStatus.Active, CreatedBy = 42 };
        fixture.Db.Listings.Add(listing);
        await fixture.Db.SaveChangesAsync();
        foreach (var unitId in new long[] { 10, 11 })
        {
            var preflight = await service.Preflight(unitId, ERentalMode.ShortTerm);
            Assert.True(preflight.Success);
            Assert.False(preflight.Data!.CanChange);
            Assert.Contains(preflight.Data.Blockers, b => b.Code == "lease_listing" &&
                b.Resolution.Contains("unpublish", StringComparison.OrdinalIgnoreCase));
            var change = await service.Change(unitId, new(ERentalMode.ShortTerm, true));
            Assert.Equal(409, change.StatusCode);
            Assert.Contains(change.Data!.Blockers, b => b.Code == "lease_listing");
            Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync(u => u.Id == unitId)).RentalMode);
        }
        Assert.Equal(EListingStatus.Active, (await fixture.Db.Listings.SingleAsync()).Status);
        listing.Status = EListingStatus.Unlisted;
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.Equal(1, await fixture.Db.Listings.CountAsync());
    }

    [Theory]
    [InlineData(null)]
    [InlineData(20L)]
    public async Task Actionable_property_wide_application_blocks_each_unit_and_is_rechecked_on_change(long? recordOrg)
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20 });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        var application = new RentalApplication { PropertyId = 7, OrganizationId = recordOrg,
            LandlordId = 42, Status = EApplicationStatus.Submitted };
        fixture.Db.RentalApplications.Add(application);
        await fixture.Db.SaveChangesAsync();
        foreach (var unitId in new long[] { 10, 11 })
        {
            var preflight = await service.Preflight(unitId, ERentalMode.ShortTerm);
            Assert.True(preflight.Success);
            Assert.False(preflight.Data!.CanChange);
            Assert.Contains(preflight.Data.Blockers, b => b.Code == "lease_application" &&
                b.Resolution.Contains("withdraw", StringComparison.OrdinalIgnoreCase));
            var change = await service.Change(unitId, new(ERentalMode.ShortTerm, true));
            Assert.Equal(409, change.StatusCode);
            Assert.Contains(change.Data!.Blockers, b => b.Code == "lease_application");
            Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync(u => u.Id == unitId)).RentalMode);
        }
        Assert.Equal(EApplicationStatus.Submitted, (await fixture.Db.RentalApplications.SingleAsync()).Status);
        application.Status = EApplicationStatus.Withdrawn;
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.Equal(1, await fixture.Db.RentalApplications.CountAsync());
    }

    [Fact]
    public async Task Other_organization_property_wide_records_do_not_block_managed_unit()
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20 });
        fixture.Db.Organizations.Add(new Organization { Id = 21, IsActive = true });
        fixture.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 21, UserId = 42,
            Role = "Owner", IsActive = true });
        fixture.Db.Listings.Add(new Listing { PropertyId = 7, OrganizationId = 21,
            Status = EListingStatus.Active, CreatedBy = 42 });
        fixture.Db.RentalApplications.Add(new RentalApplication { PropertyId = 7, OrganizationId = 21,
            LandlordId = 42, Status = EApplicationStatus.Submitted });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Preflight(10, ERentalMode.ShortTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.Equal(404, (await fixture.Service(21).Preflight(11, ERentalMode.ShortTerm)).StatusCode);
    }

    [Fact]
    public async Task Property_wide_records_block_single_home_conversion()
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Listings.Add(new Listing { PropertyId = 7, OrganizationId = 20, Status = EListingStatus.Active, CreatedBy = 42 });
        fixture.Db.RentalApplications.Add(new RentalApplication { PropertyId = 7, OrganizationId = 20,
            LandlordId = 42, Status = EApplicationStatus.Submitted });
        await fixture.Db.SaveChangesAsync();
        var result = await fixture.Service(20).Preflight(10, ERentalMode.ShortTerm);
        Assert.Contains(result.Data!.Blockers, b => b.Code == "lease_listing");
        Assert.Contains(result.Data.Blockers, b => b.Code == "lease_application");
        Assert.Equal(409, (await fixture.Service(20).Change(10, new(ERentalMode.ShortTerm, true))).StatusCode);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task Airbnb_feed_or_imported_dates_block_return_to_long_term(bool enabled, bool hasOccurrences)
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        Assert.True((await service.Preflight(10, ERentalMode.LongTerm)).Data!.CanChange);

        var subscription = new ShortStayIcalSubscription { UnitId = 10, OrgId = 20,
            EncryptedUrl = "encrypted", UrlFingerprint = "fingerprint", Enabled = enabled };
        if (hasOccurrences)
            subscription.Occurrences.Add(new ShortStayIcalOccurrence { UidKey = "uid", RecurrenceKey = "recurrence",
                StartDate = new DateOnly(2026, 11, 1), EndDate = new DateOnly(2026, 11, 3) });
        fixture.Db.ShortStayIcalSubscriptions.Add(subscription);
        await fixture.Db.SaveChangesAsync();

        var preflight = await service.Preflight(10, ERentalMode.LongTerm);
        Assert.True(preflight.Success);
        Assert.False(preflight.Data!.CanChange);
        Assert.Contains(preflight.Data.Blockers, b => b.Code == "airbnb_calendar" &&
            b.Resolution.Contains("disconnect", StringComparison.OrdinalIgnoreCase) &&
            b.Resolution.Contains("imported", StringComparison.OrdinalIgnoreCase));
        var change = await service.Change(10, new(ERentalMode.LongTerm, true));
        Assert.Equal(409, change.StatusCode);
        Assert.Contains(change.Data!.Blockers, b => b.Code == "airbnb_calendar");
        Assert.Equal(ERentalMode.ShortTerm, (await fixture.Db.Units.SingleAsync(u => u.Id == 10)).RentalMode);
        Assert.Equal(hasOccurrences ? 1 : 0, await fixture.Db.ShortStayIcalOccurrences.CountAsync());

        subscription.Enabled = false;
        if (hasOccurrences)
            fixture.Db.ShortStayIcalOccurrences.RemoveRange(subscription.Occurrences);
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Preflight(10, ERentalMode.LongTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.LongTerm, true))).Success);
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync(u => u.Id == 10)).RentalMode);
    }

    [Fact]
    public async Task Disabled_feed_without_imported_dates_allows_return_and_sibling_feed_does_not_block()
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20 });
        await fixture.Db.SaveChangesAsync();
        var service = fixture.Service(20);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        fixture.Db.ShortStayIcalSubscriptions.AddRange(
            new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, EncryptedUrl = "encrypted", UrlFingerprint = "fp", Enabled = false },
            new ShortStayIcalSubscription { UnitId = 11, OrgId = 20, EncryptedUrl = "encrypted", UrlFingerprint = "sibling", Enabled = true });
        await fixture.Db.SaveChangesAsync();
        Assert.True((await service.Preflight(10, ERentalMode.LongTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.LongTerm, true))).Success);
        Assert.Equal(2, await fixture.Db.ShortStayIcalSubscriptions.CountAsync());
    }

    [Fact]
    public async Task Disconnect_clears_imported_days_preserves_owner_blocks_and_allows_mode_change()
    {
        await using var fixture = await Fixture.Create();
        fixture.Db.Properties.Single().TimeZoneId = "America/New_York";
        fixture.Db.Units.Add(new Unit { Id = 11, Name = "Sibling", PropertyId = 7, OrganizationId = 20, RentalMode = ERentalMode.ShortTerm });
        await fixture.Db.SaveChangesAsync();
        var mode = fixture.Service(20);
        Assert.True((await mode.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        var first = new ShortStayIcalSubscription { UnitId = 10, OrgId = 20, EncryptedUrl = "cipher", UrlFingerprint = "fp",
            Enabled = true, Generation = 5, NextAttemptAtUtc = DateTime.UtcNow };
        var sibling = new ShortStayIcalSubscription { UnitId = 11, OrgId = 20, EncryptedUrl = "cipher", UrlFingerprint = "fp2",
            Enabled = true, Generation = 7, NextAttemptAtUtc = DateTime.UtcNow };
        foreach (var sub in new[] { first, sibling })
            sub.Occurrences.Add(new ShortStayIcalOccurrence { UidKey = "uid", RecurrenceKey = "key",
                StartDate = new DateOnly(2026, 11, 1), EndDate = new DateOnly(2026, 11, 3) });
        fixture.Db.ShortStayIcalSubscriptions.AddRange(first, sibling);
        fixture.Db.ShortStayBlocks.Add(new ShortStayBlock { UnitId = 10, StartDate = new DateOnly(2026, 11, 2), EndDate = new DateOnly(2026, 11, 3) });
        await fixture.Db.SaveChangesAsync();

        Assert.False((await mode.Preflight(10, ERentalMode.LongTerm)).Data!.CanChange);
        Assert.Equal(409, (await mode.Change(10, new(ERentalMode.LongTerm, true))).StatusCode);
        Assert.Equal(2, await fixture.Db.ShortStayIcalOccurrences.CountAsync());

        var disconnect = await fixture.AirbnbService().Disable(10);
        Assert.Equal(200, disconnect.StatusCode);
        Assert.False(disconnect.Data!.Enabled);
        Assert.Equal(6, disconnect.Data.Generation);
        Assert.Null(first.NextAttemptAtUtc);
        Assert.Empty(await fixture.Db.ShortStayIcalOccurrences.AsNoTracking().Where(o => o.SubscriptionId == first.Id).ToListAsync());
        Assert.Single(await fixture.Db.ShortStayIcalOccurrences.AsNoTracking().Where(o => o.SubscriptionId == sibling.Id).ToListAsync());
        Assert.True(sibling.Enabled);
        Assert.Equal(7, sibling.Generation);
        Assert.NotNull(sibling.NextAttemptAtUtc);
        Assert.Single(await fixture.Db.ShortStayBlocks.AsNoTracking().Where(b => b.UnitId == 10).ToListAsync());
        Assert.True((await mode.Preflight(10, ERentalMode.LongTerm)).Data!.CanChange);
        Assert.True((await mode.Change(10, new(ERentalMode.LongTerm, true))).Success);
        Assert.Equal(ERentalMode.LongTerm, (await fixture.Db.Units.SingleAsync(u => u.Id == 10)).RentalMode);
    }

    [Fact]
    public async Task Guidebook_draft_blocks_mode_change_in_preflight_and_mutation()
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        var ready = await service.Preflight(10, ERentalMode.LongTerm);
        Assert.True(ready.Data!.CanChange);
        fixture.Db.ShortStayGuidebookDrafts.Add(new ShortStayGuidebookDraft { UnitId = 10, HouseRules = "Quiet hours" });
        await fixture.Db.SaveChangesAsync();
        var blocked = await service.Preflight(10, ERentalMode.LongTerm);
        Assert.Contains(blocked.Data!.Blockers, b => b.Code == "guidebook_draft");
        var mutation = await service.Change(10, new(ERentalMode.LongTerm, true));
        Assert.Equal(409, mutation.StatusCode);
        Assert.Contains(mutation.Data!.Blockers, b => b.Code == "guidebook_draft");
        fixture.Db.ChangeTracker.Clear();
        Assert.Equal(ERentalMode.ShortTerm, (await fixture.Db.Units.SingleAsync()).RentalMode);
        var draftService = fixture.GuidebookService();
        Assert.Equal(200, (await draftService.Delete(10)).StatusCode);
        Assert.True((await service.Preflight(10, ERentalMode.LongTerm)).Data!.CanChange);
        Assert.True((await service.Change(10, new(ERentalMode.LongTerm, true))).Success);
        Assert.Empty(await fixture.Db.ShortStayGuidebookDrafts.ToListAsync());
    }

    [Fact]
    public async Task Claimed_nights_block_conversion_even_without_calendar_feed()
    {
        await using var fixture = await Fixture.Create();
        var service = fixture.Service(20);
        Assert.True((await service.Change(10, new(ERentalMode.ShortTerm, true))).Success);
        var now = DateTimeOffset.UtcNow;
        fixture.Db.ShortStayReservations.Add(ShortStayReservation.CreateHold(10, 7, 20, 77, 42,
            "acct_private", new DateOnly(2027, 1, 1), new DateOnly(2027, 1, 2), 1,
            [12000], now.AddHours(1), now));
        await fixture.Db.SaveChangesAsync();
        Assert.Contains((await service.Preflight(10, ERentalMode.LongTerm)).Data!.Blockers,
            b => b.Code == "short_stay_claim");
        var result = await service.Change(10, new(ERentalMode.LongTerm, true));
        Assert.Equal(409, result.StatusCode);
        Assert.Equal(ERentalMode.ShortTerm, (await fixture.Db.Units.SingleAsync()).RentalMode);
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        public DataContext Db { get; }
        private Fixture(SqliteConnection connection, DataContext db) { _connection = connection; Db = db; }
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
            await connection.OpenAsync();
            var db = new SqliteTestContext(new DbContextOptionsBuilder<DataContext>().UseSqlite(connection).Options);
            await db.Database.EnsureCreatedAsync();
            db.Organizations.Add(new Organization { Id = 20, IsActive = true });
            db.Properties.Add(new Property { Id = 7, OrganizationId = 20 });
            db.Units.Add(new Unit { Id = 10, PropertyId = 7, OrganizationId = 20 });
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
            await db.SaveChangesAsync();
            return new Fixture(connection, db);
        }
        public RentalModeService Service(long? organizationId)
        {
            var context = new DefaultHttpContext();
            context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "42")], "test"));
            if (organizationId.HasValue) context.Items["OrganizationId"] = organizationId.Value;
            context.Items["UserId"] = 42L;
            return new RentalModeService(Db, new HttpContextAccessor { HttpContext = context }, NullLogger<RentalModeService>.Instance);
        }
        public ShortStayGuidebookDraftService GuidebookService()
        {
            var context = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "42")], "test")) };
            context.Items["OrganizationId"] = 20L;
            context.Items["UserId"] = 42L;
            return new ShortStayGuidebookDraftService(Db, new HttpContextAccessor { HttpContext = context },
                NullLogger<ShortStayGuidebookDraftService>.Instance);
        }
        public AirbnbCalendarService AirbnbService()
        {
            var context = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "42"), new Claim(ClaimTypes.Role, "Landlord")], "test")) };
            context.Items["OrganizationId"] = 20L;
            context.Items["UserId"] = 42L;
            var key = Convert.ToBase64String(Enumerable.Range(1, 32).Select(x => (byte)x).ToArray());
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
                { ["ShortStayIcal:EncryptionKey"] = key }).Build();
            return new AirbnbCalendarService(Db, new HttpContextAccessor { HttpContext = context }, config);
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await _connection.DisposeAsync(); }
    }

    private sealed class SqliteTestContext(DbContextOptions<DataContext> options) : DataContext(options)
    {
        protected override void OnModelCreating(Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var keep = new[] { typeof(Property), typeof(Unit), typeof(Lease), typeof(Deposit), typeof(Payment), typeof(StripeRentPayment), typeof(Tenant), typeof(Organization), typeof(OrganizationMember), typeof(Listing), typeof(RentalApplication), typeof(ShortStayIcalSubscription), typeof(ShortStayIcalOccurrence), typeof(ShortStayBlock), typeof(ShortStayGuidebookDraft), typeof(ShortStayReservation), typeof(ShortStayReservationNight), typeof(ShortStayOccupancyClaim) };
            foreach (var entity in modelBuilder.Model.GetEntityTypes().ToList())
                if (!keep.Contains(entity.ClrType)) modelBuilder.Ignore(entity.ClrType);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var property in entity.GetProperties())
                    if (property.GetColumnType()?.Contains("(max)", StringComparison.OrdinalIgnoreCase) == true)
                        property.SetColumnType("TEXT");
        }
    }
}
