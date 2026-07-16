using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class TimeTrackingSettingsConfig : IEntityTypeConfiguration<TimeTrackingSettings>
    {
        public void Configure(EntityTypeBuilder<TimeTrackingSettings> b)
        {
            b.ToTable("TimeTrackingSettings", "staff");
            b.HasKey(s => s.Id);

            b.Property(s => s.RoundingMethod)
                .HasConversion(new EnumToStringConverter<ETimeRoundingMethod>())
                .HasMaxLength(50)
                .IsRequired();

            b.Property(s => s.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            b.Property(s => s.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

            // Organization relationship (one-to-one)
            b.HasOne(s => s.Organization)
                .WithMany()
                .HasForeignKey(s => s.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Unique index to ensure one settings per organization
            b.HasIndex(s => s.OrganizationId)
                .IsUnique();
        }
    }
}
