using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Dtos.User;
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

    private static Fixture CreateFixture(bool strictBlobs = false)
    {
        var checklists = new Mock<IChecklistRepository>();
        var users = new Mock<IUserRepository>();
        users.Setup(repository => repository.GetCurrentUser())
            .ReturnsAsync(new LoadUserDto { Id = 42 });
        var blobs = strictBlobs
            ? new Mock<BlobServiceClient>(MockBehavior.Strict)
            : new Mock<BlobServiceClient>();
        var service = new ChecklistService(
            checklists.Object,
            users.Object,
            new HttpContextAccessor(),
            blobs.Object,
            Mock.Of<IAzureBlobService>(),
            Mock.Of<IOrganizationChecklistItemRepository>(),
            NullLogger<ChecklistService>.Instance);
        return new Fixture(service, checklists);
    }

    private sealed record Fixture(ChecklistService Service, Mock<IChecklistRepository> Checklists);
}
