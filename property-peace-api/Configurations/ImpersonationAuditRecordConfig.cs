using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ImpersonationAuditRecordConfig : IEntityTypeConfiguration<ImpersonationAuditRecord>
    {
        public void Configure(EntityTypeBuilder<ImpersonationAuditRecord> builder)
        {
            builder.ToTable("ImpersonationAuditRecords", "audit");
            builder.HasKey(record => record.Id);
            builder.Property(record => record.Action).HasMaxLength(50).IsRequired();
            builder.Property(record => record.Result).HasMaxLength(50).IsRequired();
            builder.Property(record => record.Detail).HasMaxLength(1000);
            builder.Property(record => record.IpAddress).HasMaxLength(64);
            builder.Property(record => record.UserAgent).HasMaxLength(512);
            builder.Property(record => record.HttpMethod).HasMaxLength(16);
            builder.Property(record => record.Route).HasMaxLength(512);
            builder.Property(record => record.TraceId).HasMaxLength(128);
            builder.Property(record => record.CorrelationId).HasMaxLength(128);
            builder.Property(record => record.EntityRouteIds).HasMaxLength(1000);
            builder.HasIndex(record => new { record.ImpersonationSessionId, record.OccurredAt });
            builder.HasIndex(record => new { record.ActorUserId, record.OccurredAt });
            // Deliberately no navigation/FK: audit rows remain immutable historical facts even if users are removed.
        }
    }
}
