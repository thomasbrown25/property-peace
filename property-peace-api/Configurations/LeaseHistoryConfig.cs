using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseHistoryConfig : IEntityTypeConfiguration<LeaseHistory>
    {
        public void Configure(EntityTypeBuilder<LeaseHistory> b)
        {
            b.ToTable("LeaseHistories", "lease");

            b.Property(l => l.RentAmount).HasPrecision(18, 2);
            b.Property(l => l.DepositAmount).HasPrecision(18, 2);
            b.Property(l => l.OverdueAmount).HasPrecision(18, 2);

            b.HasIndex(l => l.OriginalLeaseId);
            b.HasIndex(l => l.UnitId);
            b.HasIndex(l => l.OrganizationId);
            b.HasIndex(l => l.ArchivedAt);

            // E-Signature field configurations
            b.Property(l => l.DocuSignEnvelopeId)
                .HasMaxLength(200);
            
            b.Property(l => l.LandlordSignature)
                .HasMaxLength(2000);
            
            b.Property(l => l.SignedDocumentBlobName)
                .HasMaxLength(500);
            
            b.Property(l => l.SignedDocumentBlobUrl)
                .HasMaxLength(1000);

            b.Property(l => l.RentFrequency)
                .HasMaxLength(50);
        }
    }
}

