using AutoMapper;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.LeaseService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leases
{
    public class LeaseServiceTests
    {
        // ── Mocks / SUT ───────────────────────────────────────────────────────────

        private readonly Mock<ILeaseRepository> _leaseRepo = new();
        private readonly Mock<IPropertyRepository> _propertyRepo = new();
        private readonly Mock<IHttpContextAccessor> _httpContext = new();
        private readonly IMapper _mapper = MapperFactory.Create();
        private readonly LeaseService _sut;

        public LeaseServiceTests()
        {
            _sut = new LeaseService(
                _leaseRepo.Object,
                _propertyRepo.Object,
                _httpContext.Object,
                Mock.Of<ILogger<LeaseService>>(),
                _mapper,
                eSignatureService: null,
                tenantDocumentService: null,
                blobServiceClient: null,
                configuration: null,
                notificationService: null,
                userService: null,
                userContextService: null,
                dataContext: null,
                paymentRepository: null,
                paymentService: null,
                emailService: null
            );
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        /// <summary>Sets OrganizationId = orgId into the mocked HttpContext.Items.</summary>
        private void SetOrgContext(long orgId = 10)
        {
            var ctx = new DefaultHttpContext();
            ctx.Items["OrganizationId"] = orgId;
            _httpContext.Setup(h => h.HttpContext).Returns(ctx);
        }

        private static LoadLeaseDto MakeLeaseDto(long id = 1) => new() { Id = id, IsActive = true };

        private static LoadPropertyDto MakePropertyWithUnit(long propertyId = 1, long unitId = 1) => new()
        {
            Id = propertyId,
            Name = "Test Property",
            Units = [new LoadUnitDto { Id = unitId, PropertyId = propertyId }],
        };

        private static UpdateLeaseDto MakeUpdateLeaseDto(long propertyId = 1, long unitId = 1) => new()
        {
            PropertyId = propertyId,
            UnitId = unitId,
        };

        // ── AddOrUpdateLease ──────────────────────────────────────────────────────

        [Fact]
        public async Task AddOrUpdateLease_ReturnsError_WhenPropertyNotFound()
        {
            _propertyRepo.Setup(r => r.GetPropertyById(1)).ReturnsAsync((LoadPropertyDto?)null);

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto());

            result.Success.Should().BeFalse();
            result.Errors.Message.Should().Contain("Property");
        }

        [Fact]
        public async Task AddOrUpdateLease_ReturnsError_WhenUnitNotFoundInProperty()
        {
            var property = new LoadPropertyDto { Id = 1, Name = "Test", Units = [] }; // no units
            _propertyRepo.Setup(r => r.GetPropertyById(1)).ReturnsAsync(property);

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto(unitId: 99));

            result.Success.Should().BeFalse();
            result.Errors.Message.Should().Contain("Unit");
        }

        [Fact]
        public async Task AddOrUpdateLease_CreatesNewLease_WhenNoExistingLease()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1)).ReturnsAsync(MakePropertyWithUnit());
            _leaseRepo.Setup(r => r.GetLease(1, 10L)).ReturnsAsync((LoadLeaseDto)null!);
            _leaseRepo.Setup(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), 10L))
                      .ReturnsAsync(MakeLeaseDto(1));
            _propertyRepo.Setup(r => r.UpdateProperty(It.IsAny<UpdatePropertyDto>()))
                         .ReturnsAsync(new LoadPropertyDto { Id = 1 });

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto());

            result.Success.Should().BeTrue();
            result.Data!.Id.Should().Be(1);
            _leaseRepo.Verify(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), 10L), Times.Once);
        }

        [Fact]
        public async Task AddOrUpdateLease_UpdatesExistingLease_WhenLeaseAlreadyExists()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1)).ReturnsAsync(MakePropertyWithUnit());
            _leaseRepo.Setup(r => r.GetLease(1, 10L)).ReturnsAsync(MakeLeaseDto(1));
            _leaseRepo.Setup(r => r.UpdateLease(It.IsAny<UpdateLeaseDto>())).ReturnsAsync(MakeLeaseDto(1));

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto());

            result.Success.Should().BeTrue();
            _leaseRepo.Verify(r => r.UpdateLease(It.IsAny<UpdateLeaseDto>()), Times.Once);
            _leaseRepo.Verify(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), It.IsAny<long?>()), Times.Never);
        }

        // ── EndLease ──────────────────────────────────────────────────────────────

        [Fact]
        public async Task EndLease_Returns400_WhenNoOrgContext()
        {
            // HttpContext not set up → HttpContext is null → no org ID

            var result = await _sut.EndLease(1);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
        }

        [Fact]
        public async Task EndLease_Returns404_WhenLeaseNotFound()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(99, 10)).ReturnsAsync((LoadLeaseDto)null!);

            var result = await _sut.EndLease(99);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
        }

        [Fact]
        public async Task EndLease_ReturnsSuccess_WhenLeaseExists()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(1, 10)).ReturnsAsync(MakeLeaseDto(1));
            _leaseRepo.Setup(r => r.EndLease(1)).ReturnsAsync(MakeLeaseDto(1));

            var result = await _sut.EndLease(1);

            result.Success.Should().BeTrue();
            _leaseRepo.Verify(r => r.EndLease(1), Times.Once);
        }

        // ── ReopenLease ───────────────────────────────────────────────────────────

        [Fact]
        public async Task ReopenLease_Returns400_WhenNoOrgContext()
        {
            var result = await _sut.ReopenLease(1);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
        }

        [Fact]
        public async Task ReopenLease_Returns404_WhenLeaseNotFound()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(99, 10)).ReturnsAsync((LoadLeaseDto)null!);

            var result = await _sut.ReopenLease(99);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
        }

        [Fact]
        public async Task ReopenLease_ReturnsSuccess_WhenLeaseExists()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(1, 10)).ReturnsAsync(MakeLeaseDto(1));
            _leaseRepo.Setup(r => r.ReopenLease(1)).ReturnsAsync(MakeLeaseDto(1));

            var result = await _sut.ReopenLease(1);

            result.Success.Should().BeTrue();
            _leaseRepo.Verify(r => r.ReopenLease(1), Times.Once);
        }

        // ── CompleteDraft ─────────────────────────────────────────────────────────

        [Fact]
        public async Task CompleteDraft_Returns400_WhenNoOrgContext()
        {
            var result = await _sut.CompleteDraft(1);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
        }

        [Fact]
        public async Task CompleteDraft_Returns404_WhenLeaseNotFound()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.CompleteDraft(99, 10))
                      .ThrowsAsync(new KeyNotFoundException("Lease not found"));

            var result = await _sut.CompleteDraft(99);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
        }

        [Fact]
        public async Task CompleteDraft_ReturnsSuccess_WhenLeaseExists()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.CompleteDraft(1, 10)).ReturnsAsync(MakeLeaseDto(1));

            var result = await _sut.CompleteDraft(1);

            result.Success.Should().BeTrue();
            result.Data!.Id.Should().Be(1);
        }
    }
}
