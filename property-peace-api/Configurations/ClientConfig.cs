using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ClientConfig : IEntityTypeConfiguration<Models.Client>
    {
        public void Configure(EntityTypeBuilder<Models.Client> b)
        {
            b.ToTable("Clients", "client");

            b.Property(c => c.ManagementFeeFlat).HasPrecision(18, 2);
            b.Property(c => c.ManagementFeePercentage).HasPrecision(18, 2);

            // Relationships
            b.HasOne(c => c.Organization)
                .WithMany()
                .HasForeignKey(c => c.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(c => c.Properties)
                .WithOne(p => p.Client)
                .HasForeignKey(p => p.ClientId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            b.HasIndex(c => c.OrganizationId);
            b.HasIndex(c => c.Email);
            b.HasIndex(c => new { c.OrganizationId, c.Email });

            // Set default value for IsDeleted
            b.Property(c => c.IsDeleted)
                .HasDefaultValue(false);
        }
    }
}
