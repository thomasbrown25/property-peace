using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class TenantConfig : IEntityTypeConfiguration<Tenant>
    {
        public void Configure(EntityTypeBuilder<Tenant> b)
        {
            b.ToTable("Tenants", "tenant");
            // optional 1:1 with User
            b.HasOne(t => t.User)
             .WithOne()
             .HasForeignKey<Tenant>(t => t.UserId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            // Many-to-many relationship with Lease via TenantLease join entity
            b.HasMany(t => t.TenantLeases)
             .WithOne(tl => tl.Tenant)
             .HasForeignKey(tl => tl.TenantId)
             .OnDelete(DeleteBehavior.Cascade);

            // Organization relationship
            b.HasOne(t => t.Organization)
             .WithMany()
             .HasForeignKey(t => t.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            // Indexes you actually query by
            b.HasIndex(t => t.UserId);
            b.HasIndex(t => t.OrganizationId);
        }
    }
}