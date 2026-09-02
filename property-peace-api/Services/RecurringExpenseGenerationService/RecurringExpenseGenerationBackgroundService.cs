using brownstone_hub_api.Services.ExpenseService;

namespace brownstone_hub_api.Services.RecurringExpenseGenerationService
{
    public class RecurringExpenseGenerationBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<RecurringExpenseGenerationBackgroundService> logger) : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider = serviceProvider;
        private readonly ILogger<RecurringExpenseGenerationBackgroundService> _logger = logger;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Recurring Expense Generation Background Service started at {Time}", DateTime.Now);
            _logger.LogInformation("Expenses will be generated daily at 1:00 AM");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    
                    // Run daily at 1:00 AM
                    if (now.Hour == 1 && now.Minute < 5)
                    {
                        _logger.LogInformation("Starting recurring expense generation at {Time}", now);
                        
                        using (var scope = _serviceProvider.CreateScope())
                        {
                            var expenseService = scope.ServiceProvider.GetRequiredService<IExpenseService>();
                            var result = await expenseService.GenerateExpensesFromRecurring();
                            
                            if (result.Success)
                            {
                                _logger.LogInformation("Generated expenses from recurring templates: {Message}", result.Message);
                            }
                            else
                            {
                                _logger.LogWarning("Error generating expenses: {Message}", result.Message);
                            }
                        }

                        // Wait 5 minutes to avoid multiple runs in the same hour
                        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                    }

                    // Check every 5 minutes
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in recurring expense generation background service");
                    // Wait 5 minutes before retrying
                    try
                    {
                        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                }
            }

            _logger.LogInformation("Recurring Expense Generation Background Service stopped");
        }
    }
}
