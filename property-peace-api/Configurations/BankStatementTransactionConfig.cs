using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class BankStatementTransactionConfig : IEntityTypeConfiguration<BankStatementTransaction>
    {
        public void Configure(EntityTypeBuilder<BankStatementTransaction> builder)
        {
            builder.ToTable("BankStatementTransactions", "financial");

            builder.HasKey(e => e.Id);

            builder.Property(e => e.TransactionDate).IsRequired();
            builder.Property(e => e.Amount).HasColumnType("decimal(18,2)").IsRequired();

            builder.HasOne(e => e.BankStatement)
                .WithMany()
                .HasForeignKey(e => e.BankStatementId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(e => e.MatchedLedgerEntry)
                .WithMany()
                .HasForeignKey(e => e.MatchedLedgerEntryId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(e => e.BankStatementId);
            builder.HasIndex(e => e.MatchedLedgerEntryId)
                .IsUnique()
                .HasFilter("[MatchedLedgerEntryId] IS NOT NULL");
            builder.HasIndex(e => e.TransactionDate);
            builder.HasIndex(e => e.IsMatched);
        }
    }
}
