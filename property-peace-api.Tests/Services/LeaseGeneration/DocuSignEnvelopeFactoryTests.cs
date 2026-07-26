using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Services.ESignatureService;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.LeaseGeneration;

public class DocuSignEnvelopeFactoryTests
{
    [Fact]
    public void Create_UsesDocumentAnchorsAndUniqueTenantTabs()
    {
        var request = new SendLeaseForSignatureDto
        {
            LandlordEmail = "owner@example.com",
            LandlordName = "Owner",
            TenantSigners =
            [
                new() { TenantId = 303, Email = "third@example.com", Name = "Third", SigningOrder = 3 },
                new() { TenantId = 101, Email = "first@example.com", Name = "First", SigningOrder = 1 },
                new() { TenantId = 202, Email = "second@example.com", Name = "Second", SigningOrder = 2 }
            ]
        };

        var envelope = DocuSignEnvelopeFactory.Create(request, [1, 2, 3], "lease.pdf");
        var signers = envelope.Recipients.Signers;

        signers.Should().HaveCount(4);
        signers.Select(x => x.RecipientId).Should().OnlyHaveUniqueItems();
        signers[0].Tabs.SignHereTabs.Single().AnchorString.Should().Be(LeaseSignatureAnchors.Landlord);
        signers[0].Tabs.DateSignedTabs.Single().AnchorString.Should().Be(LeaseSignatureAnchors.Landlord);

        var tenants = signers.Skip(1).ToList();
        tenants.Select(x => x.Tabs.SignHereTabs.Single().AnchorString)
            .Should().Equal("Tenant Signature 303", "Tenant Signature 101", "Tenant Signature 202");
        tenants.Select(x => x.Tabs.DateSignedTabs.Single().AnchorString)
            .Should().Equal("Tenant Signature 303", "Tenant Signature 101", "Tenant Signature 202");
        tenants.Select(x => x.Tabs.SignHereTabs.Single().AnchorYOffset)
            .Should().OnlyContain(x => x == "16");
        tenants.Select(x => x.Tabs.DateSignedTabs.Single().AnchorYOffset)
            .Should().OnlyContain(x => x == "16");

        foreach (var tenant in tenants)
        {
            tenant.Tabs.SignHereTabs.Single().AnchorYOffset
                .Should().Be(tenant.Tabs.DateSignedTabs.Single().AnchorYOffset);
        }

        signers.SelectMany(x => x.Tabs.SignHereTabs.Select(t => t.TabLabel)
                .Concat(x.Tabs.DateSignedTabs.Select(t => t.TabLabel)))
            .Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void SignatureLayout_ProducesOneStableUniqueAnchorPerTenant()
    {
        var slots = LeaseSignatureLayout.ForTenantIds([40, 10, 30, 20]);

        slots.Select(x => x.TenantId).Should().Equal(10, 20, 30, 40);
        slots.Select(x => x.Anchor).Should().Equal(
            "Tenant Signature 10", "Tenant Signature 20", "Tenant Signature 30", "Tenant Signature 40");
        slots.Select(x => x.Anchor).Should().OnlyHaveUniqueItems();
    }
}
