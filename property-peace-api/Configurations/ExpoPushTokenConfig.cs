using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ExpoPushTokenConfig : IEntityTypeConfiguration<ExpoPushToken>
{
    public void Configure(EntityTypeBuilder<ExpoPushToken> b)
    {
        b.ToTable("ExpoPushTokens", "communication");
        b.HasKey(x => x.Id);
        b.Property(x => x.Token).HasMaxLength(255).IsRequired();
        b.HasIndex(x => x.Token).IsUnique();
        b.HasIndex(x => x.UserId);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
