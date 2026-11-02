using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class LeaseChargesControllerTests
{
    private static LeaseChargesController.ManualChargeRequest Valid() => new("  Key deposit  ", 12.34m, "2026-11-01T00:00:00");

    private sealed class Fixture : IAsyncDisposable
    {
        public DataContext Db { get; } = new(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public async Task Seed()
        {
            Db.Organizations.AddRange(new Organization { Id = 10 }, new Organization { Id = 20 });
            Db.Users.Add(new User { Id = 7 });
            Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 10, UserId = 7,
                Role = "Manager", CanManageLeases = true, IsActive = true });
            Db.Leases.Add(new Lease { Id = 4, OrganizationId = 10,
                Unit = new Unit { Id = 3, OrganizationId = 10,
                    Property = new Property { Id = 2, OrganizationId = 10, LandlordId = 7 } } });
            await Db.SaveChangesAsync();
        }
        public LeaseChargesController Controller(long? org = 10, long? user = 7)
        {
            var context = new DefaultHttpContext();
            if (org.HasValue) context.Items["OrganizationId"] = org.Value;
            if (user.HasValue) context.Items["UserId"] = user.Value;
            return new LeaseChargesController(Db) { ControllerContext = new ControllerContext { HttpContext = context } };
        }
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    [Fact]
    public async Task Get_definitions_returns_builder_terms_and_named_charges_and_refreshes_after_post()
    {
        await using var f = new Fixture(); await f.Seed();
        var lease = await f.Db.Leases.SingleAsync();
        lease.RentAmount = 1250; lease.RentFrequency = "Monthly"; lease.RentDueDay = 5;
        lease.StartDate = new DateTime(2026, 11, 1);
        lease.DepositAmount = 800; lease.PetDepositAmount = 150;
        f.Db.LeaseFees.AddRange(
            new LeaseFee { LeaseId = 4, OrganizationId = 10, Name = "Move-in", Amount = 45, DueDate = lease.StartDate.Value },
            new LeaseFee { LeaseId = 4, OrganizationId = 10, Name = "Late rule", Amount = 20, DueDate = lease.StartDate.Value, IsLateFee = true },
            new LeaseFee { LeaseId = 4, OrganizationId = 20, Name = "Foreign", Amount = 99, DueDate = lease.StartDate.Value });
        f.Db.LeaseDeposits.AddRange(
            new LeaseDeposit { LeaseId = 4, OrganizationId = 10, Name = "Key deposit", Amount = 35, DueDate = lease.StartDate.Value },
            new LeaseDeposit { LeaseId = 4, OrganizationId = 20, Name = "Foreign deposit", Amount = 99, DueDate = lease.StartDate.Value });
        await f.Db.SaveChangesAsync();

        var body = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(
            await f.Controller().GetChargeDefinitions(4, default)).Value);
        var data = body.GetProperty("data");
        Assert.Equal(4, data.GetProperty("Id").GetInt64());
        Assert.Equal(1250m, data.GetProperty("RentAmount").GetDecimal());
        Assert.Equal("Monthly", data.GetProperty("RentFrequency").GetString());
        Assert.Equal(5, data.GetProperty("RentDueDay").GetInt32());
        Assert.Equal(800m, data.GetProperty("DepositAmount").GetDecimal());
        Assert.Equal(150m, data.GetProperty("PetDepositAmount").GetDecimal());
        Assert.StartsWith("2026-11-01", data.GetProperty("StartDate").GetString());
        Assert.Equal(2, data.GetProperty("Fees").GetArrayLength());
        Assert.Contains(data.GetProperty("Fees").EnumerateArray(), fee => fee.GetProperty("Name").GetString() == "Late rule" && fee.GetProperty("IsLateFee").GetBoolean());
        Assert.Equal("Key deposit", data.GetProperty("LeaseDeposits")[0].GetProperty("Name").GetString());
        Assert.Equal(1, data.GetProperty("LeaseDeposits").GetArrayLength());

        Assert.Equal(201, Assert.IsType<ObjectResult>(await f.Controller().AddDeposit(4, Valid(), default)).StatusCode);
        var refreshed = JsonSerializer.SerializeToElement(Assert.IsType<OkObjectResult>(
            await f.Controller().GetChargeDefinitions(4, default)).Value).GetProperty("data");
        Assert.Equal(2, refreshed.GetProperty("LeaseDeposits").GetArrayLength());
    }

    [Fact]
    public async Task Get_definitions_denies_missing_membership_and_out_of_scope_leases()
    {
        await using var f = new Fixture(); await f.Seed();
        Assert.IsType<ForbidResult>(await f.Controller(null).GetChargeDefinitions(4, default));
        Assert.IsType<ForbidResult>(await f.Controller(10, 99).GetChargeDefinitions(4, default));
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.CanManageLeases = false;
        await f.Db.SaveChangesAsync();
        Assert.IsType<ForbidResult>(await f.Controller().GetChargeDefinitions(4, default));
        member.CanManageLeases = true;
        await f.Db.SaveChangesAsync();
        f.Db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 7,
            Role = "Owner", IsActive = true });
        await f.Db.SaveChangesAsync();
        Assert.IsType<NotFoundObjectResult>(await f.Controller(20).GetChargeDefinitions(4, default));
        Assert.IsType<NotFoundObjectResult>(await f.Controller().GetChargeDefinitions(999, default));
        var lease = await f.Db.Leases.Include(l => l.Unit).ThenInclude(u => u.Property).SingleAsync();
        lease.Unit.Property.OrganizationId = 20;
        await f.Db.SaveChangesAsync();
        Assert.IsType<NotFoundObjectResult>(await f.Controller().GetChargeDefinitions(4, default));
    }

    [Fact]
    public async Task Fee_and_deposit_append_only_to_charge_tables_and_do_not_touch_receipts_or_lease()
    {
        await using var f = new Fixture(); await f.Seed();
        Assert.Equal(201, Assert.IsType<ObjectResult>(await f.Controller().AddFee(4, Valid(), default)).StatusCode);
        Assert.Equal(201, Assert.IsType<ObjectResult>(await f.Controller().AddDeposit(4, Valid(), default)).StatusCode);
        f.Db.ChangeTracker.Clear();
        var fee = Assert.Single(await f.Db.LeaseFees.ToListAsync());
        var deposit = Assert.Single(await f.Db.LeaseDeposits.ToListAsync());
        Assert.Equal("Key deposit", fee.Name);
        Assert.Equal(12.34m, fee.Amount);
        Assert.Equal(new DateTime(2026, 11, 1), fee.DueDate);
        Assert.False(fee.IsLateFee);
        Assert.Equal(10, fee.OrganizationId);
        Assert.Equal(10, deposit.OrganizationId);
        Assert.Equal("Key deposit", deposit.Name);
        Assert.Empty(await f.Db.Deposits.ToListAsync());
        Assert.Null((await f.Db.Leases.SingleAsync()).DepositAmount);
    }

    [Theory]
    [InlineData("", 10, "2026-11-01")]
    [InlineData("     ", 10, "2026-11-01")]
    [InlineData("Valid", 0, "2026-11-01")]
    [InlineData("Valid", -2, "2026-11-01")]
    [InlineData("Valid", 1.001, "2026-11-01")]
    [InlineData("Valid", 10, "2026-02-30")]
    [InlineData("Valid", 10, "2026-11-01T12:00:00")]
    [InlineData("Valid", 10, "1752-11-01")]
    [InlineData("Valid", 10, "2026-11-01T00:00:00Z")]
    public async Task Rejects_invalid_fields_without_creating_charge(string name, decimal amount, string due)
    {
        await using var f = new Fixture(); await f.Seed();
        Assert.IsType<BadRequestObjectResult>(await f.Controller().AddFee(4, new(name, amount, due), default));
        Assert.Empty(await f.Db.LeaseFees.ToListAsync());
    }

    [Fact]
    public async Task Rejects_null_and_oversized_input()
    {
        await using var f = new Fixture(); await f.Seed();
        Assert.IsType<BadRequestObjectResult>(await f.Controller().AddDeposit(4, new(null, null, null), default));
        Assert.IsType<BadRequestObjectResult>(await f.Controller().AddDeposit(4, new(new string('x', 201), 1, "2026-11-01"), default));
        Assert.IsType<BadRequestObjectResult>(await f.Controller().AddDeposit(4, new("A", 10000000000000000m, "2026-11-01"), default));
        Assert.Empty(await f.Db.LeaseDeposits.ToListAsync());
    }

    [Theory]
    [InlineData(null, 7L, "Manager", true, true)]
    [InlineData(20L, 7L, "Manager", true, true)]
    [InlineData(10L, null, "Manager", true, true)]
    [InlineData(10L, 99L, "Manager", true, true)]
    [InlineData(10L, 7L, "Manager", false, true)]
    [InlineData(10L, 7L, "Viewer", true, true)]
    [InlineData(10L, 7L, "Manager", true, false)]
    public async Task Rejects_unauthorized_user_or_organization(long? org, long? user, string role, bool active, bool manages)
    {
        await using var f = new Fixture(); await f.Seed();
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = role; member.IsActive = active; member.CanManageLeases = manages;
        await f.Db.SaveChangesAsync();
        Assert.IsType<ForbidResult>(await f.Controller(org, user).AddFee(4, Valid(), default));
        Assert.Empty(await f.Db.LeaseFees.ToListAsync());
    }

    [Fact]
    public async Task Owners_can_write_without_manager_flag_but_inactive_organization_cannot()
    {
        await using var f = new Fixture(); await f.Seed();
        var member = await f.Db.OrganizationMembers.SingleAsync();
        member.Role = "Owner"; member.CanManageLeases = false;
        await f.Db.SaveChangesAsync();
        Assert.Equal(201, Assert.IsType<ObjectResult>(await f.Controller().AddFee(4, Valid(), default)).StatusCode);
        (await f.Db.Organizations.SingleAsync(o => o.Id == 10)).IsActive = false;
        await f.Db.SaveChangesAsync();
        Assert.IsType<ForbidResult>(await f.Controller().AddDeposit(4, Valid(), default));
    }

    [Theory]
    [InlineData("deleted")]
    [InlineData("propertyDeleted")]
    [InlineData("otherProperty")]
    [InlineData("otherLease")]
    [InlineData("otherUnit")]
    [InlineData("shortStay")]
    [InlineData("missing")]
    public async Task Rejects_out_of_scope_deleted_or_short_stay_leases(string mode)
    {
        await using var f = new Fixture(); await f.Seed();
        var lease = await f.Db.Leases.Include(l => l.Unit).ThenInclude(u => u.Property).SingleAsync();
        switch (mode)
        {
            case "deleted": lease.IsDeleted = true; break;
            case "propertyDeleted": lease.Unit.Property.IsDeleted = true; break;
            case "otherProperty": lease.Unit.Property.OrganizationId = 20; break;
            case "otherLease": lease.OrganizationId = 20; break;
            case "otherUnit": lease.Unit.OrganizationId = 20; break;
            case "shortStay": lease.Unit.RentalMode = ERentalMode.ShortTerm; break;
        }
        await f.Db.SaveChangesAsync();
        Assert.IsType<NotFoundObjectResult>(await f.Controller().AddDeposit(mode == "missing" ? 999 : 4, Valid(), default));
        Assert.Empty(await f.Db.LeaseDeposits.ToListAsync());
    }
}
