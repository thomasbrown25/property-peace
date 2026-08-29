namespace brownstone_hub_api.Services.StripeRentPayments
{
    public sealed class StripeRentTransferBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<StripeRentTransferBackgroundService> logger) : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // The switch is checked both here and inside the scoped processor. Missing/false is fail-closed.
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Always run recovery processing. The scoped service independently fail-closes new
                    // transfers when Stripe:TransfersEnabled is missing/false, but transfer reversals
                    // must continue after that emergency switch is turned off.
                    await using var scope = scopeFactory.CreateAsyncScope();
                    var service = scope.ServiceProvider.GetRequiredService<IStripeRentPaymentService>();
                    await service.ProcessEligibleTransfersAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Stripe rent transfer worker iteration failed");
                }

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
    }
}
