using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class TenantInviteConfig : IEntityTypeConfiguration<TenantInvite>
    {
        public void Configure(EntityTypeBuilder<TenantInvite> b)
        {
            b.ToTable("TenantInvites", "tenant");
            // Required relationship with Tenant
            b.HasOne(ti => ti.Tenant)
             .WithMany()
             .HasForeignKey(ti => ti.TenantId)
             .IsRequired()
             .OnDelete(DeleteBehavior.Cascade);

            // Required relationship with User (landlord who created the invite)
            b.HasOne(ti => ti.CreatedByUser)
             .WithMany()
             .HasForeignKey(ti => ti.CreatedBy)
             .IsRequired()
             .OnDelete(DeleteBehavior.Restrict);

            // Organization relationship
            b.HasOne(ti => ti.Organization)
             .WithMany()
             .HasForeignKey(ti => ti.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            // Indexes for performance
            b.HasIndex(ti => ti.InviteToken).IsUnique();
            b.HasIndex(ti => ti.TenantId);
            b.HasIndex(ti => ti.Email);
            b.HasIndex(ti => ti.IsUsed);
            b.HasIndex(ti => ti.OrganizationId);
        }
    }
}

