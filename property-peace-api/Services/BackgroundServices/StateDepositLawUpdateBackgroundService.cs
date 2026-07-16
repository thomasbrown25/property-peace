using brownstone_hub_api.Services.OpenAIService;
using brownstone_hub_api.Services.StateDepositLawService;
using brownstone_hub_api.Services.StateLawSourceService;

namespace brownstone_hub_api.Services.BackgroundServices
{
    public class StateDepositLawUpdateBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<StateDepositLawUpdateBackgroundService> _logger;
        private DateTime _lastRunDate = DateTime.MinValue;

        public StateDepositLawUpdateBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<StateDepositLawUpdateBackgroundService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("StateDepositLawUpdateBackgroundService started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    var today = now.Date;

                    if (now.Day == 1 && now.Hour == 2 && _lastRunDate != today)
                    {
                        _logger.LogInformation("Starting monthly state deposit law update at {Time}", now);
                        await UpdateStateLawsAsync();
                        _lastRunDate = today;
                        _logger.LogInformation("Completed monthly state deposit law update");
                    }

                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in StateDepositLawUpdateBackgroundService");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
                }
            }

            _logger.LogInformation("StateDepositLawUpdateBackgroundService stopped");
        }

        private async Task UpdateStateLawsAsync()
        {
            using var scope = _serviceProvider.CreateScope();
            var stateDepositLawService = scope.ServiceProvider.GetRequiredService<IStateDepositLawService>();
            var openAIService = scope.ServiceProvider.GetRequiredService<IOpenAIService>();
            var stateLawSource = scope.ServiceProvider.GetRequiredService<IStateLawSourceService>();

            try
            {
                var statesToUpdate = await stateDepositLawService.GetStatesNeedingUpdateAsync(30);
                _logger.LogInformation("Found {Count} states needing deposit law update", statesToUpdate.Count);

                foreach (var state in statesToUpdate)
                {
                    try
                    {
                        _logger.LogInformation("Updating deposit laws for state {State}", state);

                        string prompt;
                        var curatedUrl = await stateLawSource.GetSecurityDepositUrlAsync(state);
                        if (!string.IsNullOrWhiteSpace(curatedUrl))
                        {
                            var officialText = await stateLawSource.FetchPageTextAsync(curatedUrl);
                            if (!string.IsNullOrWhiteSpace(officialText))
                            {
                                var excerpt = officialText.Length > 12000 ? officialText.Substring(0, 12000) + "\n[... truncated ...]" : officialText;
                                prompt = $@"Using ONLY the following official state law text from a government website, extract security deposit rules for landlords. Do not add anything not stated in the text.

Official text (excerpt):
{excerpt}

Provide 4 to 6 concise bullet points for landlords. Cover: maximum deposit, separate account and bank notification, interest, unknown address, return deadline. One bullet per line, no numbers or labels.";
                            }
                            else
                            {
                                prompt = $@"What are the security deposit laws for {state}? Provide 4 to 6 bullet points for landlords. One bullet per line.";
                            }
                        }
                        else
                        {
                            prompt = $@"What are the security deposit laws for {state}? Provide 4 to 6 bullet points for landlords. One bullet per line.";
                        }

                        var response = await openAIService.GenerateTextAsync(prompt, maxTokens: 600);

                        if (!response.Success || string.IsNullOrWhiteSpace(response.Data))
                        {
                            _logger.LogWarning("Failed to get AI response for state {State}: {Message}", state, response.Message);
                            continue;
                        }

                        var bulletPointsText = string.Join("\n",
                            response.Data
                                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                                .Select(s => s.Trim())
                                .Where(s => s.Length > 0));

                        if (string.IsNullOrWhiteSpace(bulletPointsText))
                        {
                            _logger.LogWarning("Empty bullet points for state {State}", state);
                            continue;
                        }

                        await stateDepositLawService.UpdateStateLawAsync(state, bulletPointsText, "AI");

                        _logger.LogInformation("Successfully updated deposit laws for state {State}", state);

                        await Task.Delay(TimeSpan.FromSeconds(2));
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error updating deposit law for state {State}", state);
                    }
                }

                _logger.LogInformation("Completed updating state deposit laws");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in UpdateStateLawsAsync");
                throw;
            }
        }
    }
}
