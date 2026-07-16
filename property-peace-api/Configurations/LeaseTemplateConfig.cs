using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseTemplateConfig : IEntityTypeConfiguration<LeaseTemplate>
    {
        public void Configure(EntityTypeBuilder<LeaseTemplate> b)
        {
            b.ToTable("LeaseTemplates", "lease_builder");
            b.HasKey(t => t.Id);

            b.Property(t => t.Name)
                .IsRequired()
                .HasMaxLength(200);

            b.Property(t => t.Description)
                .HasMaxLength(1000);

            b.Property(t => t.State)
                .HasMaxLength(50);

            b.Property(t => t.PropertyType)
                .HasMaxLength(50);

            b.Property(t => t.TemplateStructure)
                .IsRequired()
                .HasColumnType("nvarchar(max)");

            b.Property(t => t.Version)
                .IsRequired()
                .HasMaxLength(20)
                .HasDefaultValue("1.0");

            b.Property(t => t.IsDeleted)
                .HasDefaultValue(false);

            // Relationships
            b.HasOne(t => t.Organization)
                .WithMany()
                .HasForeignKey(t => t.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(t => t.Landlord)
                .WithMany()
                .HasForeignKey(t => t.LandlordId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(t => t.Sections)
                .WithOne(s => s.LeaseTemplate)
                .HasForeignKey(s => s.LeaseTemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(t => t.LeaseInstances)
                .WithOne(i => i.LeaseTemplate)
                .HasForeignKey(i => i.LeaseTemplateId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasMany(t => t.Policies)
                .WithOne(p => p.LeaseTemplate)
                .HasForeignKey(p => p.LeaseTemplateId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            b.HasIndex(t => t.OrganizationId);
            b.HasIndex(t => t.LandlordId);
            b.HasIndex(t => new { t.OrganizationId, t.IsDeleted });
            b.HasIndex(t => new { t.IsDefault, t.IsDeleted });
        }
    }
}
