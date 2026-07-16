using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class TenantDocumentConfig : IEntityTypeConfiguration<TenantDocument>
    {
        public void Configure(EntityTypeBuilder<TenantDocument> builder)
        {
            builder.ToTable("TenantDocuments", "tenant");
            builder.HasKey(td => td.Id);

            builder.Property(td => td.FileName)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(td => td.Description)
                .HasMaxLength(1000);

            builder.Property(td => td.BlobName)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(td => td.BlobUrl)
                .IsRequired()
                .HasMaxLength(1000);

            // Relationships - TenantId optional for lease-level documents (no tenants yet)
            builder.HasOne(td => td.Tenant)
                .WithMany()
                .HasForeignKey(td => td.TenantId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(td => td.Lease)
                .WithMany()
                .HasForeignKey(td => td.LeaseId)
                .OnDelete(DeleteBehavior.SetNull);

            // Organization relationship
            builder.HasOne(td => td.Organization)
                .WithMany()
                .HasForeignKey(td => td.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            builder.HasIndex(td => td.TenantId);
            builder.HasIndex(td => td.LeaseId);
            builder.HasIndex(td => td.DocumentType);
            builder.HasIndex(td => td.ExpirationDate);
            builder.HasIndex(td => new { td.TenantId, td.IsDeleted });
            builder.HasIndex(td => td.OrganizationId);
        }
    }
}

