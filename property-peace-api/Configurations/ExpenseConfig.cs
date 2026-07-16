using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ExpenseConfig : IEntityTypeConfiguration<Expense>
    {
        public void Configure(EntityTypeBuilder<Expense> b)
        {
            b.ToTable("Expenses", "financial");
            b.HasOne(e => e.Property)
             .WithMany()
             .HasForeignKey(e => e.PropertyId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(e => e.Unit)
             .WithMany()
             .HasForeignKey(e => e.UnitId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(e => e.MaintenanceRequest)
             .WithMany()
             .HasForeignKey(e => e.MaintenanceRequestId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(e => e.VendorEntity)
             .WithMany(v => v.Expenses)
             .HasForeignKey(e => e.VendorId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(e => e.TaxCategoryEntity)
             .WithMany(tc => tc.Expenses)
             .HasForeignKey(e => e.TaxCategoryId)
             .OnDelete(DeleteBehavior.SetNull);

            // Organization relationship
            b.HasOne(e => e.Organization)
             .WithMany()
             .HasForeignKey(e => e.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(e => new { e.LandlordId, e.PropertyId });
            b.HasIndex(e => e.ExpenseDate);
            b.HasIndex(e => e.Category);
            b.HasIndex(e => e.VendorId);
            b.HasIndex(e => e.OrganizationId);
        }
    }
}

