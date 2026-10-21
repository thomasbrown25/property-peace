using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayGuidebookDraftConfig : IEntityTypeConfiguration<ShortStayGuidebookDraft>
{
    public void Configure(EntityTypeBuilder<ShortStayGuidebookDraft> b)
    {
        b.ToTable("ShortStayGuidebookDrafts", "listing", t =>
            t.HasCheckConstraint("CK_ShortStayGuidebookDrafts_UnitId", "[UnitId] > 0"));
        // UnitId is both the FK and primary key: the PK is the one-draft-per-unit unique constraint.
        b.HasKey(x => x.UnitId);
        b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.HouseRules).HasMaxLength(2000);
        b.Property(x => x.ArrivalOverview).HasMaxLength(2000);
        b.Property(x => x.LocalNotes).HasMaxLength(2000);
    }
}
