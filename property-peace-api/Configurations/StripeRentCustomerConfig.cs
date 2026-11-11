using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class StripeRentCustomerConfig : IEntityTypeConfiguration<StripeRentCustomer>
{
    public void Configure(EntityTypeBuilder<StripeRentCustomer> builder)
    {
        builder.ToTable("StripeRentCustomers", "financial");
        builder.HasKey(x => new { x.TenantUserId, x.StripeAccountId });
        builder.HasIndex(x => new { x.StripeAccountId, x.CustomerId }).IsUnique();
        builder.Property(x => x.CustomerId).IsRequired();
        builder.Property(x => x.CustomerId).Metadata.SetAfterSaveBehavior(Microsoft.EntityFrameworkCore.Metadata.PropertySaveBehavior.Throw);
    }
}
