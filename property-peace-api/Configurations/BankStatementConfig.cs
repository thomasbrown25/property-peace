using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class BankStatementConfig : IEntityTypeConfiguration<BankStatement>
    {
        public void Configure(EntityTypeBuilder<BankStatement> builder)
        {
            builder.ToTable("BankStatements", "financial");

            builder.HasKey(e => e.Id);

            builder.Property(e => e.StatementDate).IsRequired();
            builder.Property(e => e.StartingBalance).HasColumnType("decimal(18,2)").IsRequired();
            builder.Property(e => e.EndingBalance).HasColumnType("decimal(18,2)").IsRequired();

            builder.HasOne(e => e.Organization)
                .WithMany()
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(e => e.BankAccount)
                .WithMany()
                .HasForeignKey(e => e.BankAccountId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(e => e.OrganizationId);
            builder.HasIndex(e => e.BankAccountId);
            builder.HasIndex(e => e.StatementDate);
        }
    }
}
