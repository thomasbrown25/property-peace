using System.Text.Json;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
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
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public class LeaseAgreementOwnershipTests
{
    [Theory]
    [InlineData("rentAmount", "999")]
    [InlineData("startDate", "\"2027-01-01\"")]
    [InlineData("unitId", "999")]
    [InlineData("fees", "[]")]
    [InlineData("leaseCoSigners", "[]")]
    [InlineData("leaseAdditionalSigners", "[]")]
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
        var result = await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto
        {
            AdditionalTerms = "must not persist", IsPeopleOnLeaseComplete = true,
            LeaseLandlords = [new AgreementLandlordDto { FirstName = "Denied", LastName = "Owner" }]
        });
        var status = result is ForbidResult ? 403 : ((ObjectResult)result).StatusCode;
        status.Should().Be(expected);
        (await db.Leases.SingleAsync()).AdditionalTerms.Should().BeNull();
        (await db.LeaseAgreements.CountAsync()).Should().Be(0);
        (await db.LeaseLandlords.CountAsync()).Should().Be(0);
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

    [Fact]
    public async Task AgreementLandlordsReplaceOnlyAuthorizedLeaseAndPreserveOmittedOrNullLists()
    {
        await using var db = CreateContext();
        var lease = await SeedAsync(db);
        db.Leases.Add(new Lease { Id = 43, OrganizationId = 8 });
        db.LeaseLandlords.AddRange(
            new LeaseLandlord { LeaseId = 42, FirstName = "Old", LastName = "Owner" },
            new LeaseLandlord { LeaseId = 43, FirstName = "Other", LastName = "Owner" });
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        var dto = JsonSerializer.Deserialize<UpdateLeaseAgreementDto>("""
            {"leaseLandlords":[
                {"entityType":"Company","companyName":"Owner LLC","email":"owner@example.com",
                 "phone":"555-0100","streetAddress":"123 Main","unit":"2","city":"Austin",
                 "state":"TX","zipCode":"78701","sortOrder":1},
                {"entityType":"Individual","firstName":"Jane","lastName":"Owner","sortOrder":0}
            ],"isPeopleOnLeaseComplete":true}
            """, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        (await controller.UpdateLeaseAgreement(42, dto)).Should().BeOfType<OkObjectResult>();
        db.ChangeTracker.Clear();
        var landlords = await db.LeaseLandlords.Where(x => x.LeaseId == 42).OrderBy(x => x.SortOrder).ToListAsync();
        landlords.Should().HaveCount(2);
        landlords[0].FirstName.Should().Be("Jane");
        landlords[0].LastName.Should().Be("Owner");
        landlords[0].EntityType.Should().Be("Individual");
        landlords[1].Should().BeEquivalentTo(new {
            LeaseId = 42L, EntityType = "Company", CompanyName = "Owner LLC", Email = "owner@example.com",
            Phone = "555-0100", StreetAddress = "123 Main", Unit = "2", City = "Austin", State = "TX",
            ZipCode = "78701", SortOrder = 1 });
        var ids = landlords.Select(x => x.Id).ToArray();
        (await db.LeaseAgreements.SingleAsync()).IsPeopleOnLeaseComplete.Should().BeTrue();
        (await db.Leases.SingleAsync(x => x.Id == 42)).RentAmount.Should().Be(lease.RentAmount);

        await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto { AdditionalTerms = "Other section" });
        await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto { LeaseLandlords = null, IsPeopleOnLeaseComplete = false });
        (await db.LeaseLandlords.Where(x => x.LeaseId == 42).Select(x => x.Id).ToListAsync()).Should().BeEquivalentTo(ids);
        (await db.LeaseAgreements.SingleAsync()).IsPeopleOnLeaseComplete.Should().BeTrue();

        await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto { LeaseLandlords = [] });
        (await db.LeaseLandlords.Where(x => x.LeaseId == 42).CountAsync()).Should().Be(0);
        (await db.LeaseLandlords.SingleAsync()).FirstName.Should().Be("Other");
    }

    [Theory]
    [InlineData("finalized")]
    [InlineData("landlordSigned")]
    [InlineData("signatureCompleted")]
    [InlineData("envelope")]
    [InlineData("completed")]
    public async Task AgreementLandlordWriteRetainsEverySignatureProtection(string protection)
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var agreement = new LeaseAgreement { LeaseId = 42 };
        if (protection == "landlordSigned") agreement.LandlordSignedAt = DateTime.UtcNow;
        if (protection == "signatureCompleted") agreement.SignatureCompletedAt = DateTime.UtcNow;
        if (protection == "envelope") agreement.DocuSignEnvelopeId = "existing-envelope";
        if (protection == "completed") agreement.SignatureStatus = ESignatureStatus.Completed;
        if (protection == "finalized") db.LeaseInstances.Add(new LeaseInstance { LeaseId = 42, IsFinalized = true, TemplateVersion = "1" });
        db.LeaseAgreements.Add(agreement);
        db.LeaseLandlords.Add(new LeaseLandlord { LeaseId = 42, FirstName = "Saved", LastName = "Owner" });
        await db.SaveChangesAsync();

        var result = await CreateController(db).UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto
        {
            LeaseLandlords = [], IsPeopleOnLeaseComplete = true
        });
        result.Should().BeOfType<ConflictObjectResult>();
        (await db.LeaseLandlords.SingleAsync()).FirstName.Should().Be("Saved");
        (await db.LeaseAgreements.SingleAsync()).IsPeopleOnLeaseComplete.Should().BeFalse();
    }

    [Theory]
    [InlineData("{\"entityType\":\"Individual\",\"firstName\":\"Jane\",\"lastName\":\"Owner\",\"email\":\"jane@example.com\"}", true)]
    [InlineData("{\"entityType\":\"Company\",\"companyName\":\"Owner LLC\"}", true)]
    [InlineData("{\"entityType\":\"Other\"}", false)]
    [InlineData("{\"entityType\":null}", false)]
    [InlineData("{\"firstName\":\" \",\"lastName\":\"Owner\"}", false)]
    [InlineData("{\"firstName\":\"Jane\"}", false)]
    [InlineData("{\"entityType\":\"Company\",\"companyName\":\" \"}", false)]
    [InlineData("{\"firstName\":\"Jane\",\"lastName\":\"Owner\",\"email\":\"invalid\"}", false)]
    [InlineData("null", false)]
    public void AgreementLandlordsUseNestedMvcValidation(string landlord, bool valid)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers();
        using var provider = services.BuildServiceProvider();
        var action = new ActionContext { HttpContext = new DefaultHttpContext { RequestServices = provider } };
        var dto = JsonSerializer.Deserialize<UpdateLeaseAgreementDto>($"{{\"leaseLandlords\":[{landlord}]}}",
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        provider.GetRequiredService<IObjectModelValidator>().Validate(action, null, "", dto);
        action.ModelState.IsValid.Should().Be(valid);
    }

    [Theory]
    [InlineData("id")]
    [InlineData("leaseId")]
    [InlineData("organizationId")]
    public void AgreementLandlordsRejectClientIdentityAndOwnership(string field)
    {
        var json = $"{{\"leaseLandlords\":[{{\"{field}\":999}}]}}";
        Action deserialize = () => JsonSerializer.Deserialize<UpdateLeaseAgreementDto>(json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        deserialize.Should().Throw<JsonException>();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FirstLandlordSaveIsDurableResumableDraftWithoutGeneratingOrCompletingDocument(bool hasLegacyAgreement)
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        long agreementId;
        await using (var db = new DataContext(options))
        {
            await SeedAsync(db);
            // A completed lease setup is not a completed agreement document.
            if (hasLegacyAgreement)
            {
                db.LeaseAgreements.Add(new LeaseAgreement { LeaseId = 42, IsDrafted = false });
                await db.SaveChangesAsync();
            }
            var result = await CreateController(db).UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto
            {
                LeaseLandlords = [new AgreementLandlordDto { FirstName = "Jane", LastName = "Owner" }],
                IsPeopleOnLeaseComplete = true
            });
            var progress = ReadProgress(result);
            agreementId = progress.Id;
            progress.IsDraft.Should().BeTrue();
            progress.CanResume.Should().BeTrue();
            progress.IsFinalized.Should().BeFalse();
            progress.IsPeopleOnLeaseComplete.Should().BeTrue();
            progress.IsPetsSmokingOtherComplete.Should().BeFalse();
            progress.IsUtilitiesMaintenanceKeysComplete.Should().BeFalse();
            progress.IsProvisionsAttachmentsComplete.Should().BeFalse();
            progress.IsDrafted.Should().BeFalse();
        }

        // A fresh context/controller models leaving the builder and returning later.
        await using (var db = new DataContext(options))
        {
            var controller = CreateController(db);
            var reloaded = ReadProgress(await controller.GetLeaseAgreementProgress(42));
            reloaded.Id.Should().Be(agreementId);
            reloaded.CanResume.Should().BeTrue();
            reloaded.IsPeopleOnLeaseComplete.Should().BeTrue();
            (await db.LeaseLandlords.SingleAsync()).FirstName.Should().Be("Jane");
            (await db.Leases.SingleAsync()).RentAmount.Should().Be(1500);
            (await db.Leases.SingleAsync()).IsActive.Should().BeFalse();
            (await db.LeaseInstances.CountAsync()).Should().Be(0);

            await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto
            {
                PetsAllowed = false, IsPetsSmokingOtherComplete = true, IsPeopleOnLeaseComplete = false
            });
            var resumed = ReadProgress(await controller.GetLeaseAgreementProgress(42));
            resumed.Id.Should().Be(agreementId);
            resumed.IsPeopleOnLeaseComplete.Should().BeTrue();
            resumed.IsPetsSmokingOtherComplete.Should().BeTrue();
            resumed.IsDraft.Should().BeTrue();
            (await db.LeaseAgreements.CountAsync()).Should().Be(1);
            (await db.LeaseLandlords.SingleAsync()).FirstName.Should().Be("Jane");
            (await db.LeaseInstances.CountAsync()).Should().Be(0);
        }
    }

    [Fact]
    public async Task CompletedSupplementalSectionsAndPreviewInstanceAreStillResumableUntilFinalized()
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        db.LeaseInstances.Add(new LeaseInstance { LeaseId = 42, IsFinalized = false, TemplateVersion = "1" });
        await db.SaveChangesAsync();
        var controller = CreateController(db);
        var progress = ReadProgress(await controller.UpdateLeaseAgreement(42, new UpdateLeaseAgreementDto
        {
            IsPeopleOnLeaseComplete = true, IsPetsSmokingOtherComplete = true,
            IsUtilitiesMaintenanceKeysComplete = true, IsProvisionsAttachmentsComplete = true
        }));
        progress.IsDraft.Should().BeTrue();
        progress.CanResume.Should().BeTrue();
        (await db.LeaseInstances.SingleAsync()).IsFinalized.Should().BeFalse();
        db.ChangeTracker.Clear();
        ReadProgress(await controller.GetLeaseAgreementProgress(42)).CanResume.Should().BeTrue();
    }

    [Theory]
    [InlineData("finalized")]
    [InlineData("landlordSigned")]
    [InlineData("signatureCompleted")]
    [InlineData("envelope")]
    [InlineData("completed")]
    public async Task ReloadedProtectedAgreementIsNotResumableDraft(string protection)
    {
        await using var db = CreateContext();
        await SeedAsync(db);
        var agreement = new LeaseAgreement { LeaseId = 42, IsDrafted = false, IsPeopleOnLeaseComplete = true };
        if (protection == "landlordSigned") agreement.LandlordSignedAt = DateTime.UtcNow;
        if (protection == "signatureCompleted") agreement.SignatureCompletedAt = DateTime.UtcNow;
        if (protection == "envelope") agreement.DocuSignEnvelopeId = "existing-envelope";
        if (protection == "completed") agreement.SignatureStatus = ESignatureStatus.Completed;
        if (protection == "finalized") db.LeaseInstances.Add(new LeaseInstance { LeaseId = 42, IsFinalized = true, TemplateVersion = "1" });
        db.LeaseAgreements.Add(agreement);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var progress = ReadProgress(await CreateController(db).GetLeaseAgreementProgress(42));
        progress.IsDraft.Should().BeFalse();
        progress.CanResume.Should().BeFalse();
        progress.IsFinalized.Should().Be(protection == "finalized");
    }

    [Theory]
    [InlineData("notStarted", 404)]
    [InlineData("otherOrganization", 404)]
    [InlineData("deleted", 404)]
    [InlineData("viewer", 403)]
    public async Task AgreementProgressDoesNotCreateDraftOrExposeUnauthorizedLease(string scenario, int expected)
    {
        await using var db = CreateContext();
        var lease = await SeedAsync(db);
        if (scenario == "otherOrganization") lease.OrganizationId = 8;
        if (scenario == "deleted") lease.IsDeleted = true;
        if (scenario == "viewer") (await db.OrganizationMembers.SingleAsync()).Role = "Viewer";
        if (scenario != "notStarted") db.LeaseAgreements.Add(new LeaseAgreement { LeaseId = 42 });
        await db.SaveChangesAsync();
        var count = await db.LeaseAgreements.CountAsync();
        var result = await CreateController(db).GetLeaseAgreementProgress(42);
        (result is ForbidResult ? 403 : ((ObjectResult)result).StatusCode).Should().Be(expected);
        (await db.LeaseAgreements.CountAsync()).Should().Be(count);
        (await db.LeaseInstances.CountAsync()).Should().Be(0);
    }

    private static LeaseAgreementProgressDto ReadProgress(IActionResult result)
    {
        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        using var json = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));
        json.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();
        return json.RootElement.GetProperty("data").Deserialize<LeaseAgreementProgressDto>()!;
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
