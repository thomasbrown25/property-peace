using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseDocumentConfig : IEntityTypeConfiguration<LeaseDocument>
    {
        public void Configure(EntityTypeBuilder<LeaseDocument> b)
        {
            b.ToTable("LeaseDocuments", "lease_builder");
            b.HasKey(d => d.Id);

            b.Property(d => d.DocumentType)
                .IsRequired()
                .HasMaxLength(20);

            b.Property(d => d.BlobName)
                .IsRequired()
                .HasMaxLength(500);

            b.Property(d => d.BlobUrl)
                .IsRequired()
                .HasMaxLength(1000);

            b.Property(d => d.FileHash)
                .HasMaxLength(64); // SHA256 = 64 hex chars

            // Relationships
            b.HasOne(d => d.LeaseInstance)
                .WithMany(i => i.Documents)
                .HasForeignKey(d => d.LeaseInstanceId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(d => d.GeneratedByUser)
                .WithMany()
                .HasForeignKey(d => d.GeneratedBy)
                .OnDelete(DeleteBehavior.Restrict);

            // Indexes
            b.HasIndex(d => d.LeaseInstanceId);
            b.HasIndex(d => new { d.LeaseInstanceId, d.DocumentType });
        }
    }
}
