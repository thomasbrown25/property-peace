using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.FutureExpense;
using brownstone_hub_api.Dtos.RecurringExpense;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.FutureExpenses;
using brownstone_hub_api.Repositories.RecurringExpenses;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories;

public sealed class ExpenseOrganizationIsolationTests
{
    [Fact]
    public async Task Expense_raw_id_operations_do_not_cross_organization_boundary()
    {
        await using var db = DbContextFactory.Create();
        db.Expenses.Add(ExpenseEntity(10, 1, 101, 1001));
        await db.SaveChangesAsync();
        var repository = new ExpenseRepository(db, NullLogger<ExpenseRepository>.Instance, MapperFactory.Create());

        Assert.Null(await repository.GetExpenseById(10, 2));
        Assert.False(await repository.DeleteExpense(10, 2));
        Assert.False(await repository.MarkBillAsPaid(10, 2, DateTime.UtcNow));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => repository.UpdateExpense(ExpenseUpdate(10, 202), 2));
        Assert.False((await db.Expenses.AsNoTracking().SingleAsync()).IsPaid);
    }

    [Fact]
    public async Task Expense_same_organization_operations_succeed()
    {
        await using var db = DbContextFactory.Create();
        SeedListProperties(db);
        db.Expenses.Add(ExpenseEntity(10, 1, 101, 1001));
        await db.SaveChangesAsync();
        var repository = new ExpenseRepository(db, NullLogger<ExpenseRepository>.Instance, MapperFactory.Create());

        Assert.NotNull(await repository.GetExpenseById(10, 1));
        Assert.True(await repository.MarkBillAsPaid(10, 1, DateTime.UtcNow));
        Assert.True(await repository.DeleteExpense(10, 1));
    }

    [Fact]
    public async Task Expense_create_rejects_cross_org_relationships_before_write()
    {
        await using var db = DbContextFactory.Create();
        SeedRelationships(db);
        await db.SaveChangesAsync();
        var repository = new ExpenseRepository(db, NullLogger<ExpenseRepository>.Instance, MapperFactory.Create());
        var dto = ExpenseAdd(101, 1001);
        dto.VendorId = 2002;

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.AddExpense(dto, 1));
        Assert.Empty(db.Expenses);
    }

    [Fact]
    public async Task Expense_update_rejects_cross_org_property_and_unit_before_write()
    {
        await using var db = DbContextFactory.Create();
        SeedRelationships(db);
        db.Expenses.Add(ExpenseEntity(10, 1, 101, 1001));
        await db.SaveChangesAsync();
        var repository = new ExpenseRepository(db, NullLogger<ExpenseRepository>.Instance, MapperFactory.Create());

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateExpense(ExpenseUpdate(10, 202), 1));
        Assert.Equal(101, (await db.Expenses.AsNoTracking().SingleAsync()).PropertyId);
    }

    [Fact]
    public async Task Expense_lists_are_organization_property_and_unit_scoped()
    {
        await using var db = DbContextFactory.Create();
        SeedListProperties(db);
        db.Expenses.AddRange(ExpenseEntity(10, 1, 101, 1001), ExpenseEntity(20, 1, 101, 1002), ExpenseEntity(30, 2, 202, 2002));
        await db.SaveChangesAsync();
        var repository = new ExpenseRepository(db, NullLogger<ExpenseRepository>.Instance, MapperFactory.Create());

        var rows = await repository.GetExpensesByOrganizationId(1, 101, unitId: 1001);

        Assert.Single(rows);
        Assert.Equal(10, rows[0].Id);
    }

    [Fact]
    public async Task FutureExpense_raw_id_operations_are_organization_scoped()
    {
        await using var db = DbContextFactory.Create();
        SeedListProperties(db);
        db.FutureExpenses.Add(new FutureExpense { Id = 10, OrganizationId = 1, LandlordId = 11, PropertyId = 101, Name = "Roof", Category = "Repair", Amount = 1, DueDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var repository = new FutureExpenseRepository(db, NullLogger<FutureExpenseRepository>.Instance, MapperFactory.Create());

        Assert.Null(await repository.GetFutureExpenseById(10, 2));
        Assert.False(await repository.DeleteFutureExpense(10, 2));
        Assert.NotNull(await repository.GetFutureExpenseById(10, 1));
    }

    [Fact]
    public async Task FutureExpense_create_requires_canonical_org_and_matching_relationships()
    {
        await using var db = DbContextFactory.Create();
        SeedRelationships(db);
        await db.SaveChangesAsync();
        var repository = new FutureExpenseRepository(db, NullLogger<FutureExpenseRepository>.Instance, MapperFactory.Create());
        var dto = new AddFutureExpenseDto { LandlordId = 11, PropertyId = 101, UnitId = 1001, VendorId = 2002, Name = "Roof", Category = "Repair", Amount = 1, DueDate = DateTime.UtcNow };

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.AddFutureExpense(dto, 1));
        Assert.Empty(db.FutureExpenses);
    }

    [Fact]
    public async Task FutureExpense_lists_are_organization_property_and_unit_scoped()
    {
        await using var db = DbContextFactory.Create();
        SeedListProperties(db);
        db.FutureExpenses.AddRange(
            FutureEntity(10, 1, 101, 1001),
            FutureEntity(20, 1, 101, 1002),
            FutureEntity(30, 2, 202, 2002));
        await db.SaveChangesAsync();
        var repository = new FutureExpenseRepository(db, NullLogger<FutureExpenseRepository>.Instance, MapperFactory.Create());

        var rows = await repository.GetFutureExpensesByOrganizationId(1, 101, 1001);

        Assert.Single(rows);
        Assert.Equal(10, rows[0].Id);
    }

    [Fact]
    public async Task RecurringExpense_raw_id_mutations_are_organization_scoped()
    {
        await using var db = DbContextFactory.Create();
        db.RecurringExpenses.Add(RecurringEntity(10, 1, 101, 1001));
        await db.SaveChangesAsync();
        var repository = new RecurringExpenseRepository(db, NullLogger<RecurringExpenseRepository>.Instance, MapperFactory.Create());

        Assert.Null(await repository.GetRecurringExpenseById(10, 2));
        Assert.False(await repository.DeleteRecurringExpense(10, 2));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => repository.UpdateRecurringExpense(RecurringUpdate(10, 101, true), 2));
        Assert.False((await db.RecurringExpenses.AsNoTracking().SingleAsync()).IsPaused);
    }

    [Fact]
    public async Task RecurringExpense_same_org_pause_style_update_succeeds()
    {
        await using var db = DbContextFactory.Create();
        SeedRelationships(db);
        db.RecurringExpenses.Add(RecurringEntity(10, 1, 101, 1001));
        await db.SaveChangesAsync();
        var repository = new RecurringExpenseRepository(db, NullLogger<RecurringExpenseRepository>.Instance, MapperFactory.Create());

        var updated = await repository.UpdateRecurringExpense(RecurringUpdate(10, 101, true), 1);

        Assert.True(updated.IsPaused);
    }

    [Fact]
    public async Task RecurringExpense_create_rejects_cross_org_maintenance_before_write()
    {
        await using var db = DbContextFactory.Create();
        SeedRelationships(db);
        await db.SaveChangesAsync();
        var repository = new RecurringExpenseRepository(db, NullLogger<RecurringExpenseRepository>.Instance, MapperFactory.Create());
        var dto = new AddRecurringExpenseDto { LandlordId = 11, PropertyId = 101, UnitId = 1001, MaintenanceRequestId = 5002, Name = "Service", Category = "Repair", Amount = 1, Frequency = ERecurringFrequency.Monthly, DayOfPeriod = 1, StartDate = DateTime.UtcNow };

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.AddRecurringExpense(dto, 1));
        Assert.Empty(db.RecurringExpenses);
    }

    [Fact]
    public async Task RecurringExpense_update_rejects_cross_org_relationships_before_write()
    {
        await using var db = DbContextFactory.Create();
        SeedRelationships(db);
        db.RecurringExpenses.Add(RecurringEntity(10, 1, 101, 1001));
        await db.SaveChangesAsync();
        var repository = new RecurringExpenseRepository(db, NullLogger<RecurringExpenseRepository>.Instance, MapperFactory.Create());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            repository.UpdateRecurringExpense(RecurringUpdate(10, 202, true), 1));

        var unchanged = await db.RecurringExpenses.AsNoTracking().SingleAsync();
        Assert.Equal(101, unchanged.PropertyId);
        Assert.False(unchanged.IsPaused);
    }

    [Fact]
    public async Task RecurringExpense_lists_are_organization_property_and_unit_scoped()
    {
        await using var db = DbContextFactory.Create();
        SeedListProperties(db);
        db.RecurringExpenses.AddRange(
            RecurringEntity(10, 1, 101, 1001),
            RecurringEntity(20, 1, 101, 1002),
            RecurringEntity(30, 2, 202, 2002));
        await db.SaveChangesAsync();
        var repository = new RecurringExpenseRepository(db, NullLogger<RecurringExpenseRepository>.Instance, MapperFactory.Create());

        var rows = await repository.GetRecurringExpensesByOrganizationId(1, 101, 1001);

        Assert.Single(rows);
        Assert.Equal(10, rows[0].Id);
    }

    private static void SeedRelationships(brownstone_hub_api.Data.DataContext db)
    {
        db.OrganizationMembers.AddRange(
            new OrganizationMember { Id = 1, OrganizationId = 1, UserId = 11, IsActive = true },
            new OrganizationMember { Id = 2, OrganizationId = 2, UserId = 22, IsActive = true });
        db.Properties.AddRange(
            new Property { Id = 101, OrganizationId = 1, LandlordId = 11 },
            new Property { Id = 202, OrganizationId = 2, LandlordId = 22 });
        db.Units.AddRange(
            new Unit { Id = 1001, OrganizationId = 1, PropertyId = 101 },
            new Unit { Id = 2002, OrganizationId = 2, PropertyId = 202 });
        db.Vendors.AddRange(
            new Vendor { Id = 1001, OrganizationId = 1, LandlordId = 11, Name = "A" },
            new Vendor { Id = 2002, OrganizationId = 2, LandlordId = 22, Name = "B" });
        db.MaintenanceRequests.AddRange(
            new MaintenanceRequest { Id = 5001, OrganizationId = 1, PropertyId = 101, UnitId = 1001 },
            new MaintenanceRequest { Id = 5002, OrganizationId = 2, PropertyId = 202, UnitId = 2002 });
    }

    private static void SeedListProperties(brownstone_hub_api.Data.DataContext db)
    {
        db.Properties.AddRange(
            new Property { Id = 101, OrganizationId = 1, LandlordId = 11 },
            new Property { Id = 202, OrganizationId = 2, LandlordId = 22 });
    }

    private static Expense ExpenseEntity(long id, long orgId, long propertyId, long unitId) => new()
    {
        Id = id, OrganizationId = orgId, LandlordId = orgId == 1 ? 11 : 22, PropertyId = propertyId, UnitId = unitId,
        Name = "Bill", Category = "Utilities", Amount = 10, ExpenseDate = DateTime.UtcNow
    };

    private static RecurringExpense RecurringEntity(long id, long orgId, long propertyId, long unitId) => new()
    {
        Id = id, OrganizationId = orgId, LandlordId = orgId == 1 ? 11 : 22, PropertyId = propertyId, UnitId = unitId,
        Name = "Bill", Category = "Utilities", Amount = 10, Frequency = ERecurringFrequency.Monthly, DayOfPeriod = 1, StartDate = DateTime.UtcNow
    };

    private static FutureExpense FutureEntity(long id, long orgId, long propertyId, long unitId) => new()
    {
        Id = id, OrganizationId = orgId, LandlordId = orgId == 1 ? 11 : 22, PropertyId = propertyId, UnitId = unitId,
        Name = "Future bill", Category = "Repair", Amount = 10, DueDate = DateTime.UtcNow
    };

    private static AddExpenseDto ExpenseAdd(long propertyId, long unitId) => new()
    {
        LandlordId = 11, PropertyId = propertyId, UnitId = unitId, Name = "Bill", Category = "Utilities", Amount = 10, ExpenseDate = DateTime.UtcNow
    };

    private static UpdateExpenseDto ExpenseUpdate(long id, long propertyId) => new()
    {
        Id = id, PropertyId = propertyId, UnitId = propertyId == 101 ? 1001 : 2002, Name = "Changed", Category = "Utilities", Amount = 11, ExpenseDate = DateTime.UtcNow
    };

    private static UpdateRecurringExpenseDto RecurringUpdate(long id, long propertyId, bool paused) => new()
    {
        Id = id, PropertyId = propertyId, UnitId = propertyId == 101 ? 1001 : 2002, Name = "Bill", Category = "Utilities", Amount = 10,
        Frequency = ERecurringFrequency.Monthly, DayOfPeriod = 1, StartDate = DateTime.UtcNow, IsPaused = paused
    };
}
