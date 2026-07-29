using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class MfaEnrollmentConfig : IEntityTypeConfiguration<MfaEnrollment>
{
    public void Configure(EntityTypeBuilder<MfaEnrollment> b)
    {
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.UserId, x.Method }).IsUnique();
        b.Property(x => x.Method).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.PhoneNumber).HasMaxLength(20);
        b.Property(x => x.ProtectedSecret).HasMaxLength(2048);
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class MfaChallengeConfig : IEntityTypeConfiguration<MfaChallenge>
{
    public void Configure(EntityTypeBuilder<MfaChallenge> b)
    {
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.UserId, x.ExpiresAt });
        b.Property(x => x.Method).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.Purpose).HasConversion<string>().HasMaxLength(16);
        b.Property(x => x.CodeHash).HasMaxLength(64);
        b.Property(x => x.CodeSalt).HasMaxLength(64);
        b.Property(x => x.PendingValueProtected).HasMaxLength(1024);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Enrollment).WithMany().HasForeignKey(x => x.EnrollmentId).OnDelete(DeleteBehavior.NoAction);
    }
}
