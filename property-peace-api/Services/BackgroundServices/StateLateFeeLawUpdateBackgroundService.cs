using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.StateLateFeeLawService;
using brownstone_hub_api.Services.StateLawSourceService;

namespace brownstone_hub_api.Services.BackgroundServices
{
    public class StateLateFeeLawUpdateBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<StateLateFeeLawUpdateBackgroundService> _logger;
        private DateTime _lastRunDate = DateTime.MinValue;

        public StateLateFeeLawUpdateBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<StateLateFeeLawUpdateBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("StateLateFeeLawUpdateBackgroundService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    var today = now.Date;

                    // Run on the 1st day of each month, between 2:00 AM and 2:59 AM
                    if (now.Day == 1 && now.Hour == 2 && _lastRunDate != today)
                    {
                        _logger.LogInformation("Starting monthly state late fee law update at {Time}", now);
                        await UpdateStateLawsAsync();
                        _lastRunDate = today;
                        _logger.LogInformation("Completed monthly state late fee law update");
                    }

                    // Check every hour
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in StateLateFeeLawUpdateBackgroundService");
                    // Wait 1 hour before retrying
                    try
                    {
                        await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                }
            }

            _logger.LogInformation("StateLateFeeLawUpdateBackgroundService stopped");
        }

        private async Task UpdateStateLawsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var stateLawService = scope.ServiceProvider.GetRequiredService<IStateLateFeeLawService>();
            var openAIService = scope.ServiceProvider.GetRequiredService<IOpenAIService>();
            var stateLawSource = scope.ServiceProvider.GetRequiredService<IStateLawSourceService>();

            try
            {
                var statesToUpdate = await stateLawService.GetStatesNeedingUpdateAsync(30);
                _logger.LogInformation("Found {Count} states needing update", statesToUpdate.Count);

                foreach (var state in statesToUpdate)
                {
                    try
                    {
                        _logger.LogInformation("Updating late fee laws for state {State}", state);

                        string prompt;
                        var curatedUrl = await stateLawSource.GetLateFeeUrlAsync(state);
                        if (!string.IsNullOrWhiteSpace(curatedUrl))
                        {
                            var officialText = await stateLawSource.FetchPageTextAsync(curatedUrl);
                            if (!string.IsNullOrWhiteSpace(officialText))
                            {
                                var excerpt = officialText.Length > 12000 ? officialText.Substring(0, 12000) + "\n[... truncated ...]" : officialText;
                                prompt = $@"Using ONLY the following official state law text from a government website, extract the required information. Do not add anything not stated in the text.

Official text (excerpt):
{excerpt}

Provide exactly two lines:
Grace Period: [description based on the text]
Fee Amount: [description of maximum late fee amounts/percentages based on the text]";
                            }
                            else
                            {
                                prompt = $@"What are the late fee laws for {state}? Format your response as: Grace Period: [description] Fee Amount: [description]";
                            }
                        }
                        else
                        {
                            prompt = $@"What are the late fee laws for {state}? Format your response as: Grace Period: [description] Fee Amount: [description]";
                        }

                        var response = await openAIService.GenerateTextAsync(prompt, maxTokens: 500);

                        if (!response.Success || string.IsNullOrWhiteSpace(response.Data))
                        {
                            _logger.LogWarning("Failed to get AI response for state {State}: {Message}", state, response.Message);
                            continue;
                        }

                        // Parse the response to extract grace period and fee amount descriptions
                        var gracePeriodDesc = ExtractDescription(response.Data, "Grace Period");
                        var feeAmountDesc = ExtractDescription(response.Data, "Fee Amount");

                        // Update the state law
                        await stateLawService.UpdateStateLawAsync(
                            state,
                            gracePeriodDesc,
                            feeAmountDesc,
                            "AI"
                        );

                        _logger.LogInformation("Successfully updated late fee laws for state {State}", state);

                        // Add a small delay between states to avoid rate limiting
                        await Task.Delay(TimeSpan.FromSeconds(2));
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error updating state {State}", state);
                        // Continue with next state
                    }
                }

                _logger.LogInformation("Completed updating state late fee laws");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateStateLawsAsync");
                throw;
            }
        }

        private string? ExtractDescription(string text, string label)
        {
            try
            {
                // Look for patterns like "Grace Period: description" or "Fee Amount: description"
                var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                
                foreach (var line in lines)
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith(label + ":", StringComparison.OrdinalIgnoreCase))
                    {
                        var description = trimmed.Substring(label.Length + 1).Trim();
                        if (!string.IsNullOrWhiteSpace(description))
                        {
                            return description;
                        }
                    }
                }

                // If not found in structured format, try to find it in the text
                var index = text.IndexOf(label + ":", StringComparison.OrdinalIgnoreCase);
                if (index >= 0)
                {
                    var start = index + label.Length + 1;
                    var end = text.IndexOf('\n', start);
                    if (end < 0) end = text.Length;
                    
                    var description = text.Substring(start, end - start).Trim();
                    if (!string.IsNullOrWhiteSpace(description))
                    {
                        return description;
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error extracting {Label} from text", label);
                return null;
            }
        }
    }
}
