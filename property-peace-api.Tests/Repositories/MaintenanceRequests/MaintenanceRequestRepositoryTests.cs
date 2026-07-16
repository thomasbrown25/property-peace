using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.MaintenanceRequests
{
    public class MaintenanceRequestRepositoryTests : IDisposable
    {
        private readonly DataContext _context;
        private readonly MaintenanceRequestRepository _repo;

        public MaintenanceRequestRepositoryTests()
        {
            _context = DbContextFactory.Create();
            var mapper = MapperFactory.Create();
            var logger = new Mock<ILogger<MaintenanceRequestRepository>>().Object;
            _repo = new MaintenanceRequestRepository(_context, logger, mapper);
        }

        public void Dispose() => _context.Dispose();

        // ── Seed helpers ──────────────────────────────────────────────────────────

        private static Property MakeProperty(long id, bool isDeleted = false) => new()
        {
            Id = id,
            Name = $"Property {id}",
            LandlordId = 1,
            IsDeleted = isDeleted,
        };

        private static MaintenanceRequest MakeRequest(
            long id,
            long propertyId,
            long orgId,
            EMaintenanceStatus status = EMaintenanceStatus.Reported,
            EMaintenancePriority priority = EMaintenancePriority.Medium,
            long? vendorId = null) => new()
        {
            Id = id,
            PropertyId = propertyId,
            OrganizationId = orgId,
            Title = $"Request {id}",
            Description = "Test description",
            Status = status,
            Priority = priority,
            VendorId = vendorId,
        };

        // ── GetMaintenanceRequestById ─────────────────────────────────────────────

        [Fact]
        public async Task GetMaintenanceRequestById_ReturnsMappedDto_WhenExists()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.Add(MakeRequest(1, propertyId: 1, orgId: 10));
            await _context.SaveChangesAsync();

            var result = await _repo.GetMaintenanceRequestById(1);

            result.Should().NotBeNull();
            result.Id.Should().Be(1);
            result.PropertyId.Should().Be(1);
        }

        [Fact]
        public async Task GetMaintenanceRequestById_ThrowsWithInnerKeyNotFoundException_WhenNotFound()
        {
            var act = async () => await _repo.GetMaintenanceRequestById(999);

            var assertion = await act.Should().ThrowAsync<Exception>();
            assertion.WithInnerExceptionExactly<KeyNotFoundException>();
        }

        // ── UpdateMaintenanceRequest ──────────────────────────────────────────────

        [Fact]
        public async Task UpdateMaintenanceRequest_PersistsChanges_WhenRequestExists()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.Add(MakeRequest(1, propertyId: 1, orgId: 10));
            await _context.SaveChangesAsync();

            var dto = new UpdateMaintenanceRequestDto
            {
                Id = 1,
                Title = "Updated Title",
                Description = "Updated description",
                Status = EMaintenanceStatus.InProgress,
                Priority = EMaintenancePriority.High,
                UnitName = "",
                ImageUrl = "",
            };

            var result = await _repo.UpdateMaintenanceRequest(dto);

            result.Should().NotBeNull();
            result!.Title.Should().Be("Updated Title");
            result.Status.Should().Be(EMaintenanceStatus.InProgress);
        }

        [Fact]
        public async Task UpdateMaintenanceRequest_ReturnsNull_WhenRequestNotFound()
        {
            var dto = new UpdateMaintenanceRequestDto { Id = 999, Title = "X", UnitName = "", ImageUrl = "" };

            var result = await _repo.UpdateMaintenanceRequest(dto);

            result.Should().BeNull();
        }

        [Fact]
        public async Task UpdateMaintenanceRequest_ClearsVendorId_WhenSetToNull()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.Add(MakeRequest(1, propertyId: 1, orgId: 10, vendorId: 42));
            await _context.SaveChangesAsync();

            var dto = new UpdateMaintenanceRequestDto
            {
                Id = 1,
                Title = "Request 1",
                UnitName = "",
                ImageUrl = "",
                VendorId = null,
            };

            var result = await _repo.UpdateMaintenanceRequest(dto);

            result!.VendorId.Should().BeNull();
        }

        // ── DeleteMaintenanceRequest ──────────────────────────────────────────────

        [Fact]
        public async Task DeleteMaintenanceRequest_ReturnsTrue_AndRemovesEntity_WhenExists()
        {
            _context.MaintenanceRequests.Add(MakeRequest(1, propertyId: 1, orgId: 10));
            await _context.SaveChangesAsync();

            var result = await _repo.DeleteMaintenanceRequest(1);

            result.Should().BeTrue();
            var inDb = await _context.MaintenanceRequests.FindAsync(1L);
            inDb.Should().BeNull();
        }

        [Fact]
        public async Task DeleteMaintenanceRequest_ReturnsFalse_WhenNotFound()
        {
            var result = await _repo.DeleteMaintenanceRequest(999);

            result.Should().BeFalse();
        }

        // ── DeleteMaintenanceRequestsByPropertyId ─────────────────────────────────

        [Fact]
        public async Task DeleteMaintenanceRequestsByPropertyId_DeletesAllForProperty()
        {
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10),
                MakeRequest(2, propertyId: 1, orgId: 10),
                MakeRequest(3, propertyId: 2, orgId: 10)
            );
            await _context.SaveChangesAsync();

            var count = await _repo.DeleteMaintenanceRequestsByPropertyId(1);

            count.Should().Be(2);
            _context.MaintenanceRequests.Count().Should().Be(1);
            _context.MaintenanceRequests.Single().Id.Should().Be(3);
        }

        // ── GetCurrentMaintenanceByOrganizationId ─────────────────────────────────

        [Fact]
        public async Task GetCurrentMaintenanceByOrganizationId_ExcludesCompletedAndCancelled()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Reported),
                MakeRequest(2, propertyId: 1, orgId: 10, status: EMaintenanceStatus.InProgress),
                MakeRequest(3, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved),
                MakeRequest(4, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved)
            );
            await _context.SaveChangesAsync();

            var results = await _repo.GetCurrentMaintenanceByOrganizationId(10);

            results.Should().HaveCount(2);
            results.Select(r => r.Id).Should().BeEquivalentTo([1L, 2L]);
        }

        [Fact]
        public async Task GetCurrentMaintenanceByOrganizationId_ExcludesRequestsOnDeletedProperties()
        {
            _context.Properties.AddRange(
                MakeProperty(1, isDeleted: false),
                MakeProperty(2, isDeleted: true)
            );
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10),
                MakeRequest(2, propertyId: 2, orgId: 10)
            );
            await _context.SaveChangesAsync();

            var results = await _repo.GetCurrentMaintenanceByOrganizationId(10);

            results.Should().HaveCount(1);
            results.Single().Id.Should().Be(1);
        }

        [Fact]
        public async Task GetCurrentMaintenanceByOrganizationId_ReturnsOnlyForRequestedOrg()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10),
                MakeRequest(2, propertyId: 1, orgId: 99)
            );
            await _context.SaveChangesAsync();

            var results = await _repo.GetCurrentMaintenanceByOrganizationId(10);

            results.Should().HaveCount(1);
            results.Single().Id.Should().Be(1);
        }

        // ── GetMaintenanceHistoryByOrganizationId ─────────────────────────────────

        [Fact]
        public async Task GetMaintenanceHistoryByOrganizationId_ReturnsOnlyCompletedAndCancelled()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Reported),
                MakeRequest(2, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved),
                MakeRequest(3, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved)
            );
            await _context.SaveChangesAsync();

            var results = await _repo.GetMaintenanceHistoryByOrganizationId(10);

            results.Should().HaveCount(2);
            results.Select(r => r.Id).Should().BeEquivalentTo([2L, 3L]);
        }

        [Fact]
        public async Task GetMaintenanceHistoryByOrganizationId_ExcludesDeletedProperties()
        {
            _context.Properties.AddRange(
                MakeProperty(1, isDeleted: false),
                MakeProperty(2, isDeleted: true)
            );
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved),
                MakeRequest(2, propertyId: 2, orgId: 10, status: EMaintenanceStatus.Resolved)
            );
            await _context.SaveChangesAsync();

            var results = await _repo.GetMaintenanceHistoryByOrganizationId(10);

            results.Should().HaveCount(1);
            results.Single().Id.Should().Be(1);
        }

        // ── GetPropertyOpenMaintenanceRequestsCount ───────────────────────────────

        [Fact]
        public async Task GetPropertyOpenMaintenanceRequestsCount_CountsOnlyOpenAndPending()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Reported),
                MakeRequest(2, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Acknowledged),
                MakeRequest(3, propertyId: 1, orgId: 10, status: EMaintenanceStatus.InProgress),
                MakeRequest(4, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved)
            );
            await _context.SaveChangesAsync();

            var count = await _repo.GetPropertyOpenMaintenanceRequestsCount(1);

            count.Should().Be(2);
        }

        [Fact]
        public async Task GetPropertyOpenMaintenanceRequestsCount_ReturnsZero_WhenNoneOpen()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.Add(
                MakeRequest(1, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved)
            );
            await _context.SaveChangesAsync();

            var count = await _repo.GetPropertyOpenMaintenanceRequestsCount(1);

            count.Should().Be(0);
        }

        // ── ResolveMaintenance ────────────────────────────────────────────────────

        [Fact]
        public async Task ResolveMaintenance_SetsStatusToCompleted_WhenExists()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.Add(MakeRequest(1, propertyId: 1, orgId: 10));
            await _context.SaveChangesAsync();

            var result = await _repo.ResolveMaintenance(1);

            result.Status.Should().Be(EMaintenanceStatus.Resolved);
        }

        [Fact]
        public async Task ResolveMaintenance_SetsCompletedAt_WhenExists()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.Add(MakeRequest(1, propertyId: 1, orgId: 10));
            await _context.SaveChangesAsync();

            var result = await _repo.ResolveMaintenance(1);

            result.CompletedAt.Should().NotBeNull();
            result.CompletedAt!.Value.Should().BeCloseTo(DateTime.Now, TimeSpan.FromSeconds(5));
        }

        // ── GetMaintenanceRequestsByPropertyId ────────────────────────────────────

        [Fact]
        public async Task GetMaintenanceRequestsByPropertyId_ReturnsAllStatusesForProperty()
        {
            _context.Properties.Add(MakeProperty(1));
            _context.MaintenanceRequests.AddRange(
                MakeRequest(1, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Reported),
                MakeRequest(2, propertyId: 1, orgId: 10, status: EMaintenanceStatus.Resolved),
                MakeRequest(3, propertyId: 2, orgId: 10, status: EMaintenanceStatus.Reported)
            );
            await _context.SaveChangesAsync();

            var results = await _repo.GetMaintenanceRequestsByPropertyId(1);

            results.Should().HaveCount(2);
            results.Select(r => r.Id).Should().BeEquivalentTo([1L, 2L]);
        }

        [Fact]
        public async Task GetMaintenanceRequestsByPropertyId_ExcludesDeletedProperty()
        {
            _context.Properties.Add(MakeProperty(1, isDeleted: true));
            _context.MaintenanceRequests.Add(MakeRequest(1, propertyId: 1, orgId: 10));
            await _context.SaveChangesAsync();

            var results = await _repo.GetMaintenanceRequestsByPropertyId(1);

            results.Should().BeEmpty();
        }
    }
}
