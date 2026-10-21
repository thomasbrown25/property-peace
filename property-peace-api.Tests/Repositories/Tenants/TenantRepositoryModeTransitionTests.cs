using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Tests.Helpers;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.TenantService;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Services.NotificationService;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Tenants;

public sealed class TenantRepositoryModeTransitionTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AddTenant_RejectsPersistedShortTermWithOrWithoutStaleTrackedUnit(bool stale)
    {
        await using var db = DbContextFactory.Create();
        db.Properties.Add(new Property { Id = 1, OrganizationId = 7, LandlordId = 2 });
        db.Units.Add(new Unit { Id = 2, PropertyId = 1, OrganizationId = 7, RentalMode = ERentalMode.ShortTerm });
        await db.SaveChangesAsync();
        if (stale) db.Units.Local.Single().RentalMode = ERentalMode.LongTerm;
        var repo = new TenantRepository(db, MapperFactory.Create());
        await Assert.ThrowsAsync<InvalidOperationException>(() => repo.AddTenant(new AddTenantDto
        {
            UnitId = 2, OrganizationId = 7, Firstname = "New", Lastname = "Tenant"
        }));
        db.ChangeTracker.Clear();
        Assert.False(await db.Tenants.AnyAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task UpdateTenant_RejectsPersistedShortTermWithoutWritingLeaseOrUnit(bool stale)
    {
        await using var db = DbContextFactory.Create();
        db.Properties.Add(new Property { Id = 1, OrganizationId = 7, LandlordId = 2 });
        db.Units.Add(new Unit { Id = 2, PropertyId = 1, OrganizationId = 7, RentalMode = ERentalMode.ShortTerm });
        db.Tenants.Add(new Tenant { Id = 3, OrganizationId = 7, Firstname = "Original", Lastname = "Tenant" });
        await db.SaveChangesAsync();
        if (stale) db.Units.Local.Single().RentalMode = ERentalMode.LongTerm;
        var repo = new TenantRepository(db, MapperFactory.Create());
        await Assert.ThrowsAsync<InvalidOperationException>(() => repo.UpdateTenant(3, new AddTenantDto
        {
            Id = 3, UnitId = 2, LeaseId = 4, OrganizationId = 7, Firstname = "Changed", Lastname = "Tenant"
        }));
        db.ChangeTracker.Clear();
        Assert.Null((await db.Tenants.SingleAsync(t => t.Id == 3)).UnitId);
        Assert.Empty(await db.TenantLeases.ToListAsync());
    }

    [Fact]
    public async Task OrgOnlyTenantAndLongTermAssignmentsStillWork()
    {
        await using var db = DbContextFactory.Create();
        db.Properties.Add(new Property { Id = 1, OrganizationId = 7, LandlordId = 2 });
        db.Units.Add(new Unit { Id = 2, PropertyId = 1, OrganizationId = 7, RentalMode = ERentalMode.LongTerm });
        await db.SaveChangesAsync();
        var repo = new TenantRepository(db, MapperFactory.Create());
        var tenant = await repo.AddTenant(new AddTenantDto { OrganizationId = 7, Firstname = "New", Lastname = "Tenant" });
        Assert.Null((await db.Tenants.SingleAsync(t => t.Id == tenant.Id)).UnitId);
        await repo.UpdateTenant(tenant.Id, new AddTenantDto { Id = tenant.Id, OrganizationId = 7, UnitId = 2, Firstname = "New", Lastname = "Tenant" });
        db.ChangeTracker.Clear();
        Assert.Equal(2, (await db.Tenants.SingleAsync(t => t.Id == tenant.Id)).UnitId);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Service_ReturnsConflictWhenRepositoryDetectsModeSwitch(bool update)
    {
        await using var db = DbContextFactory.Create();
        db.Organizations.Add(new Organization { Id = 7, IsActive = true });
        db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 7, UserId = 42, Role = "Owner", IsActive = true });
        await db.SaveChangesAsync();
        var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        http.HttpContext.Items["OrganizationId"] = 7L;
        http.HttpContext.Items["UserId"] = 42L;
        var units = new Mock<IUnitRepository>();
        units.Setup(x => x.GetUnitById(2, 7)).ReturnsAsync(new LoadUnitDto { Id = 2, RentalMode = ERentalMode.LongTerm });
        var tenants = new Mock<ITenantRepository>();
        if (update)
        {
            tenants.Setup(x => x.GetTenantById(3, 7)).ReturnsAsync(new LoadTenantDto { Id = 3 });
            tenants.Setup(x => x.UpdateTenant(3, It.IsAny<AddTenantDto>()))
                .ThrowsAsync(new InvalidOperationException("Long-term tenant assignment unavailable: unit switched modes"));
        }
        else tenants.Setup(x => x.AddTenant(It.IsAny<AddTenantDto>()))
            .ThrowsAsync(new InvalidOperationException("Long-term tenant assignment unavailable: unit switched modes"));
        var service = new TenantService(tenants.Object, units.Object, Mock.Of<IUnitService>(),
            Mock.Of<IPropertyRepository>(), Mock.Of<INotificationService>(), Mock.Of<IUserRepository>(),
            http, NullLogger<TenantService>.Instance, db);
        var result = await service.AddOrUpdateTenant(new AddTenantDto { Id = update ? 3 : null, UnitId = 2 });
        Assert.False(result.Success);
        Assert.Equal(409, result.StatusCode);
    }

    [Fact]
    public void InviteAcceptance_MapsRepositoryModeConflictTo409()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !System.IO.File.Exists(Path.Combine(root.FullName, "property-peace-api", "Services", "TenantInviteService", "TenantInviteService.cs"))) root = root.Parent;
        Assert.NotNull(root);
        var source = System.IO.File.ReadAllText(Path.Combine(root!.FullName, "property-peace-api", "Services", "TenantInviteService", "TenantInviteService.cs"));
        var body = source[source.IndexOf("private async Task<ServiceResponse<bool>> AcceptInviteCoreAsync", StringComparison.Ordinal)..];
        Assert.Contains("catch (InvalidOperationException ex) when (ex.Message.StartsWith(\"Long-term tenant assignment unavailable\"", body);
        Assert.Contains("statusCode: 409", body);
    }

    [Theory]
    [InlineData("AddTenant")]
    [InlineData("UpdateTenant")]
    public void Assignment_SerializesWithModeSwitchAndChecksPersistedModeBeforeWrite(string method)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !System.IO.File.Exists(Path.Combine(root.FullName, "property-peace-api", "Repositories", "Tenants", "TenantRepository.cs"))) root = root.Parent;
        Assert.NotNull(root);
        var source = System.IO.File.ReadAllText(Path.Combine(root!.FullName, "property-peace-api", "Repositories", "Tenants", "TenantRepository.cs"));
        var start = source.IndexOf($"public async Task<LoadTenantDto> {method}(", StringComparison.Ordinal);
        var end = source.IndexOf("public async Task<", start + 1, StringComparison.Ordinal);
        var body = source[start..end];
        Assert.True(body.IndexOf("BeginTransactionAsync(IsolationLevel.Serializable)", StringComparison.Ordinal) >= 0);
        Assert.True(body.IndexOf("ValidateAssignmentMode", StringComparison.Ordinal) > body.IndexOf("BeginTransactionAsync(IsolationLevel.Serializable)", StringComparison.Ordinal));
        Assert.True(body.IndexOf("SaveChangesAsync", StringComparison.Ordinal) > body.IndexOf("ValidateAssignmentMode", StringComparison.Ordinal));
        Assert.Contains("CommitAsync", body);
        var guard = source[source.IndexOf("private async Task ValidateAssignmentMode", StringComparison.Ordinal)..start];
        Assert.True(guard.IndexOf("WITH (UPDLOCK, HOLDLOCK)", StringComparison.Ordinal) < guard.IndexOf("AsNoTracking()", StringComparison.Ordinal));
        Assert.Contains("mode != ERentalMode.LongTerm", guard);
    }
}
