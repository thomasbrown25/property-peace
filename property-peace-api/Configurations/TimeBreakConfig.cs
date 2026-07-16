using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class TimeBreakConfig : IEntityTypeConfiguration<TimeBreak>
    {
        public void Configure(EntityTypeBuilder<TimeBreak> b)
        {
            b.ToTable("TimeBreaks", "staff");
            b.HasKey(tb => tb.Id);

            b.Property(tb => tb.BreakType)
                .HasConversion(new EnumToStringConverter<ETimeBreakType>())
                .HasMaxLength(50)
                .IsRequired();

            b.Property(tb => tb.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            b.Property(tb => tb.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

            b.Property(tb => tb.DurationHours)
                .HasColumnType("decimal(18,2)");

            // Time entry relationship
            b.HasOne(tb => tb.TimeEntry)
                .WithMany(t => t.Breaks)
                .HasForeignKey(tb => tb.TimeEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            b.HasIndex(tb => tb.TimeEntryId);
        }
    }
}
