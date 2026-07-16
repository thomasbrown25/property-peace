using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.BackgroundCheck;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Applications;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.BackgroundCheckService
{
    public interface IBackgroundCheckService
    {
        Task<ServiceResponse<BackgroundCheckResultDto>> RequestBackgroundCheckAsync(long applicationId, string screeningPackage = "full");
        Task<ServiceResponse<BackgroundCheckResultDto>> GetBackgroundCheckStatusAsync(long applicationId);
        Task<bool> EvaluateBackgroundCheckResultsAsync(RentalApplication application, RentSpreeResponseDto rentSpreeResponse);
    }

    public class BackgroundCheckService : IBackgroundCheckService
    {
        private readonly IRentSpreeService _rentSpreeService;
        private readonly IApplicationRepository _applicationRepository;
        private readonly RentSpreeSettings _settings;
        private readonly ILogger<BackgroundCheckService> _logger;

        public BackgroundCheckService(
            IRentSpreeService rentSpreeService,
            IApplicationRepository applicationRepository,
            IOptions<RentSpreeSettings> settings,
            ILogger<BackgroundCheckService> logger)
        {
            _rentSpreeService = rentSpreeService;
            _applicationRepository = applicationRepository;
            _settings = settings.Value;
            _logger = logger;
        }

        public async Task<ServiceResponse<BackgroundCheckResultDto>> RequestBackgroundCheckAsync(long applicationId, string screeningPackage = "full")
        {
            try
            {
                var application = await _applicationRepository.GetApplicationById(applicationId);
                if (application == null)
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError("Application not found", "The specified application does not exist.", "", 404);
                }

                // Check if background check already requested
                if (application.BackgroundCheckRequested == true && !string.IsNullOrEmpty(application.BackgroundCheckRequestId))
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError("Background check already requested", "A background check has already been requested for this application.", "", 400);
                }

                // Validate required fields
                if (string.IsNullOrEmpty(application.FirstName) || string.IsNullOrEmpty(application.LastName) || string.IsNullOrEmpty(application.Email))
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError("Missing required information", "First name, last name, and email are required for background checks.", "", 400);
                }

                // Get entity to access SSN (sensitive data not in DTO)
                var applicationEntity = await _applicationRepository.GetApplicationEntityById(applicationId);
                if (applicationEntity == null)
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError("Application not found", "Failed to load application entity.", "", 404);
                }

                // Build RentSpree request
                var rentSpreeRequest = new RentSpreeRequestDto
                {
                    FirstName = application.FirstName,
                    LastName = application.LastName,
                    Email = application.Email,
                    Phone = application.PhoneNumber,
                    DateOfBirth = application.DateOfBirth?.ToString("yyyy-MM-dd"),
                    Ssn = applicationEntity.Ssn, // Note: SSN is sensitive and only available from entity
                    ScreeningPackage = screeningPackage,
                    MonthlyRent = null // Can be set if available from property/unit
                };

                // Add current address if available
                if (!string.IsNullOrEmpty(application.CurrentAddress))
                {
                    rentSpreeRequest.CurrentAddress = new RentSpreeAddressDto
                    {
                        Street = application.CurrentAddress,
                        City = application.CurrentCity ?? "",
                        State = application.CurrentState ?? "",
                        Zip = application.CurrentZipCode ?? ""
                    };
                }

                // Add employment information if available
                if (!string.IsNullOrEmpty(application.EmployerName) || application.MonthlyIncome.HasValue)
                {
                    rentSpreeRequest.Employment = new RentSpreeEmploymentDto
                    {
                        EmployerName = application.EmployerName,
                        JobTitle = application.JobTitle,
                        MonthlyIncome = application.MonthlyIncome,
                        EmploymentMonths = application.EmploymentMonths
                    };
                }

                // Request background check from RentSpree
                var rentSpreeResponse = await _rentSpreeService.RequestBackgroundCheckAsync(rentSpreeRequest);

                if (rentSpreeResponse.Status == "failed" || !string.IsNullOrEmpty(rentSpreeResponse.Error))
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError(
                        "Background check request failed",
                        rentSpreeResponse.Error ?? "Failed to request background check from RentSpree.",
                        "",
                        500);
                }

                // Update application with background check request info
                var updateDto = new UpdateRentalApplicationDto
                {
                    Id = applicationId,
                    BackgroundCheckRequested = true,
                    BackgroundCheckRequestedAt = DateTime.UtcNow,
                    BackgroundCheckProvider = "RentSpree",
                    BackgroundCheckRequestId = rentSpreeResponse.RequestId,
                    BackgroundCheckStatus = rentSpreeResponse.Status
                };

                await _applicationRepository.UpdateApplication(updateDto);

                var result = new BackgroundCheckResultDto
                {
                    ApplicationId = applicationId,
                    RequestId = rentSpreeResponse.RequestId,
                    Status = rentSpreeResponse.Status ?? "pending",
                    Message = "Background check requested successfully. Results will be available once processing is complete."
                };

                return ServiceResponse<BackgroundCheckResultDto>.CreateSuccess(result, "Background check requested successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error requesting background check for application {ApplicationId}", applicationId);
                return ServiceResponse<BackgroundCheckResultDto>.CreateError("Error requesting background check", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<BackgroundCheckResultDto>> GetBackgroundCheckStatusAsync(long applicationId)
        {
            try
            {
                var application = await _applicationRepository.GetApplicationById(applicationId);
                if (application == null)
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError("Application not found", "The specified application does not exist.", "", 404);
                }

                if (string.IsNullOrEmpty(application.BackgroundCheckRequestId))
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError("No background check requested", "No background check has been requested for this application.", "", 400);
                }

                // Get status from RentSpree
                var rentSpreeResponse = await _rentSpreeService.GetBackgroundCheckStatusAsync(application.BackgroundCheckRequestId);

                if (rentSpreeResponse.Status == "failed" || !string.IsNullOrEmpty(rentSpreeResponse.Error))
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError(
                        "Failed to get background check status",
                        rentSpreeResponse.Error ?? "Failed to retrieve background check status from RentSpree.",
                        "",
                        500);
                }

                // If completed, update application with results
                if (rentSpreeResponse.Status == "completed")
                {
                    await ProcessBackgroundCheckResultsAsync(applicationId, rentSpreeResponse);
                    // Reload application to get updated results
                    application = await _applicationRepository.GetApplicationById(applicationId);
                }
                else
                {
                    // Update status only
                    var updateDto = new UpdateRentalApplicationDto
                    {
                        Id = applicationId,
                        BackgroundCheckStatus = rentSpreeResponse.Status
                    };
                    await _applicationRepository.UpdateApplication(updateDto);
                    // Reload application to get updated status
                    application = await _applicationRepository.GetApplicationById(applicationId);
                }

                if (application == null)
                {
                    return ServiceResponse<BackgroundCheckResultDto>.CreateError("Application not found", "Failed to reload application after update.", "", 404);
                }

                var result = MapToBackgroundCheckResultDto(application, rentSpreeResponse);
                return ServiceResponse<BackgroundCheckResultDto>.CreateSuccess(result, "Background check status retrieved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting background check status for application {ApplicationId}", applicationId);
                return ServiceResponse<BackgroundCheckResultDto>.CreateError("Error getting background check status", ex.Message, ex.InnerException?.Message);
            }
        }

        private async Task ProcessBackgroundCheckResultsAsync(long applicationId, RentSpreeResponseDto rentSpreeResponse)
        {
            var applicationDto = await _applicationRepository.GetApplicationById(applicationId);
            if (applicationDto == null) return;
            
            // Get entity for evaluation
            var application = await _applicationRepository.GetApplicationEntityById(applicationId);
            if (application == null) return;

            // Evaluate results against criteria
            var overallPass = await EvaluateBackgroundCheckResultsAsync(application, rentSpreeResponse);

            // Build summary JSON
            var summary = new
            {
                CreditScore = rentSpreeResponse.CreditScore,
                CreditPassed = rentSpreeResponse.CreditReport?.Passed,
                CriminalPassed = rentSpreeResponse.CriminalCheck?.Passed,
                EvictionPassed = rentSpreeResponse.EvictionCheck?.Passed,
                IncomePassed = rentSpreeResponse.IncomeVerification?.Passed,
                OverallPass = overallPass,
                Recommendation = rentSpreeResponse.Summary?.Recommendation
            };

            var updateDto = new UpdateRentalApplicationDto
            {
                Id = applicationId,
                BackgroundCheckStatus = "completed",
                BackgroundCheckCompletedAt = rentSpreeResponse.CompletedAt ?? DateTime.UtcNow,
                CreditScore = rentSpreeResponse.CreditScore,
                PassedCreditCheck = rentSpreeResponse.CreditReport?.Passed,
                PassedCriminalCheck = rentSpreeResponse.CriminalCheck?.Passed,
                PassedEvictionCheck = rentSpreeResponse.EvictionCheck?.Passed,
                PassedIncomeVerification = rentSpreeResponse.IncomeVerification?.Passed,
                BackgroundCheckReportUrl = rentSpreeResponse.ReportUrl,
                BackgroundCheckSummary = JsonSerializer.Serialize(summary),
                BackgroundCheckOverallPass = overallPass,
                BackgroundCheckRejectionReason = overallPass == false ? rentSpreeResponse.Summary?.RejectionReason : null
            };

            await _applicationRepository.UpdateApplication(updateDto);

            // Auto-approve if configured and all checks pass
            if (overallPass == true && _settings.EnableBackgroundChecks)
            {
                // Note: Auto-approval logic can be added here if needed
                _logger.LogInformation("Background check passed for application {ApplicationId}. Consider auto-approval.", applicationId);
            }
        }

        public async Task<bool> EvaluateBackgroundCheckResultsAsync(Models.RentalApplication application, RentSpreeResponseDto rentSpreeResponse)
        {
            // Evaluate against configured criteria
            bool passed = true;
            var reasons = new List<string>();

            // Credit score check
            if (rentSpreeResponse.CreditScore.HasValue)
            {
                if (rentSpreeResponse.CreditScore.Value < _settings.MinimumCreditScore)
                {
                    passed = false;
                    reasons.Add($"Credit score {rentSpreeResponse.CreditScore.Value} is below minimum of {_settings.MinimumCreditScore}");
                }
            }
            else if (_settings.MinimumCreditScore > 0)
            {
                // If we have a minimum credit score requirement but no score is available, fail
                passed = false;
                reasons.Add("Credit score not available");
            }

            // Criminal check
            if (_settings.RequireCriminalCheck)
            {
                if (rentSpreeResponse.CriminalCheck?.Passed != true)
                {
                    passed = false;
                    reasons.Add("Criminal background check failed");
                }
            }

            // Eviction check
            if (_settings.RequireEvictionCheck)
            {
                if (rentSpreeResponse.EvictionCheck?.Passed != true)
                {
                    passed = false;
                    reasons.Add("Eviction check failed");
                }
            }

            // Income verification
            if (_settings.RequireIncomeVerification && application.MonthlyIncome.HasValue)
            {
                // Check if income verification passed from RentSpree
                if (rentSpreeResponse.IncomeVerification?.Passed != true)
                {
                    passed = false;
                    var incomeRatio = rentSpreeResponse.IncomeVerification?.IncomeToRentRatio;
                    if (incomeRatio.HasValue && incomeRatio.Value < _settings.MinimumIncomeToRentRatio)
                    {
                        reasons.Add($"Income to rent ratio {incomeRatio.Value:F2} is below minimum of {_settings.MinimumIncomeToRentRatio}");
                    }
                    else
                    {
                        reasons.Add("Income verification failed");
                    }
                }
                else if (rentSpreeResponse.IncomeVerification?.IncomeToRentRatio.HasValue == true)
                {
                    // Double-check the ratio even if RentSpree says it passed
                    if (rentSpreeResponse.IncomeVerification.IncomeToRentRatio.Value < _settings.MinimumIncomeToRentRatio)
                    {
                        passed = false;
                        reasons.Add($"Income to rent ratio {rentSpreeResponse.IncomeVerification.IncomeToRentRatio.Value:F2} is below minimum of {_settings.MinimumIncomeToRentRatio}");
                    }
                }
            }

            _logger.LogInformation("Background check evaluation for application {ApplicationId}: Passed={Passed}, Reasons={Reasons}",
                application.Id, passed, string.Join("; ", reasons));

            return passed;
        }

        private BackgroundCheckResultDto MapToBackgroundCheckResultDto(Dtos.Application.LoadRentalApplicationDto application, RentSpreeResponseDto rentSpreeResponse)
        {
            return new BackgroundCheckResultDto
            {
                ApplicationId = application.Id,
                RequestId = application.BackgroundCheckRequestId,
                Status = application.BackgroundCheckStatus ?? rentSpreeResponse.Status ?? "unknown",
                CreditScore = application.CreditScore ?? rentSpreeResponse.CreditScore,
                PassedCreditCheck = application.PassedCreditCheck ?? rentSpreeResponse.CreditReport?.Passed,
                PassedCriminalCheck = application.PassedCriminalCheck ?? rentSpreeResponse.CriminalCheck?.Passed,
                PassedEvictionCheck = application.PassedEvictionCheck ?? rentSpreeResponse.EvictionCheck?.Passed,
                PassedIncomeVerification = application.PassedIncomeVerification ?? rentSpreeResponse.IncomeVerification?.Passed,
                OverallPass = application.BackgroundCheckOverallPass,
                ReportUrl = application.BackgroundCheckReportUrl ?? rentSpreeResponse.ReportUrl,
                CompletedAt = application.BackgroundCheckCompletedAt ?? rentSpreeResponse.CompletedAt,
                RejectionReason = application.BackgroundCheckRejectionReason ?? rentSpreeResponse.Summary?.RejectionReason
            };
        }
    }

    public class BackgroundCheckResultDto
    {
        public long ApplicationId { get; set; }
        public string? RequestId { get; set; }
        public string Status { get; set; } = string.Empty;
        public int? CreditScore { get; set; }
        public bool? PassedCreditCheck { get; set; }
        public bool? PassedCriminalCheck { get; set; }
        public bool? PassedEvictionCheck { get; set; }
        public bool? PassedIncomeVerification { get; set; }
        public bool? OverallPass { get; set; }
        public string? ReportUrl { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? RejectionReason { get; set; }
        public string? Message { get; set; }
    }
}

