using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class BankAccountConfig : IEntityTypeConfiguration<BankAccount>
    {
        public void Configure(EntityTypeBuilder<BankAccount> builder)
        {
            builder.ToTable("BankAccounts", "financial");
            builder.HasKey(ba => ba.Id);
            builder.Property(ba => ba.Id).ValueGeneratedOnAdd();

            builder.Property(ba => ba.OrganizationId).IsRequired();
            builder.Property(ba => ba.StripeAccountId).IsRequired().HasMaxLength(255);
            builder.Property(ba => ba.DisplayName).IsRequired().HasMaxLength(200);
            builder.Property(ba => ba.Last4).HasMaxLength(50);
            builder.Property(ba => ba.BankName).HasMaxLength(200);
            builder.Property(ba => ba.AccountType).HasMaxLength(50);

            builder.HasOne(ba => ba.Organization)
                .WithMany()
                .HasForeignKey(ba => ba.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            // Index for faster lookups
            builder.HasIndex(ba => ba.OrganizationId);
            builder.HasIndex(ba => ba.StripeAccountId);
        }
    }
}

