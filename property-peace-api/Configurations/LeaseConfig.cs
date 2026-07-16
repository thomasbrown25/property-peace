using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseConfig : IEntityTypeConfiguration<Lease>
    {
        public void Configure(EntityTypeBuilder<Lease> b)
        {
            b.ToTable("Leases", "lease");
            b.HasIndex(l => new { l.UnitId, l.IsDeleted });

            b.Property(l => l.RentAmount).HasPrecision(18, 2);
            b.Property(l => l.DepositAmount).HasPrecision(18, 2);
            b.Property(l => l.OverdueAmount).HasPrecision(18, 2);
            b.Property(l => l.PetDepositAmount).HasPrecision(18, 2);
            b.Property(l => l.RentIncreaseValue).HasPrecision(18, 2);
            b.Property(l => l.AutoRenewRentIncrementValue).HasPrecision(18, 2);

            b.Property(l => l.RentCollectionOtherOptions)
                .HasColumnType("nvarchar(max)");
            b.Property(l => l.RentCollectionOtherSpecify)
                .HasMaxLength(500);

            b.Property(l => l.TenantMailingStreetAddress).HasMaxLength(500);
            b.Property(l => l.TenantMailingUnit).HasMaxLength(50);
            b.Property(l => l.TenantMailingCity).HasMaxLength(200);
            b.Property(l => l.TenantMailingState).HasMaxLength(50);
            b.Property(l => l.TenantMailingZipCode).HasMaxLength(20);

            // NOTE: Unit↔Lease already configured in UnitConfig; don't repeat here.

            // Many-to-many relationship with Tenant via TenantLease join entity
            b.HasMany(l => l.TenantLeases)
             .WithOne(tl => tl.Lease)
             .HasForeignKey(tl => tl.LeaseId)
             .OnDelete(DeleteBehavior.Cascade);

            // Set default value for IsDeleted
            b.Property(l => l.IsDeleted)
                .HasDefaultValue(false);
            
            // Explicitly mark nullable properties as optional
            b.Property(l => l.CustomDateSelected)
                .IsRequired(false);

            // Organization relationship
            b.HasOne(l => l.Organization)
                .WithMany()
                .HasForeignKey(l => l.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
                
            b.HasIndex(l => l.OrganizationId);

            // Operating bank account (Stripe Connect) for this lease
            b.HasOne(l => l.OperatingAccount)
                .WithMany()
                .HasForeignKey(l => l.OperatingAccountId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(l => l.OperatingAccountId);
        }
    }
}