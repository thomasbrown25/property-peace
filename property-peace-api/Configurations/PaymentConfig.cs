using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class PaymentConfig : IEntityTypeConfiguration<Payment>
    {
        public void Configure(EntityTypeBuilder<Payment> b)
        {
            b.ToTable("Payments", "financial");
            b.HasOne(p => p.Lease)
                .WithMany()
                .HasForeignKey(p => p.LeaseId)
                .OnDelete(DeleteBehavior.Restrict);
                
            // Organization relationship
            b.HasOne(p => p.Organization)
                .WithMany()
                .HasForeignKey(p => p.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
                
            b.HasIndex(p => p.LeaseId);
            b.HasIndex(p => p.PropertyId);
            b.HasIndex(p => p.OrganizationId);
            b.HasIndex(p => p.FeeId);
            b.HasIndex(p => p.DepositId);
            
            // Fee relationship (optional)
            b.HasOne(p => p.Fee)
                .WithMany()
                .HasForeignKey(p => p.FeeId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.NoAction);
            
            // Deposit relationship (optional) - use navigation so EF does not create shadow DepositId1
            b.HasOne(p => p.Deposit)
                .WithMany()
                .HasForeignKey(p => p.DepositId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}

