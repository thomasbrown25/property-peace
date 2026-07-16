using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ExpenseReceiptConfig : IEntityTypeConfiguration<ExpenseReceipt>
    {
        public void Configure(EntityTypeBuilder<ExpenseReceipt> b)
        {
            b.ToTable("ExpenseReceipts", "financial");
            b.HasOne(e => e.Expense)
             .WithMany(e => e.Receipts)
             .HasForeignKey(e => e.RefId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(e => e.RefId);
            b.HasIndex(e => e.CreatedAt);
        }
    }
}

