using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Leads;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Leads;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leads;

public sealed class MilestoneTwoSecurityRegressionTests
{
    [Fact]
    public async Task Inquiry_returns_only_opaque_receipt_and_delivers_a_purpose_bound_verification_secret()
    {
        await using var db = Db(nameof(Inquiry_returns_only_opaque_receipt_and_delivers_a_purpose_bound_verification_secret));
        Seed(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = new LeadService(db, new PermitAllLeadAbuseGuard(), TimeProvider.System, delivery);

        var result = await service.SubmitInquiryAsync(10,
            new("Ada", "ada@example.com", null, LeadSourceKind.Direct, "key", new()), "ip", default);

        result.Receipt.Should().NotBeNullOrWhiteSpace();
        typeof(PublicInquiryResult).GetProperties().Select(x => x.Name)
            .Should().NotContain(new[] { "LeadId", "VerificationToken", "PublicAccessToken" });
        delivery.Messages.Should().ContainSingle(x => x.Purpose == LeadTokenPurpose.ContactVerification);
        var lead = db.Leads.Single();
        lead.PublicAccessTokenHash.Should().BeNull();
        lead.VerificationTokenHash.Should().NotBe(delivery.Messages.Single().Token);
    }

    [Fact]
    public async Task Verification_is_single_use_and_only_then_delivers_a_distinct_management_secret()
    {
        await using var db = Db(nameof(Verification_is_single_use_and_only_then_delivers_a_distinct_management_secret));
        Seed(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = new LeadService(db, new PermitAllLeadAbuseGuard(), TimeProvider.System, delivery);
        await service.SubmitInquiryAsync(10,
            new("Ada", "ada@example.com", null, LeadSourceKind.Direct, "key", new()), "ip", default);
        var verification = delivery.Messages.Single().Token;

        (await service.VerifyContactAsync(verification, "ip", default, 10)).Should().Be(db.Leads.Single().Id);
        (await service.VerifyContactAsync(verification, "ip", default, 10)).Should().BeNull();

        var management = delivery.Messages.Single(x => x.Purpose == LeadTokenPurpose.PublicManagement);
        management.Token.Should().NotBe(verification);
        db.Leads.Single().PublicAccessTokenHash.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Verified_duplicate_inquiry_does_not_rotate_or_reissue_any_secret()
    {
        await using var db = Db(nameof(Verified_duplicate_inquiry_does_not_rotate_or_reissue_any_secret));
        Seed(db);
        await db.SaveChangesAsync();
        var delivery = new FakeLeadTokenDelivery();
        var service = new LeadService(db, new PermitAllLeadAbuseGuard(), TimeProvider.System, delivery);
        await service.SubmitInquiryAsync(10,
            new("Ada", "ada@example.com", null, LeadSourceKind.Direct, "one", new()), "ip", default);
        var verification = delivery.Messages.Single().Token;
        await service.VerifyContactAsync(verification, "ip", default, 10);
        var originalHash = db.Leads.Single().PublicAccessTokenHash;
        var delivered = delivery.Messages.Count;

        await service.SubmitInquiryAsync(10,
            new("Ada", "ada@example.com", null, LeadSourceKind.Referral, "two", new()), "ip", default);

        db.Leads.Single().PublicAccessTokenHash.Should().Be(originalHash);
        delivery.Messages.Should().HaveCount(delivered);
    }

    [Fact]
    public async Task Idempotency_key_reuse_with_different_normalized_payload_conflicts()
    {
        await using var db = Db(nameof(Idempotency_key_reuse_with_different_normalized_payload_conflicts));
        Seed(db);
        await db.SaveChangesAsync();
        var service = new LeadService(db, new PermitAllLeadAbuseGuard(), TimeProvider.System, new FakeLeadTokenDelivery());
        await service.SubmitInquiryAsync(10,
            new("Ada", "ada@example.com", null, LeadSourceKind.Direct, "same", new()), "ip", default);

        await service.Invoking(x => x.SubmitInquiryAsync(10,
                new("Grace", "grace@example.com", null, LeadSourceKind.Direct, "same", new()), "ip", default))
            .Should().ThrowAsync<LeadConflictException>();
    }

    [Fact]
    public async Task Every_landlord_operation_revalidates_active_membership()
    {
        await using var db = Db(nameof(Every_landlord_operation_revalidates_active_membership));
        Seed(db);
        db.Users.Add(new User { Id = 100, Email = "inactive@example.com", FirstName = "I", LastName = "N", PasswordHash = [1], PasswordSalt = [1] });
        db.OrganizationMembers.Add(new OrganizationMember { OrganizationId = 1, UserId = 100, Role = "Manager", IsActive = false });
        await db.SaveChangesAsync();
        var service = new LeadService(db, new PermitAllLeadAbuseGuard(), TimeProvider.System, new FakeLeadTokenDelivery());

        await service.Invoking(x => x.GetPipelineAsync(1, 100, new(null, null, null, null, null), default))
            .Should().ThrowAsync<LeadForbiddenException>();
    }

    [Fact]
    public void Model_enforces_distinct_secrets_payload_idempotency_and_unique_conversion()
    {
        using var db = Db(nameof(Model_enforces_distinct_secrets_payload_idempotency_and_unique_conversion));
        var lead = db.Model.FindEntityType(typeof(Lead))!;
        lead.FindProperty(nameof(Lead.PublicAccessTokenHash))!.IsNullable.Should().BeTrue();
        lead.GetIndexes().Should().Contain(x => x.IsUnique && x.Properties.Single().Name == nameof(Lead.RentalApplicationId));
        var source = db.Model.FindEntityType(typeof(LeadSource))!;
        source.FindProperty(nameof(LeadSource.RequestHash)).Should().NotBeNull();
        db.Model.FindEntityType(typeof(LeadTokenDelivery))!.FindProperty(nameof(LeadTokenDelivery.ProtectedPayload)).Should().NotBeNull();
    }

    [Fact]
    public async Task Availability_rejects_past_and_overlap_and_requires_unambiguous_utc_boundary()
    {
        await using var db = Db(nameof(Availability_rejects_past_and_overlap_and_requires_unambiguous_utc_boundary));
        Seed(db);
        await db.SaveChangesAsync();
        var service = new LeadService(db, new PermitAllLeadAbuseGuard(), TimeProvider.System, new FakeLeadTokenDelivery());

        await service.Invoking(x => x.AddAvailabilityAsync(1, 99, 10,
                DateTimeOffset.UtcNow.AddHours(-2), DateTimeOffset.UtcNow.AddHours(-1), "UTC", default))
            .Should().ThrowAsync<LeadValidationException>();
        await service.Invoking(x => x.GetAvailableSlotsAsync(10, DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified), default))
            .Should().ThrowAsync<LeadValidationException>();
    }

    private static DataContext Db(string name) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(name).Options);

    private static void Seed(DataContext db)
    {
        db.Organizations.Add(new Organization { Id = 1, Name = "Org", OwnerId = 99 });
        db.Users.Add(new User { Id = 99, Email = "owner@example.com", FirstName = "O", LastName = "W", PasswordHash = [1], PasswordSalt = [1] });
        db.Properties.Add(new Property { Id = 20, Name = "P", StreetAddress = "1 Main", City = "X", State = "NY", ZipCode = "10001", LandlordId = 99, OrganizationId = 1 });
        db.Units.Add(new Unit { Id = 30, PropertyId = 20, Name = "1", OrganizationId = 1 });
        db.Listings.Add(new Listing { Id = 10, PropertyId = 20, UnitId = 30, OrganizationId = 1,
            CreatedBy = 99, Status = EListingStatus.Active, CreatedAt = DateTime.UtcNow });
    }
}
