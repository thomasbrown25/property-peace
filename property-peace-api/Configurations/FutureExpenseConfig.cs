using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class FutureExpenseConfig : IEntityTypeConfiguration<FutureExpense>
    {
        public void Configure(EntityTypeBuilder<FutureExpense> b)
        {
            b.ToTable("FutureExpenses", "financial");
            
            b.HasOne(fe => fe.Property)
             .WithMany()
             .HasForeignKey(fe => fe.PropertyId)
             .OnDelete(DeleteBehavior.NoAction);
             
            // Organization relationship
            b.HasOne(fe => fe.Organization)
             .WithMany()
             .HasForeignKey(fe => fe.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(fe => new { fe.LandlordId, fe.PropertyId });
            b.HasIndex(fe => fe.OrganizationId);
            b.HasIndex(fe => fe.DueDate);
        }
    }
}
