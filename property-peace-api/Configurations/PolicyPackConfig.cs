using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class PolicyPackConfig : IEntityTypeConfiguration<PolicyPack>
    {
        public void Configure(EntityTypeBuilder<PolicyPack> b)
        {
            b.ToTable("PolicyPacks", "lease_builder");
            b.HasKey(p => p.Id);

            b.Property(p => p.Name)
                .IsRequired()
                .HasMaxLength(200);

            b.Property(p => p.Description)
                .HasMaxLength(1000);

            b.Property(p => p.IsDefault)
                .HasDefaultValue(false);

            // Relationships
            b.HasOne(p => p.Organization)
                .WithMany()
                .HasForeignKey(p => p.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(p => p.Landlord)
                .WithMany()
                .HasForeignKey(p => p.LandlordId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(p => p.Items)
                .WithOne(i => i.PolicyPack)
                .HasForeignKey(i => i.PolicyPackId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            b.HasIndex(p => p.OrganizationId);
            b.HasIndex(p => p.LandlordId);
            b.HasIndex(p => new { p.IsDefault, p.OrganizationId });
        }
    }
}
