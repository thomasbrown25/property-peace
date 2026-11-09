using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseAgreement;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public class LeaseAgreementOwnershipTests
{
    [Theory]
    [InlineData("rentAmount", "999")]
    [InlineData("startDate", "\"2027-01-01\"")]
    [InlineData("unitId", "999")]
    [InlineData("fees", "[]")]
    [InlineData("leaseLandlords", "[]")]
    [InlineData("leaseOccupants", "[]")]
    [InlineData("tenantIds", "[999]")]
    public void AgreementWriteRejectsLeaseOwnedFields(string name, string value)
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var json = $"{{\"{name}\":{value}}}";
        Action deserialize = () => JsonSerializer.Deserialize<UpdateLeaseAgreementDto>(json, options);
        deserialize.Should().Throw<JsonException>();
    }

    [Theory]
    [InlineData("monthlyRent", "999")]
    [InlineData("securityDeposit", "999")]
    [InlineData("propertyId", "999")]
    [InlineData("unitId", "999")]
    [InlineData("tenantIds", "[999]")]
    [InlineData("startDate", "\"2027-01-01\"")]
    [InlineData("clauseSettings", "{\"lateFee\":{\"amount\":999}}")]
    public void GenerationRejectsLeaseOverrides(string name, string value)
    {
        var json = $"{{\"leaseId\":42,\"leaseTemplateId\":3,\"{name}\":{value}}}";
        Action deserialize = () => JsonSerializer.Deserialize<CreateLeaseInstanceDto>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        deserialize.Should().Throw<JsonException>();
    }

    [Fact]
    public async Task AgreementUpsertPersistsSupplementalOnlyAndScopesChildOwnership()
    {
        await using var db = CreateContext();
        var lease = await SeedAsync(db);
        var controller = CreateController(db);
        var before = JsonSerializer.Serialize(new { lease.UnitId, lease.StartDate, lease.EndDate,
            lease.RentAmount, lease.DepositAmount, lease.IsActive, lease.OrganizationId });
        var result = await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto
        {
            AdditionalTerms = "Quiet hours after 10pm", PetsAllowed = false,
            IsPetsSmokingOtherComplete = true,
            LeaseKeys = [new LeaseKeyDto { Id = 999, LeaseId = 999, OrganizationId = 999, KeyType = "Door", Copies = 2 }],
            Pets = [new PetDto { Id = 999, LeaseId = 999, OrganizationId = 999, Type = "Cat" }]
        });
        result.Should().BeOfType<OkObjectResult>();
        db.ChangeTracker.Clear();
        var saved = await db.Leases.Include(x => x.LeaseAgreement).SingleAsync();
        JsonSerializer.Serialize(new { saved.UnitId, saved.StartDate, saved.EndDate,
            saved.RentAmount, saved.DepositAmount, saved.IsActive, saved.OrganizationId }).Should().Be(before);
        saved.AdditionalTerms.Should().Be("Quiet hours after 10pm");
        saved.PetsAllowed.Should().BeFalse();
        saved.LeaseAgreement!.IsPetsSmokingOtherComplete.Should().BeTrue();
        saved.LeaseAgreement.IsDrafted.Should().BeFalse();
        var key = await db.LeaseKeys.SingleAsync();
        key.LeaseId.Should().Be(42); key.OrganizationId.Should().Be(7); key.Id.Should().NotBe(999);
        (await db.Pets.SingleAsync()).LeaseId.Should().Be(42);

        await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto { AdditionalTerms = "", Pets = [], IsPetsSmokingOtherComplete = false });
        (await db.Pets.CountAsync()).Should().Be(0);
        (await db.LeaseKeys.CountAsync()).Should().Be(1); // omitted collection is preserved
        (await db.Leases.SingleAsync()).AdditionalTerms.Should().BeEmpty();
        (await db.LeaseAgreements.SingleAsync()).IsPetsSmokingOtherComplete.Should().BeTrue();
    }

    [Theory]
    [InlineData(8, true, false, 404)]
    [InlineData(7, false, false, 403)]
    [InlineData(7, true, true, 409)]
    public async Task AgreementWriteRejectsWrongOrganizationUnauthorizedAndFinalized(long organizationId, bool allowed, bool finalized, int expected)
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        if (!allowed) (await db.OrganizationMembers.SingleAsync()).Role = "Viewer";
        if (organizationId != 7)
            db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = organizationId, UserId = 5, Role = "Owner", IsActive = true });
        if (finalized) db.LeaseInstances.Add(new LeaseInstance { LeaseId = 42, IsFinalized = true, TemplateVersion = "1" });
        await db.SaveChangesAsync();
        var controller = CreateController(db, organizationId);
        var result = await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto { AdditionalTerms = "must not persist" });
        var status = result is ForbidResult ? 403 : ((ObjectResult)result).StatusCode;
        status.Should().Be(expected);
        (await db.Leases.SingleAsync()).AdditionalTerms.Should().BeNull();
        (await db.LeaseAgreements.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task StandaloneLeaseCreationPersistsAllPeopleWithoutCreatingAgreement()
    {
        await using var db = CreateContext();
        db.Units.Add(new Unit { Id = 9, Property = new Property { Id = 8, OrganizationId = 7 } });
        await db.SaveChangesAsync();
        var repository = new brownstone_hub_api.Repositories.Leases.LeaseRepository(db,
            NullLogger<brownstone_hub_api.Repositories.Leases.LeaseRepository>.Instance,
            brownstone_hub_api.Tests.Helpers.MapperFactory.Create());
        var created = await repository.AddLease(new UpdateLeaseDto
        {
            UnitId = 9, PropertyId = 8, StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 12, 31),
            RentAmount = 1500, DepositAmount = 500,
            LeaseLandlords = [new LeaseLandlordDto { Id = 999, FirstName = "Owner", LastName = "Saved" }],
            LeaseCoSigners = [new LeaseCoSignerDto { FirstName = "Co", LastName = "Signer" }],
            LeaseAdditionalSigners = [new LeaseAdditionalSignerDto { FirstName = "Extra", LastName = "Signer" }],
            LeaseOccupants = [new LeaseOccupantDto { FirstName = "Saved", LastName = "Occupant" }],
            Fees = [new LeaseFeeDto { Name = "Fee", Amount = 50 }],
            LeaseDeposits = [new LeaseDepositDto { Name = "Key deposit", Amount = 25 }]
        }, 7);
        created.Id.Should().BePositive();
        (await db.LeaseLandlords.SingleAsync()).LeaseId.Should().Be(created.Id);
        (await db.LeaseCoSigners.SingleAsync()).LeaseId.Should().Be(created.Id);
        (await db.LeaseAdditionalSigners.SingleAsync()).LeaseId.Should().Be(created.Id);
        (await db.LeaseOccupants.SingleAsync()).LeaseId.Should().Be(created.Id);
        (await db.LeaseFees.SingleAsync()).Amount.Should().Be(50);
        (await db.LeaseDeposits.SingleAsync()).Amount.Should().Be(25);
        (await db.LeaseAgreements.CountAsync()).Should().Be(0);
    }

    private static DataContext CreateContext() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static async Task<Lease> SeedAsync(DataContext db)
    {
        db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 7, UserId = 5, Role = "Owner", IsActive = true });
        var lease = new Lease { Id = 42, Unit = new Unit { Id = 9, Property = new Property { Id = 8, OrganizationId = 7 } },
            OrganizationId = 7, IsActive = false, StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 12, 31),
            RentAmount = 1500, DepositAmount = 500 };
        db.Leases.Add(lease);
        await db.SaveChangesAsync();
        return lease;
    }

    private static LeaseController CreateController(DataContext db, long organizationId = 7)
    {
        var controller = new LeaseController(null!, null!, null!, null!, null!, null!, db, null!, null!,
            NullLogger<LeaseController>.Instance, new ConfigurationBuilder().Build());
        var http = new DefaultHttpContext();
        http.Items["UserId"] = 5L; http.Items["OrganizationId"] = organizationId;
        controller.ControllerContext = new ControllerContext { HttpContext = http };
        return controller;
    }
}
