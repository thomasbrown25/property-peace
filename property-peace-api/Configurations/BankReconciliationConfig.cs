using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class BankReconciliationConfig : IEntityTypeConfiguration<BankReconciliation>
    {
        public void Configure(EntityTypeBuilder<BankReconciliation> builder)
        {
            builder.ToTable("BankReconciliations", "financial");

            builder.HasKey(e => e.Id);

            builder.Property(e => e.ReconciledDate).IsRequired();
            builder.Property(e => e.Status).HasMaxLength(50).IsRequired();

            builder.HasOne(e => e.BankStatement)
                .WithMany()
                .HasForeignKey(e => e.BankStatementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(e => e.ReconciledByUser)
                .WithMany()
                .HasForeignKey(e => e.ReconciledByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasIndex(e => e.BankStatementId);
            builder.HasIndex(e => e.ReconciledByUserId);
            builder.HasIndex(e => e.Status);
        }
    }
}
