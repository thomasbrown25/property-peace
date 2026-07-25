using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class PasskeyCredentialConfig : IEntityTypeConfiguration<PasskeyCredential>
    {
        public void Configure(EntityTypeBuilder<PasskeyCredential> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.CredentialId).HasMaxLength(1400).IsRequired();
            builder.Property(x => x.CredentialIdHash).HasMaxLength(64).IsRequired();
            builder.HasIndex(x => x.CredentialIdHash).IsUnique();
            builder.Property(x => x.PublicKey).IsRequired();
            builder.Property(x => x.UserHandle).HasMaxLength(64).IsRequired();
            builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
            builder.HasOne(x => x.User)
                .WithMany(x => x.PasskeyCredentials)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
