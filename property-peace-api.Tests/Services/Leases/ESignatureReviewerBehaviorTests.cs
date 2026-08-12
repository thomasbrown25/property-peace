using System.Reflection;
using brownstone_hub_api.Services.ESignatureService;
using DocuSign.eSign.Model;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leases;

public sealed class ESignatureReviewerBehaviorTests
{
    [Fact]
    public void Status_adapter_uses_nonblank_authoritative_provider_envelope_id()
    {
        var method = typeof(DocuSignService).GetMethod("AdaptSignatureStatus", BindingFlags.NonPublic | BindingFlags.Static);
        method.Should().NotBeNull("the provider response must be adapted independently from the requested id");
        var envelope = new Envelope
        {
            EnvelopeId = "provider-authoritative",
            Status = "completed",
            CompletedDateTime = "2026-08-10T05:00:00Z"
        };

        var result = (SignatureStatusDto)method!.Invoke(null, [envelope, new Dictionary<string, SignerStatusDto>()])!;

        result.EnvelopeId.Should().Be("provider-authoritative");
        var invalid = () => method.Invoke(null, [new Envelope { EnvelopeId = "   " }, new Dictionary<string, SignerStatusDto>()]);
        invalid.Should().Throw<TargetInvocationException>().WithInnerException<InvalidOperationException>();
    }

    [Fact]
    public void Landlord_resolution_never_uses_a_tenant_in_multi_signer_flow()
    {
        var method = typeof(brownstone_hub_api.Services.LeaseService.LeaseService)
            .GetMethod("ResolveLandlordSignedAt", BindingFlags.NonPublic | BindingFlags.Static);
        method.Should().NotBeNull();
        var tenantSignedAt = new DateTime(2026, 8, 10, 5, 0, 0, DateTimeKind.Utc);
        var status = new SignatureStatusDto
        {
            Status = "completed",
            SignerStatuses = new Dictionary<string, SignerStatusDto>(StringComparer.OrdinalIgnoreCase)
            {
                ["tenant@example.com"] = new() { Email = "tenant@example.com", Status = "completed", SignedAt = tenantSignedAt },
                ["unsigned-landlord@example.com"] = new() { Email = "unsigned-landlord@example.com", Status = "sent" }
            }
        };

        var multiSigner = (DateTime?)method!.Invoke(null, [status, "landlord@example.com", false]);
        var fakeLandlordOnly = (DateTime?)method.Invoke(null, [status, null, true]);

        multiSigner.Should().BeNull();
        fakeLandlordOnly.Should().BeNull("cardinality fallback requires a genuine one-signer envelope");
    }

    [Fact]
    public void Landlord_resolution_allows_only_server_confirmed_single_signer_fallback()
    {
        var method = typeof(brownstone_hub_api.Services.LeaseService.LeaseService)
            .GetMethod("ResolveLandlordSignedAt", BindingFlags.NonPublic | BindingFlags.Static)!;
        var signedAt = new DateTime(2026, 8, 10, 5, 0, 0, DateTimeKind.Utc);
        var status = new SignatureStatusDto
        {
            SignerStatuses = new Dictionary<string, SignerStatusDto>
            {
                ["canonical@example.com"] = new() { Status = "signed", SignedAt = signedAt }
            }
        };

        ((DateTime?)method.Invoke(null, [status, null, false])).Should().BeNull();
        ((DateTime?)method.Invoke(null, [status, null, true])).Should().Be(signedAt);
    }
}
