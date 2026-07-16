using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.JobRunHistories;
using brownstone_hub_api.Services.DailySummaryEmailService;
using brownstone_hub_api.Services.LeaseAutoRenewService;
using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.ScheduledNotificationService;
using brownstone_hub_api.Services.StateDepositLawService;
using brownstone_hub_api.Services.StateLateFeeLawService;
using brownstone_hub_api.Services.StateLawSourceService;

namespace brownstone_hub_api.Services.JobRunnerService
{
    public class JobRunnerService : IJobRunnerService
    {
        public const string JobIdStateLateFeeLawUpdate = "StateLateFeeLawUpdate";
        public const string JobIdStateDepositLawUpdate = "StateDepositLawUpdate";
        public const string JobIdRentReminder = "RentReminder";
        public const string JobIdLeaseAutoRenew = "LeaseAutoRenew";
        public const string JobIdDailySummaryEmail = "DailySummaryEmail";

        private static readonly IReadOnlyList<JobDefinition> JobDefinitions = new List<JobDefinition>
        {
            new() { Id = JobIdStateLateFeeLawUpdate, Name = "Update state late fee laws" },
            new() { Id = JobIdStateDepositLawUpdate, Name = "Update state deposit laws" },
            new() { Id = JobIdRentReminder, Name = "Rent reminder (select lease)" },
            new() { Id = JobIdLeaseAutoRenew, Name = "Lease auto-renew" },
            new() { Id = JobIdDailySummaryEmail, Name = "Daily summary email" }
        };

        private readonly IServiceProvider _serviceProvider;
        private readonly IJobRunHistoryRepository _historyRepository;
        private readonly ILogger<JobRunnerService> _logger;

        public JobRunnerService(
            IServiceProvider serviceProvider,
            IJobRunHistoryRepository historyRepository,
            ILogger<JobRunnerService> logger)
        {
            _serviceProvider = serviceProvider;
            _historyRepository = historyRepository;
            _logger = logger;
        }

        public IReadOnlyList<JobDefinition> GetJobDefinitions() => JobDefinitions;

        public async Task<(bool Success, string? Error)> RunJobAsync(string jobId, long? leaseId = null)
        {
            var job = JobDefinitions.FirstOrDefault(j => string.Equals(j.Id, jobId, StringComparison.OrdinalIgnoreCase));
            if (job == null)
                return (false, $"Unknown job: {jobId}");

            if (string.Equals(jobId, JobIdRentReminder, StringComparison.OrdinalIgnoreCase) && !leaseId.HasValue)
                return (false, "Rent reminder job requires a lease to be selected.");

            var record = new JobRunHistory
            {
                JobId = job.Id,
                JobName = job.Name,
                StartedAt = DateTime.UtcNow,
                Status = "Running"
            };
            record = await _historyRepository.AddAsync(record);

            try
            {
                if (string.Equals(jobId, JobIdStateLateFeeLawUpdate, StringComparison.OrdinalIgnoreCase))
                    await RunStateLateFeeLawUpdateAsync();
                else if (string.Equals(jobId, JobIdStateDepositLawUpdate, StringComparison.OrdinalIgnoreCase))
                    await RunStateDepositLawUpdateAsync();
                else if (string.Equals(jobId, JobIdRentReminder, StringComparison.OrdinalIgnoreCase))
                    await RunRentReminderAsync(leaseId!.Value);
                else if (string.Equals(jobId, JobIdLeaseAutoRenew, StringComparison.OrdinalIgnoreCase))
                    await RunLeaseAutoRenewAsync();
                else if (string.Equals(jobId, JobIdDailySummaryEmail, StringComparison.OrdinalIgnoreCase))
                    await RunDailySummaryEmailAsync();
                else
                    throw new ArgumentException($"Unknown job: {jobId}");

                await _historyRepository.UpdateCompletionAsync(record.Id, DateTime.UtcNow, "Completed", null);
                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Job {JobId} failed", jobId);
                var message = ex.Message.Length <= 2000 ? ex.Message : ex.Message.Substring(0, 2000);
                await _historyRepository.UpdateCompletionAsync(record.Id, DateTime.UtcNow, "Failed", message);
                return (false, ex.Message);
            }
        }

        private async Task RunRentReminderAsync(long leaseId)
        {
            using var scope = _serviceProvider.CreateScope();
            var scheduledNotificationService = scope.ServiceProvider.GetRequiredService<IScheduledNotificationService>();
            await scheduledNotificationService.ProcessRentRemindersForLeaseAsync(leaseId);
        }

        private async Task RunLeaseAutoRenewAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var autoRenewService = scope.ServiceProvider.GetRequiredService<ILeaseAutoRenewService>();
            await autoRenewService.ProcessAutoRenewalsAsync();
        }

