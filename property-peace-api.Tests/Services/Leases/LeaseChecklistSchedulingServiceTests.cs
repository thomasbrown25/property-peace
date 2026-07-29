using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.LeaseChecklistSchedulingService;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leases;

public sealed class LeaseChecklistSchedulingServiceTests
{
    [Fact]
    public async Task ProcessDueChecklistsAsync_CreatesLeaseLinkedMoveInChecklistFromDefaultTemplates()
    {
        var asOfDate = new DateTime(2026, 8, 1, 18, 30, 0);
        var lease = CreateCandidate();
        var leases = new Mock<ILeaseRepository>();
        var checklists = new Mock<IChecklistRepository>();
        var templates = new Mock<IOrganizationChecklistItemRepository>();
        AddChecklistDto? added = null;

        leases.Setup(repo => repo.GetLeasesDueForStartDateChecklist(asOfDate.Date))
            .ReturnsAsync([lease]);
        checklists.Setup(repo => repo.GetChecklistsByLeaseId(lease.Id))
            .ReturnsAsync([]);
        templates.Setup(repo => repo.GetOrganizationChecklistItemsByOrganizationId(7))
            .ReturnsAsync([
                new LoadOrganizationChecklistItemDto
                {
                    Id = 5,
                    OrganizationId = 7,
                    Name = "Document entry condition",
                    Category = "General",
                    IsDefault = true,
                    SortOrder = 1
                },
                new LoadOrganizationChecklistItemDto
                {
                    Id = 6,
                    OrganizationId = 7,
                    Name = "Organization-only custom task",
                    IsDefault = false,
                    SortOrder = 2
                }
            ]);
        checklists.Setup(repo => repo.AddChecklist(It.IsAny<AddChecklistDto>(), 9, 7))
            .Callback<AddChecklistDto, long, long?>((dto, _, _) => added = dto)
            .ReturnsAsync(new LoadChecklistDto());

        var service = CreateService(leases, checklists, templates);

        await service.ProcessDueChecklistsAsync(asOfDate);

        added.Should().NotBeNull();
        added!.ChecklistType.Should().Be(ETenantDocumentType.MoveInChecklist);
        added.LeaseId.Should().Be(42);
        added.PropertyId.Should().Be(3);
        added.UnitId.Should().Be(12);
        added.InspectionDate.Should().Be(new DateTime(2026, 8, 1));
        added.Title.Should().Be("2A - Move-In Checklist");
        added.Items.Should().ContainSingle(item => item.Name == "Document entry condition");
        added.Items.Should().NotContain(item => item.Name == "Organization-only custom task");
    }

    [Fact]
    public async Task ProcessDueChecklistsAsync_DoesNotCreateDuplicateMoveInChecklist()
    {
        var lease = CreateCandidate();
        var leases = new Mock<ILeaseRepository>();
        var checklists = new Mock<IChecklistRepository>();
        var templates = new Mock<IOrganizationChecklistItemRepository>();

        leases.Setup(repo => repo.GetLeasesDueForStartDateChecklist(It.IsAny<DateTime>()))
            .ReturnsAsync([lease]);
        checklists.Setup(repo => repo.GetChecklistsByLeaseId(lease.Id))
            .ReturnsAsync([
                new LoadChecklistDto { ChecklistType = ETenantDocumentType.MoveInChecklist }
            ]);

        var service = CreateService(leases, checklists, templates);

        await service.ProcessDueChecklistsAsync(new DateTime(2026, 8, 2));

        checklists.Verify(
            repo => repo.AddChecklist(It.IsAny<AddChecklistDto>(), It.IsAny<long>(), It.IsAny<long?>()),
            Times.Never);
        templates.Verify(
            repo => repo.GetOrganizationChecklistItemsByOrganizationId(It.IsAny<long>()),
            Times.Never);
    }

    [Fact]
    public async Task ProcessDueChecklistsAsync_SeedsDefaultsWhenOrganizationHasNone()
    {
        var lease = CreateCandidate();
        var leases = new Mock<ILeaseRepository>();
        var checklists = new Mock<IChecklistRepository>();
        var templates = new Mock<IOrganizationChecklistItemRepository>();

        leases.Setup(repo => repo.GetLeasesDueForStartDateChecklist(It.IsAny<DateTime>()))
            .ReturnsAsync([lease]);
        checklists.Setup(repo => repo.GetChecklistsByLeaseId(lease.Id)).ReturnsAsync([]);
        templates.SetupSequence(repo => repo.GetOrganizationChecklistItemsByOrganizationId(7))
            .ReturnsAsync([])
            .ReturnsAsync([
                new LoadOrganizationChecklistItemDto
                {
                    OrganizationId = 7,
                    Name = "Seeded task",
                    IsDefault = true
                }
            ]);
        checklists.Setup(repo => repo.AddChecklist(It.IsAny<AddChecklistDto>(), 9, 7))
            .ReturnsAsync(new LoadChecklistDto());

        var service = CreateService(leases, checklists, templates);

        await service.ProcessDueChecklistsAsync(new DateTime(2026, 8, 1));

        templates.Verify(repo => repo.SeedDefaultChecklistItems(7), Times.Once);
        checklists.Verify(
            repo => repo.AddChecklist(
                It.Is<AddChecklistDto>(dto => dto.Items.Count == 1 && dto.Items[0].Name == "Seeded task"),
                9,
                7),
            Times.Once);
    }

    private static LeaseChecklistSchedulingService CreateService(
        Mock<ILeaseRepository> leases,
        Mock<IChecklistRepository> checklists,
        Mock<IOrganizationChecklistItemRepository> templates) =>
        new(
            leases.Object,
            checklists.Object,
            templates.Object,
            NullLogger<LeaseChecklistSchedulingService>.Instance);

    private static LoadLeaseDto CreateCandidate() => new()
    {
        Id = 42,
        UnitId = 12,
        UnitName = "2A",
        PropertyId = 3,
        PropertyName = "Oak House",
        LandlordId = 9,
        OrganizationId = 7,
        StartDate = new DateTime(2026, 8, 1),
        CreateChecklistOnStartDate = true
    };
}
