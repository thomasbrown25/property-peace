using Stripe;
using brownstone_hub_api.Dtos.Stripe;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.StripeService
{
    public class StripeSyncService : IStripeSyncService
    {
        private readonly ISubscriptionPlanRepository _planRepository;
        private readonly ISubscriptionRepository _subscriptionRepository;
        private readonly IStripeService _stripeService;
        private readonly DataContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<StripeSyncService> _logger;
        private readonly string? _stripeSecretKey;

        public StripeSyncService(
            ISubscriptionPlanRepository planRepository,
            ISubscriptionRepository subscriptionRepository,
            IStripeService stripeService,
            DataContext context,
            IConfiguration configuration,
            ILogger<StripeSyncService> logger)
        {
            _planRepository = planRepository;
            _subscriptionRepository = subscriptionRepository;
            _stripeService = stripeService;
            _context = context;
            _configuration = configuration;
            _logger = logger;
            _stripeSecretKey = _configuration["Stripe:SecretKey"];

            if (!string.IsNullOrWhiteSpace(_stripeSecretKey))
            {
                StripeConfiguration.ApiKey = _stripeSecretKey;
            }
        }

        public async Task<ServiceResponse<StripeSyncResultDto>> SyncPlansFromStripeAsync()
        {
            var response = new ServiceResponse<StripeSyncResultDto>();
            var result = new StripeSyncResultDto();

            try
            {
                if (string.IsNullOrWhiteSpace(_stripeSecretKey))
                {
                    result.Errors.Add("Stripe secret key is not configured");
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                // Get all products from Stripe
                var productService = new ProductService();
                var productOptions = new ProductListOptions
                {
                    Active = true,
                    Limit = 100
                };

                var stripeProducts = await productService.ListAsync(productOptions);
                result.TotalPlansFound = stripeProducts.Data.Count;

                // Get all plans from database
                var dbPlans = await _context.SubscriptionPlans
                    .Where(p => !p.IsTrial && p.IsActive && p.MonthlyPrice > 0)
                    .ToListAsync();

                foreach (var dbPlan in dbPlans)
                {
                    var detail = new PlanSyncDetailDto
                    {
                        PlanName = dbPlan.Name
                    };

                    // Try to match Stripe product to database plan
                    // Match by name: "Starter Plan" or "Starter" matches "Starter"
                    // Also check metadata for custom plan identifier
                    var matchedProduct = stripeProducts.Data.FirstOrDefault(p =>
                        p.Name.Equals(dbPlan.Name, StringComparison.OrdinalIgnoreCase) ||
                        p.Name.Equals($"{dbPlan.Name} Plan", StringComparison.OrdinalIgnoreCase) ||
                        p.Name.Replace(" Plan", "", StringComparison.OrdinalIgnoreCase).Equals(dbPlan.Name, StringComparison.OrdinalIgnoreCase) ||
                        (p.Metadata != null && p.Metadata.ContainsKey("planName") &&
                         p.Metadata["planName"].Equals(dbPlan.Name, StringComparison.OrdinalIgnoreCase)));

                    if (matchedProduct == null)
                    {
                        detail.Matched = false;
                        detail.Message = $"No matching Stripe product found for '{dbPlan.Name}'";
                        result.Warnings.Add($"Plan '{dbPlan.Name}' not found in Stripe");
                        result.Details.Add(detail);
                        continue;
                    }

                    detail.Matched = true;
                    detail.StripeProductName = matchedProduct.Name;
                    detail.StripeProductId = matchedProduct.Id;

                    // Get prices for this product
                    var priceService = new PriceService();
                    var priceOptions = new PriceListOptions
                    {
                        Product = matchedProduct.Id,
                        Active = true
                    };

                    var prices = await priceService.ListAsync(priceOptions);
                    var monthlyPrice = prices.Data.FirstOrDefault(p =>
                        p.Recurring?.Interval == "month" && p.Active == true);
                    var annualPrice = prices.Data.FirstOrDefault(p =>
                        p.Recurring?.Interval == "year" && p.Active == true);

                    // Update database plan with Stripe IDs
                    bool wasUpdated = false;

                    if (dbPlan.StripeProductId != matchedProduct.Id)
                    {
                        dbPlan.StripeProductId = matchedProduct.Id;
                        wasUpdated = true;
                    }

                    if (monthlyPrice != null && dbPlan.StripePriceIdMonthly != monthlyPrice.Id)
                    {
                        dbPlan.StripePriceIdMonthly = monthlyPrice.Id;
                        wasUpdated = true;
                        detail.StripePriceIdMonthly = monthlyPrice.Id;
                    }
                    else if (monthlyPrice == null)
                    {
                        result.Warnings.Add($"Plan '{dbPlan.Name}': No active monthly price found in Stripe");
                    }

                    if (annualPrice != null && dbPlan.StripePriceIdAnnual != annualPrice.Id)
                    {
                        dbPlan.StripePriceIdAnnual = annualPrice.Id;
                        wasUpdated = true;
                        detail.StripePriceIdAnnual = annualPrice.Id;
                    }
                    else if (annualPrice == null)
                    {
                        result.Warnings.Add($"Plan '{dbPlan.Name}': No active annual price found in Stripe");
                    }

                    if (wasUpdated)
                    {
                        dbPlan.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                        detail.Updated = true;
                        detail.Message = "Stripe IDs updated successfully";
                        result.PlansUpdated++;
                    }
                    else
                    {
                        detail.Message = "No updates needed - IDs already match";
                    }

                    result.PlansMatched++;
                    result.Details.Add(detail);
                }

                response.Success = true;
                response.Data = result;
                response.Message = $"Synced {result.PlansUpdated} plans. {result.PlansMatched}/{dbPlans.Count} plans matched.";

                _logger.LogInformation("Stripe sync completed: {PlansUpdated} updated, {PlansMatched} matched",
                    result.PlansUpdated, result.PlansMatched);
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe API error during sync");
                result.Errors.Add($"Stripe API error: {ex.Message}");
                response.Success = false;
                response.Data = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing plans from Stripe");
                result.Errors.Add($"Error: {ex.Message}");
                response.Success = false;
                response.Data = result;
            }

            return response;
        }

        public async Task<ServiceResponse<List<StripeProductInfoDto>>> GetStripeProductsAsync()
        {
            var response = new ServiceResponse<List<StripeProductInfoDto>>();

            try
            {
                if (string.IsNullOrWhiteSpace(_stripeSecretKey))
                {
                    response.Success = false;
                    response.Message = "Stripe secret key is not configured";
                    return response;
                }

                var productService = new ProductService();
                var productOptions = new ProductListOptions
                {
                    Active = true,
                    Limit = 100
                };

                var stripeProducts = await productService.ListAsync(productOptions);
                var result = new List<StripeProductInfoDto>();

                foreach (var product in stripeProducts.Data)
                {
                    // Get prices for this product
                    var priceService = new PriceService();
                    var priceOptions = new PriceListOptions
                    {
                        Product = product.Id,
                        Active = true
                    };

                    var prices = await priceService.ListAsync(priceOptions);

                    var productInfo = new StripeProductInfoDto
                    {
                        ProductId = product.Id,
                        ProductName = product.Name,
                        Description = product.Description,
                        Active = product.Active,
                        Prices = prices.Data.Select(p => new StripePriceInfoDto
                        {
                            PriceId = p.Id,
                            Amount = p.UnitAmountDecimal ?? 0,
                            Currency = p.Currency,
                            Interval = p.Recurring?.Interval ?? "one_time",
                            Active = p.Active
                        }).ToList()
                    };

                    result.Add(productInfo);
                }

                response.Success = true;
                response.Data = result;
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe API error getting products");
                response.Success = false;
                response.Message = $"Stripe API error: {ex.Message}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Stripe products");
                response.Success = false;
                response.Message = $"Error: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionSyncResultDto>> SyncSubscriptionsToStripeAsync()
        {
            var response = new ServiceResponse<SubscriptionSyncResultDto>();
            var result = new SubscriptionSyncResultDto();

            try
            {
                if (string.IsNullOrWhiteSpace(_stripeSecretKey))
                {
                    result.Errors.Add("Stripe secret key is not configured");
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                // Get all active subscriptions from database
                var subscriptions = await _subscriptionRepository.GetActiveSubscriptionsAsync();
                result.TotalSubscriptions = subscriptions.Count;

                _logger.LogInformation("Starting sync of {Count} subscriptions to Stripe", subscriptions.Count);

                foreach (var subscription in subscriptions)
                {
                    try
                    {
                        // Skip if no Stripe subscription ID
                        if (string.IsNullOrEmpty(subscription.StripeSubscriptionId))
                        {
                            result.Skipped++;
                            result.SkippedReasons.Add($"Subscription {subscription.Id} has no Stripe subscription ID");
                            continue;
                        }

                        // Get the plan
                        var plan = subscription.SubscriptionPlan;
                        if (plan == null)
                        {
                            result.Skipped++;
                            result.SkippedReasons.Add($"Subscription {subscription.Id} has no associated plan");
                            continue;
                        }

                        // Determine which price ID to use based on billing cycle
                        var targetPriceId = subscription.BillingCycle == "Annual"
                            ? plan.StripePriceIdAnnual
                            : plan.StripePriceIdMonthly;

                        if (string.IsNullOrEmpty(targetPriceId))
                        {
                            result.Skipped++;
                            result.SkippedReasons.Add($"Subscription {subscription.Id}: No price ID found for billing cycle {subscription.BillingCycle}");
                            continue;
                        }

                        // Get current Stripe subscription to check current price
                        var stripeSubResponse = await _stripeService.GetSubscriptionAsync(subscription.StripeSubscriptionId);
                        if (!stripeSubResponse.Success || stripeSubResponse.Data == null)
                        {
                            result.Failed++;
                            result.Errors.Add($"Subscription {subscription.Id}: Could not retrieve Stripe subscription - {stripeSubResponse.Message}");
                            continue;
                        }

                        var stripeSubscription = stripeSubResponse.Data;
                        var currentPriceId = stripeSubscription.Items?.Data?.FirstOrDefault()?.Price?.Id;

                        // Skip if already on correct price
                        if (currentPriceId == targetPriceId)
                        {
                            result.Skipped++;
                            result.SkippedReasons.Add($"Subscription {subscription.Id} already on correct price {targetPriceId}");
                            continue;
                        }

                        // Update subscription in Stripe
                        var updateResponse = await _stripeService.UpdateSubscriptionAsync(
                            subscription.StripeSubscriptionId,
                            targetPriceId,
                            prorate: false // Don't prorate during sync
                        );

                        if (!updateResponse.Success)
                        {
                            result.Failed++;
                            result.Errors.Add($"Subscription {subscription.Id} (Organization: {subscription.Organization?.Name ?? "N/A"}): {updateResponse.Message}");
                            _logger.LogWarning("Failed to sync subscription {SubscriptionId}: {Message}", 
                                subscription.Id, updateResponse.Message);
                            continue;
                        }

                        // Update subscription in database
                        subscription.UpdatedAt = DateTime.UtcNow;
                        await _subscriptionRepository.UpdateSubscriptionAsync(subscription);

                        result.SuccessfullySynced++;
                        result.SuccessMessages.Add($"Subscription {subscription.Id} (Organization: {subscription.Organization?.Name ?? "N/A"}) synced from price {currentPriceId} to {targetPriceId}");
                        _logger.LogInformation("Successfully synced subscription {SubscriptionId} to price {PriceId}", 
                            subscription.Id, targetPriceId);
                    }
                    catch (Exception ex)
                    {
                        result.Failed++;
                        var errorMsg = $"Subscription {subscription.Id}: {ex.Message}";
                        result.Errors.Add(errorMsg);
                        _logger.LogError(ex, "Error syncing subscription {SubscriptionId}", subscription.Id);
                    }
                }

                response.Data = result;
                response.Success = true;
                response.Message = $"Sync completed: {result.SuccessfullySynced} synced, {result.Failed} failed, {result.Skipped} skipped out of {result.TotalSubscriptions} total";
                
                _logger.LogInformation("Subscription sync completed: {Success}/{Total} synced", 
                    result.SuccessfullySynced, result.TotalSubscriptions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing subscriptions to Stripe");
                response.Success = false;
                response.Message = $"Error syncing subscriptions: {ex.Message}";
                response.Data = result;
            }

            return response;
        }

        public async Task<ServiceResponse<PriceCleanupResultDto>> DeleteUnusedStripePricesAsync()
        {
            var response = new ServiceResponse<PriceCleanupResultDto>();
            var result = new PriceCleanupResultDto();

            try
            {
                if (string.IsNullOrWhiteSpace(_stripeSecretKey))
                {
                    result.Errors.Add("Stripe secret key is not configured");
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                // Get all price IDs from database
                var dbPriceIds = new HashSet<string>();
                var plans = await _planRepository.GetAllPlansAsync();
                
                foreach (var plan in plans)
                {
                    if (!string.IsNullOrEmpty(plan.StripePriceIdMonthly))
                        dbPriceIds.Add(plan.StripePriceIdMonthly);
                    if (!string.IsNullOrEmpty(plan.StripePriceIdAnnual))
                        dbPriceIds.Add(plan.StripePriceIdAnnual);
                }

                // Also check active subscriptions (they might be using old prices)
                var subscriptions = await _subscriptionRepository.GetActiveSubscriptionsAsync();
                foreach (var subscription in subscriptions)
                {
                    if (string.IsNullOrEmpty(subscription.StripeSubscriptionId))
                        continue;

                    try
                    {
                        var stripeSubResponse = await _stripeService.GetSubscriptionAsync(subscription.StripeSubscriptionId);
                        if (stripeSubResponse.Success && stripeSubResponse.Data != null)
                        {
                            var priceId = stripeSubResponse.Data.Items?.Data?.FirstOrDefault()?.Price?.Id;
                            if (!string.IsNullOrEmpty(priceId))
                            {
                                dbPriceIds.Add(priceId);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not get subscription {SubscriptionId} for price check", subscription.StripeSubscriptionId);
                    }
                }

                _logger.LogInformation("Found {Count} price IDs in use", dbPriceIds.Count);

                // Get all active prices from Stripe
                var priceService = new PriceService();
                var priceOptions = new PriceListOptions
                {
                    Active = true,
                    Limit = 100
                };

                var stripePrices = await priceService.ListAsync(priceOptions);
                result.TotalPricesChecked = stripePrices.Data.Count;

                _logger.LogInformation("Checking {Count} Stripe prices for cleanup", stripePrices.Data.Count);

                // Group prices by product, amount, and interval to find duplicates
                var priceGroups = stripePrices.Data
                    .GroupBy(p => new
                    {
                        ProductId = p.ProductId,
                        Amount = p.UnitAmountDecimal ?? 0,
                        Interval = p.Recurring?.Interval ?? "one_time"
                    })
                    .ToList();

                foreach (var price in stripePrices.Data)
                {
                    try
                    {
                        // Skip if price is in use (in database or active subscriptions)
                        if (dbPriceIds.Contains(price.Id))
                        {
                            result.PricesKept++;
                            continue;
                        }

                        // Check if price is used in any active subscriptions
                        var subscriptionService = new Stripe.SubscriptionService();
                        var subscriptionOptions = new SubscriptionListOptions
                        {
                            Price = price.Id,
                            Limit = 1
                        };

                        var subscriptionsUsingPrice = await subscriptionService.ListAsync(subscriptionOptions);
                        if (subscriptionsUsingPrice.Data.Any())
                        {
                            result.PricesKept++;
                            result.Warnings.Add($"Price {price.Id} is used by active subscriptions, keeping it");
                            continue;
                        }

                        // Check if this is a duplicate price (same product, amount, interval)
                        // and we have a newer price in the database for this product
                        var priceGroup = priceGroups.FirstOrDefault(g => 
                            g.Key.ProductId == price.ProductId &&
                            g.Key.Amount == (price.UnitAmountDecimal ?? 0) &&
                            g.Key.Interval == (price.Recurring?.Interval ?? "one_time"));

                        if (priceGroup != null && priceGroup.Count() > 1)
                        {
                            // Check if any price in this group is in the database
                            var hasPriceInDb = priceGroup.Any(p => dbPriceIds.Contains(p.Id));
                            
                            if (hasPriceInDb && !dbPriceIds.Contains(price.Id))
                            {
                                // This is a duplicate - we have a newer price in DB, safe to delete
                                var deletedPrice = await priceService.UpdateAsync(price.Id, new PriceUpdateOptions
                                {
                                    Active = false
                                });

                                result.PricesDeleted++;
                                result.DeletedPriceIds.Add(price.Id);
                                _logger.LogInformation("Deleted duplicate unused price {PriceId} (Amount: {Amount}, Interval: {Interval}) - newer price exists in database", 
                                    price.Id, price.UnitAmountDecimal, price.Recurring?.Interval);
                                continue;
                            }
                        }

                        // Delete the unused price (not in database, not in subscriptions, not a duplicate we're keeping)
                        var deletedPrice2 = await priceService.UpdateAsync(price.Id, new PriceUpdateOptions
                        {
                            Active = false
                        });

                        result.PricesDeleted++;
                        result.DeletedPriceIds.Add(price.Id);
                        _logger.LogInformation("Deleted unused price {PriceId} (Amount: {Amount}, Interval: {Interval})", 
                            price.Id, price.UnitAmountDecimal, price.Recurring?.Interval);
                    }
                    catch (StripeException ex)
                    {
                        result.Errors.Add($"Error deleting price {price.Id}: {ex.Message}");
                        _logger.LogError(ex, "Stripe error deleting price {PriceId}", price.Id);
                    }
                    catch (Exception ex)
                    {
                        result.Errors.Add($"Error processing price {price.Id}: {ex.Message}");
                        _logger.LogError(ex, "Error processing price {PriceId}", price.Id);
                    }
                }

                response.Data = result;
                response.Success = true;
                response.Message = $"Cleanup completed: {result.PricesDeleted} deleted, {result.PricesKept} kept out of {result.TotalPricesChecked} checked";
                
                _logger.LogInformation("Price cleanup completed: {Deleted} deleted, {Kept} kept", 
                    result.PricesDeleted, result.PricesKept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cleaning up unused Stripe prices");
                response.Success = false;
                response.Message = $"Error cleaning up prices: {ex.Message}";
                response.Data = result;
            }

            return response;
        }

        public async Task<ServiceResponse<StripeSyncResultDto>> ProvisionMissingStripeProductsAsync()
        {
            var response = new ServiceResponse<StripeSyncResultDto>();
            var result = new StripeSyncResultDto();

            try
            {
                if (string.IsNullOrWhiteSpace(_stripeSecretKey))
                {
                    result.Errors.Add("Stripe secret key is not configured");
                    response.Success = false;
                    response.Data = result;
                    return response;
                }

                // Only provision active, paid, non-trial plans that are missing a Stripe product
                var plans = await _context.SubscriptionPlans
                    .Where(p => p.IsActive && !p.IsTrial && p.MonthlyPrice > 0 && string.IsNullOrEmpty(p.StripeProductId))
                    .ToListAsync();

                result.TotalPlansFound = plans.Count;

                if (plans.Count == 0)
                {
                    response.Success = true;
                    response.Data = result;
                    response.Message = "All paid plans already have Stripe products — nothing to provision.";
                    return response;
                }

                var productService = new ProductService();
                var priceService = new PriceService();

                foreach (var plan in plans)
                {
                    var detail = new PlanSyncDetailDto { PlanName = plan.Name };

                    try
                    {
                        // Create Stripe product
                        var product = await productService.CreateAsync(new ProductCreateOptions
                        {
                            Name = plan.Name,
                            Description = plan.Description,
                            Metadata = new Dictionary<string, string>
                            {
                                { "planName", plan.Name },
                                { "planId", plan.Id.ToString() }
                            }
                        });

                        plan.StripeProductId = product.Id;
                        detail.StripeProductId = product.Id;
                        detail.StripeProductName = product.Name;

                        // Create monthly price
                        if (plan.MonthlyPrice > 0)
                        {
                            var monthlyPrice = await priceService.CreateAsync(new PriceCreateOptions
                            {
                                Product = product.Id,
                                UnitAmountDecimal = plan.MonthlyPrice * 100, // Stripe uses cents
                                Currency = "usd",
                                Recurring = new PriceRecurringOptions { Interval = "month" },
                                Nickname = $"{plan.Name} Monthly",
                                Metadata = new Dictionary<string, string> { { "planName", plan.Name }, { "billingCycle", "Monthly" } }
                            });

                            plan.StripePriceIdMonthly = monthlyPrice.Id;
                            detail.StripePriceIdMonthly = monthlyPrice.Id;
                        }

                        // Create annual price
                        if (plan.AnnualPrice > 0)
                        {
                            var annualPrice = await priceService.CreateAsync(new PriceCreateOptions
                            {
                                Product = product.Id,
                                UnitAmountDecimal = plan.AnnualPrice * 100,
                                Currency = "usd",
                                Recurring = new PriceRecurringOptions { Interval = "year" },
                                Nickname = $"{plan.Name} Annual",
                                Metadata = new Dictionary<string, string> { { "planName", plan.Name }, { "billingCycle", "Annual" } }
                            });

                            plan.StripePriceIdAnnual = annualPrice.Id;
                            detail.StripePriceIdAnnual = annualPrice.Id;
                        }

                        plan.UpdatedAt = DateTime.UtcNow;
                        detail.Matched = true;
                        detail.Updated = true;
                        detail.Message = $"Created Stripe product {product.Id} with monthly and annual prices.";
                        result.PlansMatched++;
                        result.PlansUpdated++;

                        _logger.LogInformation("Provisioned Stripe product {ProductId} for plan '{PlanName}'", product.Id, plan.Name);
                    }
                    catch (StripeException ex)
                    {
                        detail.Matched = false;
                        detail.Message = $"Stripe error: {ex.Message}";
                        result.Errors.Add($"Plan '{plan.Name}': {ex.Message}");
                        _logger.LogError(ex, "Stripe error provisioning product for plan '{PlanName}'", plan.Name);
                    }

                    result.Details.Add(detail);
                }

                await _context.SaveChangesAsync();

                response.Success = result.Errors.Count == 0;
                response.Data = result;
                response.Message = $"Provisioned {result.PlansUpdated} plan(s). {result.Errors.Count} error(s).";

                _logger.LogInformation("Stripe provisioning complete: {Updated} provisioned, {Errors} errors",
                    result.PlansUpdated, result.Errors.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error provisioning Stripe products");
                result.Errors.Add($"Error: {ex.Message}");
                response.Success = false;
                response.Data = result;
                response.Message = $"Error during provisioning: {ex.Message}";
            }

            return response;
        }
    }
}

