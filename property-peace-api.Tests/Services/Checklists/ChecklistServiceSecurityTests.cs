using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.ChecklistService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Checklists;

public sealed class ChecklistServiceSecurityTests
{
    [Fact]
    public async Task GetChecklistsByUnitId_ScopesRepositoryReadToCurrentLandlord()
    {
        var fixture = CreateFixture();
        fixture.Checklists
            .Setup(repository => repository.GetChecklistsByUnitId(12, 42))
            .ReturnsAsync([new LoadChecklistDto { Id = 8, UnitId = 12, LandlordId = 42 }]);

        var response = await fixture.Service.GetChecklistsByUnitId(12);

        response.Success.Should().BeTrue();
        response.Data.Should().ContainSingle(checklist => checklist.Id == 8);
        fixture.Checklists.Verify(repository => repository.GetChecklistsByUnitId(12, 42), Times.Once);
    }

    [Fact]
    public async Task GetChecklistsByLeaseId_ScopesRepositoryReadToCurrentLandlord()
    {
        var fixture = CreateFixture();
        fixture.Checklists
            .Setup(repository => repository.GetChecklistsByLeaseId(19, 42))
            .ReturnsAsync([new LoadChecklistDto { Id = 8, LeaseId = 19, LandlordId = 42 }]);

        var response = await fixture.Service.GetChecklistsByLeaseId(19);

        response.Success.Should().BeTrue();
        response.Data.Should().ContainSingle(checklist => checklist.Id == 8);
        fixture.Checklists.Verify(repository => repository.GetChecklistsByLeaseId(19, 42), Times.Once);
    }

    [Fact]
    public async Task GetConditionReports_ScopesReadToCurrentOrganizationAndLandlord()
    {
        var fixture = CreateFixture(organizationId: 7);
        fixture.Checklists
            .Setup(repository => repository.GetConditionReports(42, 7, 3, 12, 19))
            .ReturnsAsync([new LoadChecklistDto { Id = 8, LandlordId = 42, PropertyId = 3, UnitId = 12, LeaseId = 19 }]);

        var response = await fixture.Service.GetConditionReports(3, 12, 19);

        response.Success.Should().BeTrue();
        response.Data.Should().ContainSingle(report => report.Id == 8);
        fixture.Checklists.Verify(repository => repository.GetConditionReports(42, 7, 3, 12, 19), Times.Once);
    }

    [Fact]
    public async Task ConditionReportInAnotherOrganization_CannotBeReadOrUpdatedByTheSameLandlord()
    {
        var fixture = CreateFixture(strictBlobs: true, organizationId: 7);
        var report = new LoadChecklistDto
        {
            Id = 8, LandlordId = 42, OrganizationId = 9, PropertyOrganizationId = 9,
            ChecklistType = ETenantDocumentType.ConditionReport
        };
        fixture.Checklists.Setup(repository => repository.GetChecklistById(8, It.IsAny<long?>())).ReturnsAsync(report);

        (await fixture.Service.GetChecklistById(8)).StatusCode.Should().Be(403);
        (await fixture.Service.UpdateChecklist(new UpdateChecklistDto { Id = 8, Title = "Other organization" })).StatusCode.Should().Be(403);
        fixture.Checklists.Verify(repository => repository.UpdateChecklist(It.IsAny<UpdateChecklistDto>()), Times.Never);
    }

    [Fact]
    public async Task AddConditionReport_InitializesDefaultRoomsAndOrganizationItems()
    {
        var fixture = CreateFixture(organizationId: 7);
        fixture.OrganizationItems.Setup(repository => repository.GetOrganizationChecklistItemsByOrganizationId(7))
            .ReturnsAsync([new LoadOrganizationChecklistItemDto { Name = "Smoke detector", Category = "Safety", SortOrder = 3 }]);
        fixture.Checklists.Setup(repository => repository.AddChecklist(It.IsAny<AddChecklistDto>(), 42, 7))
            .ReturnsAsync(new LoadChecklistDto { Id = 55, LandlordId = 42 });

        var response = await fixture.Service.AddConditionReport(new AddChecklistDto { PropertyId = 3 });

        response.Success.Should().BeTrue();
        fixture.Checklists.Verify(repository => repository.AddChecklist(
            It.Is<AddChecklistDto>(dto => dto.ChecklistType == ETenantDocumentType.ConditionReport &&
                dto.RoomNames!.SequenceEqual(new[] { "Kitchen", "Living room", "Bedroom", "Bathroom" }) &&
                dto.Items.Count == 1 && dto.Items[0].Name == "Smoke detector"),
            42,
            7), Times.Once);
    }

