using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public sealed class StripeConnectPreparationConfig : IEntityTypeConfiguration<StripeConnectPreparation>
    {
        public void Configure(EntityTypeBuilder<StripeConnectPreparation> builder)
        {
            builder.ToTable("StripeConnectPreparations", "financial");
            builder.Property(x => x.OperatingType).HasMaxLength(32).IsRequired();
            builder.Property(x => x.DisplayName).HasMaxLength(200).IsRequired();
            builder.Property(x => x.AuthorityRelationship).HasMaxLength(64).IsRequired();
            builder.HasIndex(x => new { x.UserId, x.OrganizationId }).IsUnique();
            builder.HasIndex(x => new { x.OrganizationId, x.UpdatedAt });
            builder.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    public sealed class StripeConnectPreparationPropertyConfig : IEntityTypeConfiguration<StripeConnectPreparationProperty>
    {
        public void Configure(EntityTypeBuilder<StripeConnectPreparationProperty> builder)
        {
            builder.ToTable("StripeConnectPreparationProperties", "financial");
            builder.HasIndex(x => new { x.StripeConnectPreparationId, x.PropertyId }).IsUnique();
            builder.HasOne(x => x.Preparation).WithMany(x => x.Properties)
                .HasForeignKey(x => x.StripeConnectPreparationId).OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(x => x.Property).WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Restrict);
        }
    }
}