        private async Task RunDailySummaryEmailAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var dailySummaryEmailService = scope.ServiceProvider.GetRequiredService<IDailySummaryEmailService>();
            await dailySummaryEmailService.RunImmediateDailySummariesAsync();
        }

        private async Task RunStateLateFeeLawUpdateAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var stateLawService = scope.ServiceProvider.GetRequiredService<IStateLateFeeLawService>();
            var openAIService = scope.ServiceProvider.GetRequiredService<IOpenAIService>();
            var stateLawSource = scope.ServiceProvider.GetRequiredService<IStateLawSourceService>();

            var statesToUpdate = await stateLawService.GetStatesNeedingUpdateAsync(30);
            _logger.LogInformation("State late fee law update: {Count} states", statesToUpdate.Count);

            foreach (var state in statesToUpdate)
            {
                try
                {
                    string prompt;
                    var curatedUrl = await stateLawSource.GetLateFeeUrlAsync(state);
                    if (!string.IsNullOrWhiteSpace(curatedUrl))
                    {
                        var officialText = await stateLawSource.FetchPageTextAsync(curatedUrl);
                        if (!string.IsNullOrWhiteSpace(officialText))
                        {
                            prompt = $@"Using ONLY the following official state law text from a government website, extract the required information. Do not add anything that is not stated in the text. If the text does not mention something, say so briefly.

Official text (excerpt):
{TruncateForPrompt(officialText, 12000)}

Provide exactly two lines in this format:
Grace Period: [description based on the text above]
Fee Amount: [description of maximum late fee amounts/percentages allowed based on the text above]";
                        }
                        else
                        {
                            _logger.LogWarning("Could not fetch curated URL for state {State}, using fallback prompt", state);
                            prompt = BuildFallbackLateFeePrompt(state);
                        }
                    }
                    else
                    {
                        prompt = BuildFallbackLateFeePrompt(state);
                    }

                    var response = await openAIService.GenerateTextAsync(prompt, maxTokens: 500);
                    if (!response.Success || string.IsNullOrWhiteSpace(response.Data))
                    {
                        _logger.LogWarning("No AI response for state {State}", state);
                        continue;
                    }

                    var gracePeriodDesc = ExtractDescription(response.Data, "Grace Period");
                    var feeAmountDesc = ExtractDescription(response.Data, "Fee Amount");
                    await stateLawService.UpdateStateLawAsync(state, gracePeriodDesc, feeAmountDesc, "AI");
                    await Task.Delay(TimeSpan.FromSeconds(2));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating late fee law for state {State}", state);
                }
            }
        }

        private static string BuildFallbackLateFeePrompt(string state) =>
            $@"What are the late fee laws for {state}? Please provide information about:
1. Grace period: What is the grace period before a late fee may be charged?
2. Fee amount: What are the maximum late fee amounts or percentages allowed?

Format your response as:
Grace Period: [description]
Fee Amount: [description]";

        private async Task RunStateDepositLawUpdateAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var stateDepositLawService = scope.ServiceProvider.GetRequiredService<IStateDepositLawService>();
            var openAIService = scope.ServiceProvider.GetRequiredService<IOpenAIService>();
            var stateLawSource = scope.ServiceProvider.GetRequiredService<IStateLawSourceService>();

            var statesToUpdate = await stateDepositLawService.GetStatesNeedingUpdateAsync(30);
            _logger.LogInformation("State deposit law update: {Count} states", statesToUpdate.Count);

            foreach (var state in statesToUpdate)
            {
                try
                {
                    string prompt;
                    var curatedUrl = await stateLawSource.GetSecurityDepositUrlAsync(state);
                    if (!string.IsNullOrWhiteSpace(curatedUrl))
                    {
                        var officialText = await stateLawSource.FetchPageTextAsync(curatedUrl);
                        if (!string.IsNullOrWhiteSpace(officialText))
                        {
                            prompt = $@"Using ONLY the following official state law text from a government website, extract security deposit rules for landlords. Do not add anything not stated in the text.

Official text (excerpt):
{TruncateForPrompt(officialText, 12000)}

Provide 4 to 6 concise bullet points a landlord would need to know. Cover: maximum deposit amount or limits, separate account and notifying tenant of bank name/address, interest requirements, unknown tenant address, and deadline to return the deposit. Write each bullet on its own line. No numbers or labels—just the sentence for each bullet.";
                        }
                        else
                        {
                            _logger.LogWarning("Could not fetch curated URL for state {State}, using fallback prompt", state);
                            prompt = BuildFallbackDepositPrompt(state);
                        }
                    }
                    else
                    {
                        prompt = BuildFallbackDepositPrompt(state);
                    }

                    var response = await openAIService.GenerateTextAsync(prompt, maxTokens: 600);
                    if (!response.Success || string.IsNullOrWhiteSpace(response.Data))
                    {
                        _logger.LogWarning("No AI response for state {State}", state);
                        continue;
                    }

                    var bulletPointsText = string.Join("\n",
                        response.Data
                            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                            .Select(s => s.Trim())
                            .Where(s => s.Length > 0));

                    if (!string.IsNullOrWhiteSpace(bulletPointsText))
                        await stateDepositLawService.UpdateStateLawAsync(state, bulletPointsText, "AI");

                    await Task.Delay(TimeSpan.FromSeconds(2));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error updating deposit law for state {State}", state);
                }
            }
        }

        private static string BuildFallbackDepositPrompt(string state) =>
            $@"What are the security deposit laws for {state}? Provide 4 to 6 concise bullet points for landlords. Cover: maximum deposit, separate account and bank notification, interest, unknown address, return deadline. One bullet per line, no numbers or labels.";

        private static string TruncateForPrompt(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength) return text ?? "";
            return text.Substring(0, maxLength) + "\n[... text truncated ...]";
        }

        private static string? ExtractDescription(string text, string label)
        {
            var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                if (trimmed.StartsWith(label + ":", StringComparison.OrdinalIgnoreCase))
                {
                    var description = trimmed.Substring(label.Length + 1).Trim();
                    if (!string.IsNullOrWhiteSpace(description)) return description;
                }
            }
            var index = text.IndexOf(label + ":", StringComparison.OrdinalIgnoreCase);
            if (index >= 0)
            {
                var start = index + label.Length + 1;
                var end = text.IndexOf('\n', start);
                if (end < 0) end = text.Length;
                var description = text.Substring(start, end - start).Trim();
                if (!string.IsNullOrWhiteSpace(description)) return description;
            }
            return null;
        }
    }
}
