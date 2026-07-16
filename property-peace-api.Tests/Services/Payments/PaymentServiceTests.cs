using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.AccountMappingService;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Payments
{
    public class PaymentServiceTests : IDisposable
    {
        // ── Mocks / SUT ───────────────────────────────────────────────────────────

        private readonly Mock<IPaymentRepository> _repo = new();
        private readonly Mock<IAccountMappingService> _accountMapping = new();
        private readonly Mock<IGeneralLedgerService> _ledger = new();
        private readonly Data.DataContext _context;
        private readonly PaymentService _sut;

        public PaymentServiceTests()
        {
            _context = DbContextFactory.Create();

            _sut = new PaymentService(
                _repo.Object,
                _accountMapping.Object,
                _ledger.Object,
                _context,
                Mock.Of<ILogger<PaymentService>>()
            );
        }

        public void Dispose() => _context.Dispose();

        // ── Seed helpers ──────────────────────────────────────────────────────────

        private static LoadPaymentDto MakePaymentDto(
            long id = 1,
            decimal amount = 1200m,
            string status = "Completed") => new()
        {
            Id = id,
            Amount = amount,
            Status = status,
            PaymentDate = DateTime.UtcNow,
            LeaseId = 1,
        };

        // ── AddPayment ────────────────────────────────────────────────────────────

        [Fact]
        public async Task AddPayment_ReturnsSuccess_WhenRepositorySucceeds()
        {
            var dto = new AddPaymentDto { Amount = 1200, LeaseId = 1 };
            _repo.Setup(r => r.AddPayment(dto)).ReturnsAsync([MakePaymentDto(1)]);

            var result = await _sut.AddPayment(dto);

            result.Success.Should().BeTrue();
            result.Data.Should().HaveCount(1);
            result.Data![0].Amount.Should().Be(1200);
        }

        [Fact]
        public async Task AddPayment_ReturnsFailure_WhenRepositoryThrows()
        {
            var dto = new AddPaymentDto { Amount = 1200, LeaseId = 1 };
            _repo.Setup(r => r.AddPayment(dto)).ThrowsAsync(new Exception("db error"));

            var result = await _sut.AddPayment(dto);

            result.Success.Should().BeFalse();
            result.Message.Should().NotBeNullOrEmpty();
        }

        // ── UpdatePayment ─────────────────────────────────────────────────────────

        [Fact]
        public async Task UpdatePayment_ReturnsSuccess_WhenPaymentExists()
        {
            var updateDto = new UpdatePaymentDto { Status = "Completed", Amount = 1200 };
            const long organizationId = 10;
            _repo.Setup(r => r.UpdatePayment(1, updateDto, organizationId)).ReturnsAsync(MakePaymentDto(1));

            // Seed the full Include chain: Payment→Lease→Unit→Property with matching org scope.
            _context.Properties.Add(new Models.Property { Id = 1, Name = "Test Property", OrganizationId = organizationId });
            _context.Units.Add(new Models.Unit { Id = 1, PropertyId = 1, Name = "Unit 1" });
            _context.Leases.Add(new Models.Lease { Id = 1, UnitId = 1 });
            _context.Payments.Add(new Models.Payment
            {
                Id = 1,
                Amount = 1200,
                Status = "Pending",
                LeaseId = 1,
                PaymentDate = DateTime.UtcNow,
                OrganizationId = organizationId
            });
            await _context.SaveChangesAsync();

            var result = await _sut.UpdatePayment(1, updateDto, organizationId);

            result.Success.Should().BeTrue();
        }

        [Fact]
        public async Task UpdatePayment_ReturnsFailure_WhenPaymentNotFound()
        {
            var updateDto = new UpdatePaymentDto { Status = "Completed" };

            var result = await _sut.UpdatePayment(999, updateDto, 0);

            result.Success.Should().BeFalse();
            result.Message.Should().Contain("not found");
        }

        [Fact]
        public async Task UpdatePayment_DoesNotCreateDuplicateLedgerEntry_WhenAlreadyCompleted()
        {
            var updateDto = new UpdatePaymentDto { Status = "Completed", Amount = 1200 };
            _repo.Setup(r => r.UpdatePayment(1, updateDto, It.IsAny<long>())).ReturnsAsync(MakePaymentDto(1, status: "Completed"));

            // Payment already in Completed state
            var paymentEntity = new Models.Payment
            {
                Id = 1,
                Amount = 1200,
                Status = "Completed",
                LeaseId = 1,
                PaymentDate = DateTime.UtcNow,
                OrganizationId = 10
            };
            _context.Payments.Add(paymentEntity);
            await _context.SaveChangesAsync();

            await _sut.UpdatePayment(1, updateDto, 10);

            // Ledger service should NOT be called when transitioning from Completed → Completed
            _ledger.Verify(
                l => l.CreateLedgerEntryAsync(
                    It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(),
                    It.IsAny<string>(), It.IsAny<decimal>(), It.IsAny<DateTime>(),
                    It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        // ── DeletePayment ─────────────────────────────────────────────────────────

        [Fact]
        public async Task DeletePayment_ReturnsSuccess_WhenDeleted()
        {
            _repo.Setup(r => r.DeletePayment(1, null)).ReturnsAsync(true);

            var result = await _sut.DeletePayment(1, null);

            result.Success.Should().BeTrue();
            result.Data.Should().BeTrue();
        }

        [Fact]
        public async Task DeletePayment_Returns403_WhenUnauthorized()
        {
            _repo.Setup(r => r.DeletePayment(1, 99L))
                 .ThrowsAsync(new UnauthorizedAccessException("Not allowed"));

            var result = await _sut.DeletePayment(1, 99L);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(403);
        }

        [Fact]
        public async Task DeletePayment_ReturnsFailure_WhenRepositoryThrows()
        {
            _repo.Setup(r => r.DeletePayment(1, null)).ThrowsAsync(new Exception("db error"));

            var result = await _sut.DeletePayment(1, null);

            result.Success.Should().BeFalse();
        }

        // ── GetPaymentsByLeaseId ──────────────────────────────────────────────────

        [Fact]
        public async Task GetPaymentsByLeaseId_ReturnsPaymentList()
        {
            _repo.Setup(r => r.GetPaymentsByLeaseId(1))
                 .ReturnsAsync([MakePaymentDto(1), MakePaymentDto(2, amount: 800m)]);

            var result = await _sut.GetPaymentsByLeaseId(1);

            result.Success.Should().BeTrue();
            result.Data.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetPaymentsByLeaseId_ReturnsFailure_OnException()
        {
            _repo.Setup(r => r.GetPaymentsByLeaseId(1)).ThrowsAsync(new Exception("db error"));

            var result = await _sut.GetPaymentsByLeaseId(1);

            result.Success.Should().BeFalse();
        }

        // ── GetAllPayments ────────────────────────────────────────────────────────

        [Fact]
        public async Task GetAllPayments_ReturnsFilteredByOrganization()
        {
            _repo.Setup(r => r.GetAllPaymentsByOrganizationId(10, null, null))
                 .ReturnsAsync([MakePaymentDto(1), MakePaymentDto(2)]);

            var result = await _sut.GetAllPayments(10);

            result.Success.Should().BeTrue();
            result.Data.Should().HaveCount(2);
        }

        [Fact]
        public async Task GetAllPayments_PassesOptionalFilters_ToRepository()
        {
            _repo.Setup(r => r.GetAllPaymentsByOrganizationId(10, 5L, 3L))
                 .ReturnsAsync([MakePaymentDto(1)]);

            var result = await _sut.GetAllPayments(10, propertyId: 5, unitId: 3);

            result.Success.Should().BeTrue();
            _repo.Verify(r => r.GetAllPaymentsByOrganizationId(10, 5L, 3L), Times.Once);
        }

        // ── GetPaymentHistoryByTenantId ───────────────────────────────────────────

        [Fact]
        public async Task GetPaymentHistoryByTenantId_Returns404_WhenTenantNotFound()
        {
            // No tenant seeded in context

            var result = await _sut.GetPaymentHistoryByTenantId(999, 10);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(404);
        }

        [Fact]
        public async Task GetPaymentHistoryByTenantId_Returns403_WhenTenantBelongsToDifferentOrg()
        {
            _context.Tenants.Add(new Models.Tenant
            {
                Id = 1,
                OrganizationId = 99,  // different org
                IsDeleted = false,
                Firstname = "John",
                Lastname = "Doe",
                Email = "john@test.com"
            });
            await _context.SaveChangesAsync();

            var result = await _sut.GetPaymentHistoryByTenantId(1, organizationId: 10);

            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(403);
        }

        [Fact]
        public async Task GetPaymentHistoryByTenantId_ReturnsHistory_WhenAuthorized()
        {
            _context.Tenants.Add(new Models.Tenant
            {
                Id = 1,
                OrganizationId = 10,
                IsDeleted = false,
                Firstname = "John",
                Lastname = "Doe",
                Email = "john@test.com"
            });
            await _context.SaveChangesAsync();

            _repo.Setup(r => r.GetPaymentHistoryByTenantId(1))
                 .ReturnsAsync([new TenantPaymentHistoryItemDto { LeaseId = 1, Amount = 1200 }]);

            var result = await _sut.GetPaymentHistoryByTenantId(1, organizationId: 10);

            result.Success.Should().BeTrue();
            result.Data.Should().HaveCount(1);
        }
    }
}
