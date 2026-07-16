using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class GeneralLedgerEntryConfig : IEntityTypeConfiguration<GeneralLedgerEntry>
    {
        public void Configure(EntityTypeBuilder<GeneralLedgerEntry> b)
        {
            b.ToTable("GeneralLedgerEntries", "financial");
            b.HasOne(e => e.Organization)
                .WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(e => e.Account)
                .WithMany()
                .HasForeignKey(e => e.AccountId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(e => new { e.OrganizationId, e.AccountId });
            b.HasIndex(e => e.TransactionDate);
            b.HasIndex(e => e.TransactionType);
            b.HasIndex(e => e.TransactionId);
        }
    }
}
