using AutoMapper;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Services.StripeService;

namespace brownstone_hub_api.Services.SubscriptionService
{
    public class SubscriptionPlanService : ISubscriptionPlanService
    {
        private readonly ISubscriptionPlanRepository _planRepository;
        private readonly IStripeService _stripeService;
        private readonly IStripeSyncService _stripeSyncService;
        private readonly IMapper _mapper;
        private readonly ILogger<SubscriptionPlanService> _logger;

        public SubscriptionPlanService(
            ISubscriptionPlanRepository planRepository,
            IStripeService stripeService,
            IStripeSyncService stripeSyncService,
            IMapper mapper,
            ILogger<SubscriptionPlanService> logger)
        {
            _planRepository = planRepository;
            _stripeService = stripeService;
            _stripeSyncService = stripeSyncService;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ServiceResponse<List<SubscriptionPlanDto>>> GetAllPlansAsync()
        {
            var response = new ServiceResponse<List<SubscriptionPlanDto>>();
            
            try
            {
                var plans = await _planRepository.GetAllPlansAsync();
                var planDtos = plans
                    .Where(plan => !string.Equals(plan.Name, "Lifetime Plan", StringComparison.OrdinalIgnoreCase))
                    .Select(plan =>
                {
                    var dto = _mapper.Map<SubscriptionPlanDto>(plan);
                    // Calculate annual discount
                    if (plan.MonthlyPrice > 0 && plan.AnnualPrice > 0)
                    {
                        var monthlyAnnual = plan.MonthlyPrice * 12;
                        if (monthlyAnnual > plan.AnnualPrice)
                        {
                            dto.AnnualDiscount = ((monthlyAnnual - plan.AnnualPrice) / monthlyAnnual) * 100;
                        }
                    }
                    return dto;
                }).ToList();

                response.Data = planDtos;
                response.Message = "Plans retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all subscription plans");
                response.Success = false;
                response.Message = $"Error retrieving plans: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionPlanDto>> GetPlanByIdAsync(long planId)
        {
            var response = new ServiceResponse<SubscriptionPlanDto>();
            
            try
            {
                var plan = await _planRepository.GetPlanByIdAsync(planId);
                if (plan == null)
                {
                    response.Success = false;
                    response.Message = "Plan not found";
                    response.StatusCode = 404;
                    return response;
                }

                var dto = _mapper.Map<SubscriptionPlanDto>(plan);
                // Calculate annual discount
                if (plan.MonthlyPrice > 0 && plan.AnnualPrice > 0)
                {
                    var monthlyAnnual = plan.MonthlyPrice * 12;
                    if (monthlyAnnual > plan.AnnualPrice)
                    {
                        dto.AnnualDiscount = ((monthlyAnnual - plan.AnnualPrice) / monthlyAnnual) * 100;
                    }
                }

                response.Data = dto;
                response.Message = "Plan retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting subscription plan {PlanId}", planId);
                response.Success = false;
                response.Message = $"Error retrieving plan: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionPlanDto>> CreatePlanAsync(SubscriptionPlanDto planDto)
        {
            var response = new ServiceResponse<SubscriptionPlanDto>();
            
            try
            {
                var plan = _mapper.Map<SubscriptionPlan>(planDto);
                var createdPlan = await _planRepository.CreatePlanAsync(plan);
                var dto = _mapper.Map<SubscriptionPlanDto>(createdPlan);
                
                response.Data = dto;
                response.Message = "Plan created successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating subscription plan");
                response.Success = false;
                response.Message = $"Error creating plan: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<SubscriptionPlanDto>> UpdatePlanAsync(long planId, SubscriptionPlanDto planDto)
        {
            var response = new ServiceResponse<SubscriptionPlanDto>();
            
            try
            {
                var existingPlan = await _planRepository.GetPlanByIdAsync(planId);
                if (existingPlan == null)
                {
                    response.Success = false;
                    response.Message = "Plan not found";
                    response.StatusCode = 404;
                    return response;
                }

                // Sync product name/description to Stripe if product ID exists
                if (!string.IsNullOrWhiteSpace(existingPlan.StripeProductId) && 
                    (!string.IsNullOrWhiteSpace(planDto.Name) || !string.IsNullOrWhiteSpace(planDto.Description)))
                {
                    try
                    {
                        var productResponse = await _stripeService.UpdateProductAsync(
                            existingPlan.StripeProductId,
                            planDto.Name,
                            planDto.Description
                        );
                        
                        if (!productResponse.Success)
                        {
                            _logger.LogWarning("Failed to update Stripe product {ProductId}: {Message}", 
                                existingPlan.StripeProductId, productResponse.Message);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error syncing product to Stripe, continuing with database update");
                    }
                }

                // If prices changed and product ID exists, create new Stripe prices
                bool monthlyPriceChanged = existingPlan.MonthlyPrice != planDto.MonthlyPrice;
                bool annualPriceChanged = existingPlan.AnnualPrice != planDto.AnnualPrice;
                
                if (!string.IsNullOrWhiteSpace(existingPlan.StripeProductId) && (monthlyPriceChanged || annualPriceChanged))
                {
                    try
                    {
                        if (monthlyPriceChanged && planDto.MonthlyPrice > 0)
                        {
                            var monthlyPriceResponse = await _stripeService.CreatePriceAsync(
                                existingPlan.StripeProductId,
                                planDto.MonthlyPrice,
                                "usd",
                                "month"
                            );
                            
                            if (monthlyPriceResponse.Success && monthlyPriceResponse.Data != null)
                            {
                                planDto.StripePriceIdMonthly = monthlyPriceResponse.Data.Id;
                                _logger.LogInformation("Created new monthly price {PriceId} for plan {PlanId}", 
                                    monthlyPriceResponse.Data.Id, planId);
                            }
                        }

                        if (annualPriceChanged && planDto.AnnualPrice > 0)
                        {
                            var annualPriceResponse = await _stripeService.CreatePriceAsync(
                                existingPlan.StripeProductId,
                                planDto.AnnualPrice,
                                "usd",
                                "year"
                            );
                            
                            if (annualPriceResponse.Success && annualPriceResponse.Data != null)
                            {
                                planDto.StripePriceIdAnnual = annualPriceResponse.Data.Id;
                                _logger.LogInformation("Created new annual price {PriceId} for plan {PlanId}", 
                                    annualPriceResponse.Data.Id, planId);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error creating new Stripe prices, continuing with database update");
                    }
                }

                _mapper.Map(planDto, existingPlan);
                var updatedPlan = await _planRepository.UpdatePlanAsync(existingPlan);
                
                // If prices changed, sync Stripe IDs to ensure we have the latest Price IDs
                // This is especially important if new prices were created in Stripe
                if (monthlyPriceChanged || annualPriceChanged)
                {
                    try
                    {
                        _logger.LogInformation("Prices changed for plan {PlanId}, syncing Stripe IDs", planId);
                        var syncResponse = await _stripeSyncService.SyncPlansFromStripeAsync();
                        if (syncResponse.Success)
                        {
                            _logger.LogInformation("Stripe sync completed: {PlansUpdated} plans updated", 
                                syncResponse.Data?.PlansUpdated ?? 0);
                            
                            // Reload the plan to get any updated Stripe IDs from sync
                            updatedPlan = await _planRepository.GetPlanByIdAsync(planId);
                        }
                        else
                        {
                            _logger.LogWarning("Stripe sync failed after price update: {Message}", syncResponse.Message);
                        }
                    }
                    catch (Exception ex)
                    {
                        // Don't fail the update if sync fails - log and continue
                        _logger.LogWarning(ex, "Error syncing Stripe IDs after price update, but plan was updated successfully");
                    }
                }
                
                var dto = _mapper.Map<SubscriptionPlanDto>(updatedPlan);
                
                response.Data = dto;
                response.Message = "Plan updated successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating subscription plan {PlanId}", planId);
                response.Success = false;
                response.Message = $"Error updating plan: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> DeactivatePlanAsync(long planId)
        {
            var response = new ServiceResponse<bool>();
            
            try
            {
                var plan = await _planRepository.GetPlanByIdAsync(planId);
                if (plan == null)
                {
                    response.Success = false;
                    response.Message = "Plan not found";
                    response.StatusCode = 404;
                    return response;
                }

                plan.IsActive = false;
                await _planRepository.UpdatePlanAsync(plan);
                
                response.Data = true;
                response.Message = "Plan deactivated successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deactivating subscription plan {PlanId}", planId);
                response.Success = false;
                response.Message = $"Error deactivating plan: {ex.Message}";
            }

            return response;
        }
    }
}

