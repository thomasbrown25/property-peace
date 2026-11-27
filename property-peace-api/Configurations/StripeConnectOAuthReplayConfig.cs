using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class StripeConnectOAuthReplayConfig : IEntityTypeConfiguration<StripeConnectOAuthReplay>
{
    public void Configure(EntityTypeBuilder<StripeConnectOAuthReplay> builder)
    {
        builder.ToTable("StripeConnectOAuthReplays", "financial");
        builder.HasKey(x => x.CodeHash);
        builder.Property(x => x.CodeHash).HasMaxLength(64);
        builder.Property(x => x.StateNonceHash).HasMaxLength(64).IsRequired();
        builder.HasIndex(x => x.StateNonceHash).IsUnique();
        builder.HasIndex(x => x.ExpiresAt);
    }
}
