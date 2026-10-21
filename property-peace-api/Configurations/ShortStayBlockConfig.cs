using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayBlockConfig : IEntityTypeConfiguration<ShortStayBlock>
{
    public void Configure(EntityTypeBuilder<ShortStayBlock> b)
    {
        b.ToTable("ShortStayBlocks", "listing", t =>
            t.HasCheckConstraint("CK_ShortStayBlocks_DateRange", "[EndDate] > [StartDate]"));
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.UnitId, x.StartDate, x.EndDate });
        b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).IsRequired()
            .OnDelete(DeleteBehavior.NoAction);
        b.Property(x => x.StartDate).IsRequired();
        b.Property(x => x.EndDate).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(500);
        b.Property(x => x.CreatedAtUtc).IsRequired();
    }
}
