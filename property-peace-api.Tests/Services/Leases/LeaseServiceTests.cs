using AutoMapper;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.LeaseService;
using brownstone_hub_api.Services.UserContextService;
using brownstone_hub_api.Dtos.User;
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
        private readonly Mock<IUserContextService> _userContext = new();
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
                userContextService: _userContext.Object,
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
            _userContext.Setup(service => service.GetCurrentUserAsync()).ReturnsAsync(new LoadUserDto
            {
                Id = 5,
                Firstname = "Current",
                Lastname = "Landlord",
                Email = "current.landlord@example.com",
                CurrentOrganizationId = orgId,
                Organizations = [new OrganizationInfoDto { Id = orgId, Name = "Current org", Role = "Owner" }]
            });
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
            StartDate = new DateTime(2026, 8, 1),
            EndDate = new DateTime(2027, 8, 1),
            RentAmount = 1500m,
            LeaseLength = 12,
            RentFrequency = "Monthly",
            RentDueDay = 1,
            IsDrafted = false,
        };

        // ── AddOrUpdateLease ──────────────────────────────────────────────────────

        [Fact]
        public async Task AddOrUpdateLease_FailsClosed_WhenOrganizationContextIsAbsent()
        {
            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto());

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
            _propertyRepo.Verify(r => r.GetPropertyById(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
            _leaseRepo.Verify(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), It.IsAny<long?>()), Times.Never);
        }

        [Fact]
        public async Task AddOrUpdateLease_RejectsForeignOrganizationPropertyAndUnit()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(77, 10)).ReturnsAsync((LoadPropertyDto?)null);

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto(77, 88));

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
            _propertyRepo.Verify(r => r.GetPropertyById(77, 10), Times.Once);
            _propertyRepo.Verify(r => r.GetPropertyById(77), Times.Never);
            _leaseRepo.Verify(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), It.IsAny<long?>()), Times.Never);
        }

        [Fact]
        public async Task AddOrUpdateLease_ReturnsError_WhenPropertyNotFound()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync((LoadPropertyDto?)null);

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto());

            result.Success.Should().BeFalse();
            result.Errors.Message.Should().Contain("Property");
        }

        [Fact]
        public async Task AddOrUpdateLease_ReturnsError_WhenUnitNotFoundInProperty()
        {
            var property = new LoadPropertyDto { Id = 1, Name = "Test", Units = [] }; // no units
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync(property);

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto(unitId: 99));

            result.Success.Should().BeFalse();
            result.Errors.Message.Should().Contain("Unit");
        }

        [Fact]
        public async Task AddOrUpdateLease_CreatesNewLease_WhenNoExistingLease()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync(MakePropertyWithUnit());
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
        public async Task AddOrUpdateLease_NormalizesMonthToMonthEndDateFromStartDate()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync(MakePropertyWithUnit());
            _leaseRepo.Setup(r => r.GetLease(1, 10L)).ReturnsAsync((LoadLeaseDto)null!);
            _leaseRepo.Setup(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), 10L))
                      .ReturnsAsync(MakeLeaseDto(1));
            _propertyRepo.Setup(r => r.UpdateProperty(It.IsAny<UpdatePropertyDto>()))
                         .ReturnsAsync(new LoadPropertyDto { Id = 1 });
            var lease = MakeUpdateLeaseDto();
            lease.StartDate = new DateTime(2026, 1, 31);
            lease.EndDate = new DateTime(2026, 12, 31);
            lease.LeaseLength = -1;

            var result = await _sut.AddOrUpdateLease(lease);

            result.Success.Should().BeTrue();
            _leaseRepo.Verify(r => r.AddLease(
                It.Is<UpdateLeaseDto>(candidate => candidate.EndDate == new DateTime(2026, 2, 28)),
                10L), Times.Once);
        }

        [Fact]
        public async Task AddOrUpdateLease_DoesNotRewindRenewedMonthToMonthEndDateDuringUpdate()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync(MakePropertyWithUnit());
            _leaseRepo.Setup(r => r.GetLeaseById(5, 10L)).ReturnsAsync(new LoadLeaseDto
            {
                Id = 5,
                UnitId = 1,
                LeaseLength = -1,
                EndDate = new DateTime(2026, 9, 28),
                AutoRenewLease = true
            });
            _leaseRepo.Setup(r => r.UpdateLease(It.IsAny<UpdateLeaseDto>())).ReturnsAsync(MakeLeaseDto(5));
            var lease = MakeUpdateLeaseDto();
            lease.Id = 5;
            lease.StartDate = new DateTime(2026, 1, 31);
            lease.EndDate = new DateTime(2026, 2, 28);
            lease.LeaseLength = -1;
            lease.AutoRenewLease = true;

            var result = await _sut.AddOrUpdateLease(lease);

            result.Success.Should().BeTrue();
            _leaseRepo.Verify(r => r.UpdateLease(
                It.Is<UpdateLeaseDto>(candidate => candidate.EndDate == new DateTime(2026, 9, 28))),
                Times.Once);
        }

        [Fact]
        public async Task AddOrUpdateLease_AllowsDraftWithMissingLeaseDetails()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync(MakePropertyWithUnit());
            _leaseRepo.Setup(r => r.GetLease(1, 10L)).ReturnsAsync((LoadLeaseDto)null!);
            _leaseRepo.Setup(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), 10L))
                      .ReturnsAsync(new LoadLeaseDto { Id = 42, IsActive = false });
            _propertyRepo.Setup(r => r.UpdateProperty(It.IsAny<UpdatePropertyDto>()))
                         .ReturnsAsync(new LoadPropertyDto { Id = 1 });
            var draft = new UpdateLeaseDto
            {
                PropertyId = 1,
                UnitId = 1,
                IsDrafted = true,
                IsActive = false
            };

            var result = await _sut.AddOrUpdateLease(draft);

            result.Success.Should().BeTrue();
            _leaseRepo.Verify(r => r.AddLease(
                It.Is<UpdateLeaseDto>(lease =>
                    lease.IsDrafted == true &&
                    lease.StartDate == null &&
                    lease.EndDate == null &&
                    lease.RentAmount == null &&
                    lease.LeaseLength == null &&
                    lease.RentFrequency == null &&
                    lease.RentDueDay == null),
                10L), Times.Once);
        }

        [Fact]
        public async Task AddOrUpdateLease_RejectsNonDraftWithMissingLeaseDetails()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync(MakePropertyWithUnit());
            var incomplete = new UpdateLeaseDto
            {
                PropertyId = 1,
                UnitId = 1,
                IsDrafted = false
            };

            var result = await _sut.AddOrUpdateLease(incomplete);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
            result.Message.Should().Be("Missing required lease details");
            _leaseRepo.Verify(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), It.IsAny<long?>()), Times.Never);
        }

        [Fact]
        public async Task AddOrUpdateLease_UpdatesExistingLease_WhenLeaseAlreadyExists()
        {
            SetOrgContext(10);
            _propertyRepo.Setup(r => r.GetPropertyById(1, 10)).ReturnsAsync(MakePropertyWithUnit());
            _leaseRepo.Setup(r => r.GetLease(1, 10L)).ReturnsAsync(MakeLeaseDto(1));
            _leaseRepo.Setup(r => r.UpdateLease(It.IsAny<UpdateLeaseDto>())).ReturnsAsync(MakeLeaseDto(1));

            var result = await _sut.AddOrUpdateLease(MakeUpdateLeaseDto());

            result.Success.Should().BeTrue();
            _leaseRepo.Verify(r => r.UpdateLease(It.IsAny<UpdateLeaseDto>()), Times.Once);
            _leaseRepo.Verify(r => r.AddLease(It.IsAny<UpdateLeaseDto>(), It.IsAny<long?>()), Times.Never);
        }

        // ── Signature tenant validation ───────────────────────────────────────────

        [Fact]
        public async Task SignLandlordOnly_IgnoresConflictingClientIdentityAndUsesAuthenticatedMember()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(1, 10, It.IsAny<CancellationToken>())).ReturnsAsync(LeaseWithTenants());
            var request = new SendLeaseForSignatureDto
            {
                LeaseId = 1,
                LandlordEmail = "attacker@example.com",
                LandlordName = "Attacker"
            };

            var result = await _sut.SignLandlordOnlyAsync(1, request, "https://example.test", CancellationToken.None);

            result.StatusCode.Should().Be(400); // no document service in this focused unit test
            request.LandlordEmail.Should().Be("current.landlord@example.com");
            request.LandlordName.Should().Be("Current Landlord");
        }

        [Theory]
        [InlineData("missing")]
        [InlineData("extra")]
        [InlineData("duplicate")]
        public async Task SendLeaseForSignature_RejectsSignerSetThatDoesNotExactlyMatchLease(string variation)
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(1, 10, It.IsAny<CancellationToken>())).ReturnsAsync(LeaseWithTenants());
            var signers = variation switch
            {
                "missing" => new List<TenantSignerDto> { Signer(10, "one@example.com", "One Tenant") },
                "extra" => new List<TenantSignerDto>
                {
                    Signer(10, "one@example.com", "One Tenant"),
                    Signer(20, "two@example.com", "Two Tenant"),
                    Signer(30, "extra@example.com", "Extra Tenant")
                },
                _ => new List<TenantSignerDto>
                {
                    Signer(10, "one@example.com", "One Tenant"),
                    Signer(10, "one@example.com", "One Tenant")
                }
            };

            var result = await _sut.SendLeaseForSignatureAsync(1,
                new SendLeaseForSignatureDto { LeaseId = 1, TenantSigners = signers }, 5, 10, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
            result.Message.Should().Be("Invalid tenant signers");
        }

        [Fact]
        public async Task SendLeaseForSignature_RejectsIdentityMismatch()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(1, 10, It.IsAny<CancellationToken>())).ReturnsAsync(LeaseWithTenants());
            var request = new SendLeaseForSignatureDto
            {
                TenantSigners =
                [
                    Signer(10, "attacker@example.com", "One Tenant"),
                    Signer(20, "two@example.com", "Two Tenant")
                ]
            };

            var result = await _sut.SendLeaseForSignatureAsync(1, request, 5, 10, CancellationToken.None);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(400);
            result.Message.Should().Be("Invalid tenant signer identity");
        }

        [Fact]
        public async Task SendLeaseForSignature_NormalizesIdentityAndOrdersSignersByTenantId()
        {
            SetOrgContext(10);
            _leaseRepo.Setup(r => r.GetLeaseById(1, 10, It.IsAny<CancellationToken>())).ReturnsAsync(LeaseWithTenants());
            var request = new SendLeaseForSignatureDto
            {
                LandlordEmail = "attacker@example.com",
                LandlordName = "Attacker",
                TenantSigners =
                [
                    Signer(20, " TWO@example.com ", " two   tenant "),
                    Signer(10, "ONE@example.com", "one tenant")
                ]
            };

            var result = await _sut.SendLeaseForSignatureAsync(1, request, 5, 10, CancellationToken.None);

            // This test has no document service, so it stops after signer normalization.
            result.StatusCode.Should().Be(400);
            request.LandlordEmail.Should().Be("current.landlord@example.com");
            request.LandlordName.Should().Be("Current Landlord");
            request.TenantSigners.Select(s => s.TenantId).Should().Equal(10, 20);
            request.TenantSigners.Select(s => s.Email).Should().Equal("one@example.com", "two@example.com");
            request.TenantSigners.Select(s => s.Name).Should().Equal("One Tenant", "Two Tenant");
            request.TenantSigners.Select(s => s.SigningOrder).Should().Equal(2, 3);
        }

        private static LoadLeaseDto LeaseWithTenants() => new()
        {
            Id = 1,
            Tenants =
            [
                new LoadTenantDto { Id = 20, Firstname = "Two", Lastname = "Tenant", Email = "two@example.com" },
                new LoadTenantDto { Id = 10, Firstname = "One", Lastname = "Tenant", Email = "one@example.com" }
            ]
        };

        private static TenantSignerDto Signer(long id, string email, string name) =>
            new() { TenantId = id, Email = email, Name = name, SigningOrder = 99 };

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
            _leaseRepo.Setup(r => r.GetLeaseById(1, 10)).ReturnsAsync(MakeLeaseDto(1));
            _leaseRepo.Setup(r => r.CompleteDraft(1, 10)).ReturnsAsync(MakeLeaseDto(1));

            var result = await _sut.CompleteDraft(1);

            result.Success.Should().BeTrue();
            result.Data!.Id.Should().Be(1);
        }
    }
}