    [Fact]
    public async Task UploadChecklistItemImage_RejectsUnownedChecklistBeforeFileOrBlobWork()
    {
        var fixture = CreateFixture(strictBlobs: true);
        fixture.Checklists.Setup(repository => repository.GetChecklistById(9, 42))
            .ReturnsAsync((LoadChecklistDto?)null);
        var file = new FormFile(Stream.Null, 0, 0, "file", "bad.txt")
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/plain"
        };

        var response = await fixture.Service.UploadChecklistItemImage(9, 10, file);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(403);
        fixture.Checklists.Verify(
            repository => repository.UpdateChecklistItemPhoto(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task DeleteChecklistItemImage_RejectsUnownedChecklistBeforeDeletingBlob()
    {
        var fixture = CreateFixture(strictBlobs: true);
        fixture.Checklists.Setup(repository => repository.GetChecklistById(9, 42))
            .ReturnsAsync((LoadChecklistDto?)null);

        var response = await fixture.Service.DeleteChecklistItemImage(9, 10, "other-owner.jpg");

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(403);
        fixture.Checklists.Verify(
            repository => repository.DeleteChecklistItemPhoto(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task DeleteChecklistItemImage_RejectsBlobNotAttachedToRequestedItem()
    {
        var fixture = CreateFixture(strictBlobs: true);
        fixture.Checklists.Setup(repository => repository.GetChecklistById(9, 42))
            .ReturnsAsync(new LoadChecklistDto
            {
                Id = 9,
                LandlordId = 42,
                Items =
                [
                    new LoadChecklistItemDto
                    {
                        Id = 10,
                        PhotoBlobNames = ["attached.jpg"]
                    }
                ]
            });

        var response = await fixture.Service.DeleteChecklistItemImage(9, 10, "not-attached.jpg");

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteChecklistImage_RejectsBlobNotAttachedToSelectedImageSet()
    {
        var fixture = CreateFixture(strictBlobs: true);
        fixture.Checklists.Setup(repository => repository.GetChecklistById(9, 42))
            .ReturnsAsync(new LoadChecklistDto
            {
                Id = 9,
                LandlordId = 42,
                BeforeMoveInImagesBlobNames = ["attached.jpg"],
                AfterMoveOutImagesBlobNames = ["after.jpg"]
            });

        var response = await fixture.Service.DeleteChecklistImage(9, "not-attached.jpg", true);

        response.Success.Should().BeFalse();
        response.StatusCode.Should().Be(404);
        fixture.Checklists.Verify(
            repository => repository.UpdateChecklist(It.IsAny<UpdateChecklistDto>()),
            Times.Never);
    }

    private static Fixture CreateFixture(bool strictBlobs = false, long? organizationId = null)
    {
        var checklists = new Mock<IChecklistRepository>();
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetCurrentUser())
            .ReturnsAsync(new LoadUserDto { Id = 42 });
        var blobs = strictBlobs
            ? new Mock<BlobServiceClient>(MockBehavior.Strict)
            : new Mock<BlobServiceClient>();
        var context = new HttpContextAccessor { HttpContext = new DefaultHttpContext() };
        if (organizationId.HasValue)
            context.HttpContext.Items["OrganizationId"] = organizationId.Value;
        var organizationItems = new Mock<IOrganizationChecklistItemRepository>();
        var service = new ChecklistService(
            checklists.Object,
            users.Object,
            context,
            blobs.Object,
            Mock.Of<IAzureBlobService>(),
            organizationItems.Object,
            NullLogger<ChecklistService>.Instance);
        return new Fixture(service, checklists, organizationItems);
    }

    private sealed record Fixture(
        ChecklistService Service,
        Mock<IChecklistRepository> Checklists,
        Mock<IOrganizationChecklistItemRepository> OrganizationItems);
}
