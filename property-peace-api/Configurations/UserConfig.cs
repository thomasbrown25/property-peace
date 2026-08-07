using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class UserConfig : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> b)
        {
            b.ToTable("Users", "core");
            b.HasKey(u => u.Id);

            // Organization relationship (optional - for current organization context)
            b.HasOne(u => u.CurrentOrganization)
                .WithMany()
                .HasForeignKey(u => u.CurrentOrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Index for performance
            b.HasIndex(u => u.CurrentOrganizationId);

            // Other indexes
            b.HasIndex(u => u.Email).IsUnique();
            b.HasIndex(u => u.GoogleId);
            b.Property(u => u.AppleId).HasMaxLength(255);
            b.HasIndex(u => u.AppleId)
                .IsUnique()
                .HasFilter("[AppleId] IS NOT NULL");
            b.HasIndex(u => u.IsDeleted);
            b.HasIndex(u => u.IsSuspended);
        }
    }
}

