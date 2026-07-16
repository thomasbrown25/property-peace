using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ClauseLibraryConfig : IEntityTypeConfiguration<ClauseLibrary>
    {
        public void Configure(EntityTypeBuilder<ClauseLibrary> b)
        {
            b.ToTable("ClauseLibraries", "lease_builder");
            b.HasKey(c => c.Id);

            b.Property(c => c.ClauseKey)
                .IsRequired()
                .HasMaxLength(100);

            b.Property(c => c.Title)
                .IsRequired()
                .HasMaxLength(200);

            b.Property(c => c.Content)
                .IsRequired()
                .HasColumnType("nvarchar(max)");

            b.Property(c => c.Category)
                .IsRequired()
                .HasMaxLength(50);

            b.Property(c => c.Version)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue("1.0");

            b.Property(c => c.State)
                .HasMaxLength(50);

            b.Property(c => c.IsSystemClause)
                .HasDefaultValue(false);

            // Relationships
            b.HasOne(c => c.Organization)
                .WithMany()
                .HasForeignKey(c => c.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(c => c.Landlord)
                .WithMany()
                .HasForeignKey(c => c.LandlordId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            b.HasIndex(c => c.ClauseKey)
                .IsUnique();
            b.HasIndex(c => c.OrganizationId);
            b.HasIndex(c => c.LandlordId);
            b.HasIndex(c => new { c.Category, c.IsSystemClause });
        }
    }
}
