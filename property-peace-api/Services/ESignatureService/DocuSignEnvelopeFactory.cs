using brownstone_hub_api.Dtos.Lease;
using DocuSign.eSign.Model;

namespace brownstone_hub_api.Services.ESignatureService;

public static class LeaseSignatureAnchors
{
    public const string Landlord = "Landlord Signature";
    public static string Tenant(long tenantId) => $"Tenant Signature {tenantId}";
}

public sealed record LeaseSignatureSlot(string Anchor, long TenantId);

public static class LeaseSignatureLayout
{
    public static IReadOnlyList<LeaseSignatureSlot> ForTenantIds(IEnumerable<long> tenantIds) =>
        tenantIds.Distinct().OrderBy(id => id)
            .Select(id => new LeaseSignatureSlot(LeaseSignatureAnchors.Tenant(id), id))
            .ToList();
}

public static class DocuSignEnvelopeFactory
{
    public static EnvelopeDefinition Create(SendLeaseForSignatureDto request, byte[] documentBytes, string documentName)
    {
        var envelope = new EnvelopeDefinition
        {
            EmailSubject = request.EmailSubject ?? "Please sign this lease agreement",
            EmailBlurb = request.EmailMessage ?? "Please review and sign the attached lease agreement.",
            Status = request.UseEmbeddedSigning ? "created" : "sent",
            EnforceSignerVisibility = "false",
            Documents =
            [
                new Document
                {
                    DocumentBase64 = Convert.ToBase64String(documentBytes),
                    Name = documentName,
                    FileExtension = Path.GetExtension(documentName).TrimStart('.'),
                    DocumentId = "1"
                }
            ]
        };

        var landlord = new Signer
        {
            Email = request.LandlordEmail,
            Name = request.LandlordName,
            RecipientId = "1",
            RoutingOrder = "1",
            RequireIdLookup = "false",
            ClientUserId = request.UseEmbeddedSigning ? request.LandlordEmail : null,
            Tabs = CreateTabs(LeaseSignatureAnchors.Landlord, "20", "LandlordSignature", "LandlordDate", "150", "335")
        };

        var signers = new List<Signer> { landlord };
        var tenantIndex = 0;
        foreach (var tenant in request.TenantSigners)
        {
            tenantIndex++;
            signers.Add(new Signer
            {
                Email = tenant.Email,
                Name = tenant.Name,
                RecipientId = (tenantIndex + 1).ToString(),
                RoutingOrder = tenant.SigningOrder.ToString(),
                RequireIdLookup = "false",
                Tabs = CreateTabs(LeaseSignatureAnchors.Tenant(tenant.TenantId), "16",
                    $"TenantSignature{tenant.TenantId}", $"TenantDate{tenant.TenantId}", "150", "355")
            });
        }

        envelope.Recipients = new Recipients { Signers = signers };
        if (request.ExpirationDays > 0)
        {
            envelope.ExpireEnabled = "true";
            envelope.ExpireAfter = request.ExpirationDays.ToString();
        }
        return envelope;
    }

    private static Tabs CreateTabs(string anchor, string yOffset, string signatureLabel, string dateLabel,
        string signatureXOffset, string dateXOffset) => new()
    {
        SignHereTabs =
        [
            new SignHere
            {
                DocumentId = "1", AnchorString = anchor, AnchorXOffset = signatureXOffset,
                AnchorYOffset = yOffset, AnchorUnits = "pixels", TabLabel = signatureLabel
            }
        ],
        DateSignedTabs =
        [
            new DateSigned
            {
                DocumentId = "1", AnchorString = anchor, AnchorXOffset = dateXOffset,
                AnchorYOffset = yOffset, AnchorUnits = "pixels", TabLabel = dateLabel
            }
        ]
    };
}