using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Vendor;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Images;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Vendors;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.MaintenanceRequestService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Dtos.Image;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.MaintenanceRequests
{
    public class MaintenanceRequestServiceTests
    {
        // ── Mocks ─────────────────────────────────────────────────────────────────

        private readonly Mock<IMaintenanceRequestRepository> _repo = new();
        private readonly Mock<IVendorRepository> _vendorRepo = new();
        private readonly Mock<IPropertyRepository> _propertyRepo = new();
        private readonly Mock<IEmailService> _emailService = new();
        private readonly Mock<INotificationService> _notificationService = new();
        private readonly Mock<IUserRepository> _userRepo = new();
        private readonly Mock<IUnitRepository> _unitRepo = new();
        private readonly Mock<IOrganizationMemberRepository> _orgMemberRepo = new();
        private readonly Mock<IHttpContextAccessor> _httpContext = new();
        private readonly Mock<IOpenAIService> _openAI = new();
        private readonly Mock<IImageService<MaintenanceImage, LoadImageDto, AddImageDto>> _imageService = new();

        private readonly EmailTemplateService _emailTemplateService =
            new(Mock.Of<ILogger<EmailTemplateService>>());
        private readonly MaintenanceRequestService _sut;

        public MaintenanceRequestServiceTests()
        {
            _sut = new MaintenanceRequestService(
                _repo.Object,
                _imageService.Object,
                _propertyRepo.Object,
                Mock.Of<BlobServiceClient>(),
                _userRepo.Object,
                _notificationService.Object,
                _unitRepo.Object,
                _vendorRepo.Object,
                _emailService.Object,
                _emailTemplateService,
                _orgMemberRepo.Object,
                _httpContext.Object,
                Mock.Of<ILogger<MaintenanceRequestService>>(),
                _openAI.Object
            );
        }

        // ── Seed helpers ──────────────────────────────────────────────────────────

        private static LoadMaintenanceRequestDto MakeDto(
            long id = 1,
            long? vendorId = null,
            long? unitId = null,
            EMaintenanceStatus status = EMaintenanceStatus.Reported) => new()
            {
                Id = id,
                PropertyId = 1,
                Title = $"Request {id}",
                Description = "Test",
                Status = status,
                Priority = EMaintenancePriority.Medium,
                VendorId = vendorId,
                UnitId = unitId,
                UnitName = "Unit 1",
            };

        // ── GetMaintenanceRequestById ─────────────────────────────────────────────

        [Fact]
        public async Task GetMaintenanceRequestById_ReturnsSuccess_WhenFound()
        {
            _repo.Setup(r => r.GetMaintenanceRequestById(1)).ReturnsAsync(MakeDto(1));

            var result = await _sut.GetMaintenanceRequestById(1);

            result.Success.Should().BeTrue();
            result.Data!.Id.Should().Be(1);
        }

        [Fact]
        public async Task GetMaintenanceRequestById_ReturnsError_WhenNotFound()
        {
            _repo.Setup(r => r.GetMaintenanceRequestById(99))
                 .ThrowsAsync(new Exception("not found", new KeyNotFoundException()));

            var result = await _sut.GetMaintenanceRequestById(99);

            result.Success.Should().BeFalse();
        }

        // ── UpdateMaintenanceRequest — vendor email ────────────────────────────────

        [Fact]
        public async Task UpdateMaintenanceRequest_SendsVendorEmail_WhenVendorChanges()
        {
            var existing = MakeDto(1, vendorId: null);
            var updated = MakeDto(1, vendorId: 5);
            var vendor = new LoadVendorDto { Id = 5, Name = "ACME", Email = "vendor@acme.com", IsActive = true };

            _repo.Setup(r => r.GetMaintenanceRequestById(1)).ReturnsAsync(existing);
            _repo.Setup(r => r.UpdateMaintenanceRequest(It.IsAny<UpdateMaintenanceRequestDto>()))
                 .ReturnsAsync(updated);
            _vendorRepo.Setup(v => v.GetVendorById(5)).ReturnsAsync(vendor);
            _propertyRepo.Setup(p => p.GetPropertyById(It.IsAny<long>()))
                         .ReturnsAsync(new LoadPropertyDto { Id = 1, Name = "Test Property" });
            _emailService.Setup(e => e.SendEmailAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var result = await _sut.UpdateMaintenanceRequest(1, new UpdateMaintenanceRequestDto
            {
                Id = 1,
                Title = "Request 1",
                VendorId = 5,
                UnitName = "",
                ImageUrl = ""
            });

            result.Success.Should().BeTrue();
            _emailService.Verify(
                e => e.SendEmailAsync(
                    "vendor@acme.com", It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string?>(), It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task UpdateMaintenanceRequest_DoesNotSendEmail_WhenVendorUnchanged()
        {
            var existing = MakeDto(1, vendorId: 5);
            var updated = MakeDto(1, vendorId: 5);

            _repo.Setup(r => r.GetMaintenanceRequestById(1)).ReturnsAsync(existing);
            _repo.Setup(r => r.UpdateMaintenanceRequest(It.IsAny<UpdateMaintenanceRequestDto>()))
                 .ReturnsAsync(updated);

            await _sut.UpdateMaintenanceRequest(1, new UpdateMaintenanceRequestDto
            {
                Id = 1,
                Title = "Request 1",
                VendorId = 5,
                UnitName = "",
                ImageUrl = ""
            });

            _emailService.Verify(
                e => e.SendEmailAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string?>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task UpdateMaintenanceRequest_DoesNotSendEmail_WhenVendorHasNoEmail()
        {
            var existing = MakeDto(1, vendorId: null);
            var updated = MakeDto(1, vendorId: 5);
            var vendor = new LoadVendorDto { Id = 5, Name = "ACME", Email = null, IsActive = true };

            _repo.Setup(r => r.GetMaintenanceRequestById(1)).ReturnsAsync(existing);
            _repo.Setup(r => r.UpdateMaintenanceRequest(It.IsAny<UpdateMaintenanceRequestDto>()))
                 .ReturnsAsync(updated);
            _vendorRepo.Setup(v => v.GetVendorById(5)).ReturnsAsync(vendor);

            var result = await _sut.UpdateMaintenanceRequest(1, new UpdateMaintenanceRequestDto
            {
                Id = 1,
                Title = "Request 1",
                VendorId = 5,
                UnitName = "",
                ImageUrl = ""
            });

            result.Success.Should().BeTrue();
            _emailService.Verify(
                e => e.SendEmailAsync(
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                    It.IsAny<string?>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        // ── UpdateMaintenanceRequest — not found ──────────────────────────────────

        [Fact]
        public async Task UpdateMaintenanceRequest_ReturnsError_WhenRequestNotFound()
        {
            _repo.Setup(r => r.GetMaintenanceRequestById(99))
                 .ThrowsAsync(new Exception("not found", new KeyNotFoundException()));

            var result = await _sut.UpdateMaintenanceRequest(99, new UpdateMaintenanceRequestDto
            {
                Id = 99,
                Title = "X",
                UnitName = "",
                ImageUrl = ""
            });

            result.Success.Should().BeFalse();
        }

        // ── DeleteMaintenanceRequest ──────────────────────────────────────────────

        [Fact]
        public async Task DeleteMaintenanceRequest_ReturnsSuccess_WhenDeleted()
        {
            _repo.Setup(r => r.GetMaintenanceRequestById(1)).ReturnsAsync(MakeDto(1));
            _repo.Setup(r => r.DeleteMaintenanceRequest(1)).ReturnsAsync(true);

            var result = await _sut.DeleteMaintenanceRequest(1);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
        }

        [Fact]
        public async Task DeleteMaintenanceRequest_ReturnsFailure_WhenNotFound()
        {
            // GetMaintenanceRequestById not set up → returns null → service returns 404
            var result = await _sut.DeleteMaintenanceRequest(99);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
        }

        // ── ResolveMaintenance ────────────────────────────────────────────────────

        [Fact]
        public async Task ResolveMaintenance_ReturnsCompleted_WhenSuccessful()
        {
            var resolved = MakeDto(1, status: EMaintenanceStatus.Resolved);
            _repo.Setup(r => r.ResolveMaintenance(1)).ReturnsAsync(resolved);

            var result = await _sut.ResolveMaintenance(1);

            result.Success.Should().BeTrue();
            result.Data!.Status.Should().Be(EMaintenanceStatus.Resolved);
        }

        // ── GetCurrentMaintenanceByOrganizationId ─────────────────────────────────

        [Fact]
        public async Task GetCurrentMaintenanceByOrganizationId_ReturnsList()
        {
            _repo.Setup(r => r.GetCurrentMaintenanceByOrganizationId(10))
                 .ReturnsAsync([MakeDto(1), MakeDto(2)]);

            var result = await _sut.GetCurrentMaintenanceByOrganizationId(10);

            result.Success.Should().BeTrue();
            result.Data.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetCurrentMaintenanceByOrganizationId_ReturnsError_OnException()
        {
            _repo.Setup(r => r.GetCurrentMaintenanceByOrganizationId(10))
                 .ThrowsAsync(new Exception("db error"));

            var result = await _sut.GetCurrentMaintenanceByOrganizationId(10);

            result.Success.Should().BeFalse();
        }

        // ── GetPropertyOpenMaintenanceRequestsCount ───────────────────────────────

        [Fact]
        public async Task GetPropertyOpenMaintenanceRequestsCount_ReturnsCount()
        {
            _repo.Setup(r => r.GetPropertyOpenMaintenanceRequestsCount(1)).ReturnsAsync(3);

            var result = await _sut.GetPropertyOpenMaintenanceRequestsCount(1);

            result.Success.Should().BeTrue();
            result.Data.Should().Be(3);
        }
    }
}
