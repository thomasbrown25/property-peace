using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.JobRunHistories
{
    public class JobRunHistoryRepository : IJobRunHistoryRepository
    {
        private readonly DataContext _context;
        private readonly ILogger<JobRunHistoryRepository> _logger;

        public JobRunHistoryRepository(DataContext context, ILogger<JobRunHistoryRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<JobRunHistory> AddAsync(JobRunHistory record)
        {
            await _context.JobRunHistories.AddAsync(record);
            await _context.SaveChangesAsync();
            return record;
        }

        public async Task UpdateCompletionAsync(long id, DateTime completedAt, string status, string? message = null)
        {
            var record = await _context.JobRunHistories.FindAsync(id);
            if (record == null) return;
            record.CompletedAt = completedAt;
            record.Status = status;
            record.Message = message;
            await _context.SaveChangesAsync();
        }

        public async Task<List<JobRunHistory>> GetHistoryAsync(int limit = 100)
        {
            return await _context.JobRunHistories
                .OrderByDescending(x => x.StartedAt)
                .Take(limit)
                .ToListAsync();
        }
    }
}
