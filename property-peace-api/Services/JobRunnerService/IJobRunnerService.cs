namespace brownstone_hub_api.Services.JobRunnerService
{
    public class JobDefinition
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    public interface IJobRunnerService
    {
        IReadOnlyList<JobDefinition> GetJobDefinitions();
        Task<(bool Success, string? Error)> RunJobAsync(string jobId, long? leaseId = null);
    }
}
