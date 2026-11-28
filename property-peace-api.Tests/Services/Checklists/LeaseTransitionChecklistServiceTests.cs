using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.LeaseTransitionChecklist;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.LeaseTransitionChecklistService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Checklists;

public sealed class LeaseTransitionChecklistServiceTests
{
    [Fact]
    public async Task Create_FromLease_InheritsTheLeaseUnit_AndReusesTheRequest()
    {
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Properties.Add(new Property { Id = 3, Name = "Maple House", LandlordId = 42, OrganizationId = 7, PropertyType = EPropertyType.MultiUnit });
        db.Units.Add(new Unit { Id = 12, Name = "Unit 2", PropertyId = 3, OrganizationId = 7 });
        db.Leases.Add(new Lease { Id = 19, UnitId = 12, OrganizationId = 7 });
        await db.SaveChangesAsync();
        var service = CreateService(db);
        var request = new CreateLeaseTransitionChecklistDto { PropertyId = 3, LeaseId = 19, Phase = ELeaseTransitionPhase.MoveIn, RequestId = "transition-retry-1" };

        var first = await service.Create(request);
        var retry = await service.Create(new CreateLeaseTransitionChecklistDto { PropertyId = 3, LeaseId = 19, Phase = ELeaseTransitionPhase.MoveIn, RequestId = "transition-retry-1" });

        first.Success.Should().BeTrue();
        first.Data!.UnitId.Should().Be(12);
        first.Data.Items.Should().Contain(x => x.Key == "condition-report" && !x.AllowNotApplicable);
        retry.Success.Should().BeTrue();
        retry.Data!.Id.Should().Be(first.Data.Id);
        (await db.LeaseTransitionChecklists.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task LinkConditionReport_AllowsPropertyLevelLegacyReportForTheOnlyUnit()
    {
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Properties.Add(new Property { Id = 3, LandlordId = 42, OrganizationId = 7, PropertyType = EPropertyType.SingleFamily });
        db.Units.Add(new Unit { Id = 12, PropertyId = 3, OrganizationId = 7 });
        db.LeaseTransitionChecklists.Add(new LeaseTransitionChecklist { Id = 90, OrganizationId = 7, LandlordId = 42, PropertyId = 3, UnitId = 12, Phase = ELeaseTransitionPhase.MoveIn, RequestId = "handoff-1", Items = [new LeaseTransitionChecklistItem { Key = "condition-report", Label = "Complete condition report" }] });
        db.Checklists.Add(new Checklist { Id = 44, OrganizationId = 7, LandlordId = 42, PropertyId = 3, ChecklistType = ETenantDocumentType.MoveInChecklist });
        await db.SaveChangesAsync();
        var service = CreateService(db);

        var response = await service.LinkConditionReport(90, new LinkConditionReportDto { ConditionReportId = 44 });

        response.Success.Should().BeTrue();
        response.Data!.ConditionReportId.Should().Be(44);
    }

    private static LeaseTransitionChecklistService CreateService(DataContext db)
    {
        var users = new Mock<IUserRepository>();
        users.Setup(x => x.GetCurrentUser()).ReturnsAsync(new LoadUserDto { Id = 42 });
        var context = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        context.HttpContext.Items["OrganizationId"] = 7L;
        return new LeaseTransitionChecklistService(db, users.Object, Mock.Of<IOrganizationChecklistItemRepository>(), context);
    }
}
