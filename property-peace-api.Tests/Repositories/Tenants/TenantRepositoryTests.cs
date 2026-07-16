using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Tenants
{
    public class TenantRepositoryTests : IDisposable
    {
        private readonly DataContext _context;
        private readonly TenantRepository _repo;

        public TenantRepositoryTests()
        {
            _context = DbContextFactory.Create();
            _repo = new TenantRepository(_context, MapperFactory.Create());
        }

        public void Dispose() => _context.Dispose();

        [Fact]
        public async Task DeleteTenant_SoftDeletesTenantAndPreservesAccountAndLeaseAccess()
        {
            var user = new User
            {
                Id = 100,
                FirstName = "Terry",
                LastName = "Tenant",
                Email = "tenant@example.com",
                PasswordHash = [1, 2, 3],
            };
            var tenant = new Tenant
            {
                Id = 200,
                Firstname = "Terry",
                Lastname = "Tenant",
                Email = "tenant@example.com",
                PhoneNumber = "555-0100",
                UserId = user.Id,
                OrganizationId = 10,
                UnitId = 300,
            };
            var lease = new Lease
            {
                Id = 400,
                UnitId = 300,
                OrganizationId = 10,
            };

            _context.Users.Add(user);
            _context.Tenants.Add(tenant);
            _context.Leases.Add(lease);
            _context.TenantLeases.Add(new TenantLease
            {
                TenantId = tenant.Id,
                LeaseId = lease.Id,
            });
            await _context.SaveChangesAsync();

            var deleted = await _repo.DeleteTenant(tenant.Id);

            deleted.Should().NotBeNull();

            var tenantInDb = await _context.Tenants.FindAsync(tenant.Id);
            tenantInDb.Should().NotBeNull();
            tenantInDb!.IsDeleted.Should().BeTrue();
            tenantInDb.DeletedAt.Should().NotBeNull();
            tenantInDb.UserId.Should().Be(user.Id);
            tenantInDb.Email.Should().Be("tenant@example.com");
            tenantInDb.PhoneNumber.Should().Be("555-0100");

            (await _context.Users.FindAsync(user.Id)).Should().NotBeNull();
            _context.TenantLeases.Should().ContainSingle(tl => tl.TenantId == tenant.Id && tl.LeaseId == lease.Id);

            var leaseIds = await _repo.GetLeasesByTenantUserId(user.Id);
            leaseIds.Should().ContainSingle().Which.Should().Be(lease.Id);
        }

        [Fact]
        public async Task GetAllTenantsByOrganizationId_ExcludesSoftDeletedTenantsFromLandlordPortfolio()
        {
            _context.Tenants.AddRange(
                new Tenant
                {
                    Id = 1,
                    Firstname = "Active",
                    Lastname = "Tenant",
                    Email = "active@example.com",
                    OrganizationId = 10,
                },
                new Tenant
                {
                    Id = 2,
                    Firstname = "Deleted",
                    Lastname = "Tenant",
                    Email = "deleted@example.com",
                    OrganizationId = 10,
                    IsDeleted = true,
                    DeletedAt = DateTime.Now,
                }
            );
            await _context.SaveChangesAsync();

            var tenants = await _repo.GetAllTenantsByOrganizationId(10);

            tenants.Should().ContainSingle();
            tenants.Single().Id.Should().Be(1);
        }
    }
}
