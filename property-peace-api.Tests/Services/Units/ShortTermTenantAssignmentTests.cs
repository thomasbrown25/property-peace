using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.TenantService;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Services.NotificationService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class ShortTermTenantAssignmentTests
{
    [Theory]
    [InlineData(ERentalMode.ShortTerm, false)]
    [InlineData(ERentalMode.LongTerm, true)]
    public async Task Direct_assignment_requires_long_term_unit(ERentalMode mode, bool allowed)
    {
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Organizations.Add(new Organization { Id = 20, IsActive = true });
        db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 20, UserId = 42, Role = "Owner", IsActive = true });
        await db.SaveChangesAsync();
        var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        http.HttpContext.Items["OrganizationId"] = 20L;
        http.HttpContext.Items["UserId"] = 42L;
        var units = new Mock<IUnitRepository>();
        units.Setup(x => x.GetUnitById(10, 20)).ReturnsAsync(new LoadUnitDto { Id = 10, PropertyId = 7, RentalMode = mode });
        var tenants = new Mock<ITenantRepository>();
        tenants.Setup(x => x.AddTenant(It.IsAny<AddTenantDto>())).ReturnsAsync(new LoadTenantDto { Id = 3 });
        var service = new TenantService(tenants.Object, units.Object, Mock.Of<IUnitService>(),
            Mock.Of<IPropertyRepository>(), Mock.Of<INotificationService>(), Mock.Of<IUserRepository>(),
            http, NullLogger<TenantService>.Instance, db);
        var result = await service.AddOrUpdateTenant(new AddTenantDto { UnitId = 10 });
        Assert.Equal(allowed, result.Success);
        tenants.Verify(x => x.AddTenant(It.IsAny<AddTenantDto>()), allowed ? Times.Once : Times.Never);
    }
}
