using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeConnectPreparationServiceTests
{
    [Fact]
    public async Task SaveAsync_PersistsOnlyOrganizationScopedProperties_AndCanBeResumed()
    {
        await using var db = CreateContext();
        db.Properties.AddRange(
            new Property { Id = 11, OrganizationId = 77, LandlordId = 42 },
            new Property { Id = 12, OrganizationId = 77, LandlordId = 42 },
            new Property { Id = 99, OrganizationId = 88, LandlordId = 42 });
        await db.SaveChangesAsync();
        var service = new StripeConnectPreparationService(db);

        var saved = await service.SaveAsync(42, 77, new SaveStripeConnectPreparationRequest(
            "business", "Morgan Rentals", [11, 12], "property-manager", true), default);
        var resumed = await service.GetAsync(42, 77, default);

        saved.UserId.Should().Be(42);
        saved.OrganizationId.Should().Be(77);
        saved.PropertyIds.Should().Equal(11, 12);
        saved.AuthorityAttestedAt.Should().NotBeNull();
        saved.CreatedAt.Should().NotBe(default);
        saved.UpdatedAt.Should().NotBe(default);
        resumed.Should().BeEquivalentTo(saved);
    }

    [Fact]
    public async Task SaveAsync_WhenAPropertyBelongsToAnotherOrganization_RejectsTheWholeRequest()
    {
        await using var db = CreateContext();
        db.Properties.AddRange(
            new Property { Id = 11, OrganizationId = 77, LandlordId = 42 },
            new Property { Id = 99, OrganizationId = 88, LandlordId = 42 });
        await db.SaveChangesAsync();
        var service = new StripeConnectPreparationService(db);

        var save = () => service.SaveAsync(42, 77, new SaveStripeConnectPreparationRequest(
            "individual", "Taylor Morgan", [11, 99], "owner", true), default);

        await save.Should().ThrowAsync<UnauthorizedAccessException>();
        db.StripeConnectPreparations.Should().BeEmpty();
    }

    [Theory]
    [InlineData("trust", "Taylor Morgan", "owner")]
    [InlineData("individual", "Taylor Morgan", "friend")]
    [InlineData("individual", "123-45-6789", "owner")]
    [InlineData("individual", "123 45 6789", "owner")]
    [InlineData("individual", "12-3456789", "owner")]
    [InlineData("individual", "1234 5678 9012", "owner")]
    [InlineData("individual", "bank account # 12345678", "owner")]
    [InlineData("individual", "123456789012", "owner")]
    public async Task SaveAsync_WhenContextIsNotAllowlistedOrLooksSensitive_RejectsIt(
        string operatingType, string displayName, string authorityRelationship)
    {
        await using var db = CreateContext();
        db.Properties.Add(new Property { Id = 11, OrganizationId = 77, LandlordId = 42 });
        await db.SaveChangesAsync();
        var service = new StripeConnectPreparationService(db);

        var save = () => service.SaveAsync(42, 77, new SaveStripeConnectPreparationRequest(
            operatingType, displayName, [11], authorityRelationship, true), default);

        await save.Should().ThrowAsync<ArgumentException>();
        db.StripeConnectPreparations.Should().BeEmpty();
    }

    [Fact]
    public async Task GetValidatedForHandoffAsync_WhenSavedPropertyIsNoLongerInScope_RejectsTheDraft()
    {
        await using var db = CreateContext();
        var property = new Property { Id = 11, OrganizationId = 77, LandlordId = 42 };
        db.Properties.Add(property);
        await db.SaveChangesAsync();
        var service = new StripeConnectPreparationService(db);
        await service.SaveAsync(42, 77, new SaveStripeConnectPreparationRequest(
            "individual", "Taylor Morgan", [11], "owner", true), default);
        property.IsDeleted = true;
        await db.SaveChangesAsync();

        var validate = () => service.GetValidatedForHandoffAsync(42, 77, default);

        await validate.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task SaveAsync_UpsertsTheCurrentUserAndOrganizationDraft()
    {
        await using var db = CreateContext();
        db.Properties.AddRange(
            new Property { Id = 11, OrganizationId = 77, LandlordId = 42 },
            new Property { Id = 12, OrganizationId = 77, LandlordId = 42 });
        await db.SaveChangesAsync();
        var service = new StripeConnectPreparationService(db);

        var first = await service.SaveAsync(42, 77, new SaveStripeConnectPreparationRequest(
            "individual", "Taylor Morgan", [11], "owner", true), default);
        var unchangedScope = await service.SaveAsync(42, 77, new SaveStripeConnectPreparationRequest(
            "individual", "Taylor M. Morgan", [11], "owner", true), default);
        var second = await service.SaveAsync(42, 77, new SaveStripeConnectPreparationRequest(
            "business", "Morgan Rentals", [12], "property-manager", true), default);

        unchangedScope.AuthorityAttestedAt.Should().Be(first.AuthorityAttestedAt);
        second.Id.Should().Be(first.Id);
        second.CreatedAt.Should().Be(first.CreatedAt);
        second.DisplayName.Should().Be("Morgan Rentals");
        second.PropertyIds.Should().Equal(12);
        db.StripeConnectPreparations.Should().ContainSingle();
    }

    private static DataContext CreateContext() => new(
        new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"stripe-connect-preparation-{Guid.NewGuid()}")
            .Options);
}
