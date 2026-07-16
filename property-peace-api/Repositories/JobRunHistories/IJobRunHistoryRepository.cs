using brownstone_hub_api.Models;

namespace brownstone_hub_api.Repositories.JobRunHistories
{
    public interface IJobRunHistoryRepository
    {
        Task<JobRunHistory> AddAsync(JobRunHistory record);
        Task UpdateCompletionAsync(long id, DateTime completedAt, string status, string? message = null);
        Task<List<JobRunHistory>> GetHistoryAsync(int limit = 100);
    }
}
