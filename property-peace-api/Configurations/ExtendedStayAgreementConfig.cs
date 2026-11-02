using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ExtendedStayAgreementConfig : IEntityTypeConfiguration<ExtendedStayAgreement>
{
    public void Configure(EntityTypeBuilder<ExtendedStayAgreement> b)
    {
        b.ToTable("ExtendedStayAgreements", "listing", t =>
            t.HasCheckConstraint("CK_ExtendedStayAgreements_Dates", "[EndDate] > [StartDate]"));
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.UnitId, x.StartDate, x.EndDate });
        b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.NoAction);
        b.Property(x => x.OccupantName).IsRequired().HasMaxLength(200);
        b.Property(x => x.CreatedAtUtc).IsRequired();
    }
}
