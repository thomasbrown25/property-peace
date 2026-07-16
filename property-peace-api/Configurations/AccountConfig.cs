using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class AccountConfig : IEntityTypeConfiguration<Account>
    {
        public void Configure(EntityTypeBuilder<Account> b)
        {
            b.ToTable("Accounts", "financial");
            b.HasOne(a => a.Organization)
                .WithMany()
                .HasForeignKey(a => a.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(a => a.ParentAccount)
                .WithMany(a => a.ChildAccounts)
                .HasForeignKey(a => a.ParentAccountId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(a => new { a.OrganizationId, a.AccountCode }).IsUnique();
            b.HasIndex(a => a.OrganizationId);
            b.HasIndex(a => a.AccountType);
            b.HasIndex(a => a.ParentAccountId);
        }
    }
}
