using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ImpersonationSessionConfig : IEntityTypeConfiguration<ImpersonationSession>
    {
        public void Configure(EntityTypeBuilder<ImpersonationSession> builder)
        {
            builder.ToTable("ImpersonationSessions", "core");
            builder.HasKey(session => session.Id);
            builder.Property(session => session.Reason).HasMaxLength(1000).IsRequired();
            builder.Property(session => session.SupportReference).HasMaxLength(200);
            builder.Property(session => session.RefreshTokenHash).HasMaxLength(64).IsRequired();
            builder.Property(session => session.PreviousRefreshTokenHash).HasMaxLength(64);
            builder.Property(session => session.StopReason).HasMaxLength(100);
            builder.HasIndex(session => session.RefreshTokenHash).IsUnique();
            builder.HasIndex(session => new { session.ActorUserId, session.ExpiresAt });
            builder.HasIndex(session => new { session.TargetUserId, session.ExpiresAt });
            // IDs remain as historical facts without FKs. Hard deletion must not erase/block security history.
        }
    }
}
