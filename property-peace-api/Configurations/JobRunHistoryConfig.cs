using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class JobRunHistoryConfig : IEntityTypeConfiguration<JobRunHistory>
    {
        public void Configure(EntityTypeBuilder<JobRunHistory> b)
        {
            b.ToTable("JobRunHistories", "admin");
            b.HasIndex(x => x.JobId);
            b.HasIndex(x => x.StartedAt);
        }
    }
}
