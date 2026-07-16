using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class RecurringExpenseConfig : IEntityTypeConfiguration<RecurringExpense>
    {
        public void Configure(EntityTypeBuilder<RecurringExpense> b)
        {
            b.ToTable("RecurringExpenses", "financial");
            b.HasOne(re => re.Property)
             .WithMany()
             .HasForeignKey(re => re.PropertyId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(re => re.Unit)
             .WithMany()
             .HasForeignKey(re => re.UnitId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(re => re.MaintenanceRequest)
             .WithMany()
             .HasForeignKey(re => re.MaintenanceRequestId)
             .OnDelete(DeleteBehavior.SetNull);
             
            // Organization relationship
            b.HasOne(re => re.Organization)
             .WithMany()
             .HasForeignKey(re => re.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(re => new { re.LandlordId, re.PropertyId });
            b.HasIndex(re => re.OrganizationId);
        }
    }
}

