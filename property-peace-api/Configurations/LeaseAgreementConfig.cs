using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseAgreementConfig : IEntityTypeConfiguration<LeaseAgreement>
    {
        public void Configure(EntityTypeBuilder<LeaseAgreement> b)
        {
            b.ToTable("LeaseAgreements", "lease");

            b.HasIndex(la => la.LeaseId).IsUnique();

            b.HasOne(la => la.Lease)
             .WithOne(l => l.LeaseAgreement)
             .HasForeignKey<LeaseAgreement>(la => la.LeaseId)
             .OnDelete(DeleteBehavior.Cascade);

            b.Property(la => la.SignatureStatus).IsRequired(false);

            b.Property(la => la.DocuSignEnvelopeId).HasMaxLength(200);
            b.Property(la => la.LandlordSignature).HasMaxLength(2000);
            b.Property(la => la.SignedDocumentBlobName).HasMaxLength(500);
            b.Property(la => la.SignedDocumentBlobUrl).HasMaxLength(1000);
        }
    }
}
