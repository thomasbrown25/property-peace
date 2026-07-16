using brownstone_hub_api.Dtos.ActionSuppression;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.ActionSuppressions;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.ActionSuppressionService
{
    public class ActionSuppressionService(
        IActionSuppressionRepository suppressionRepository,
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        ITenantRepository tenantRepository,
        ILogger<ActionSuppressionService> logger) : IActionSuppressionService
    {
        private readonly IActionSuppressionRepository _suppressionRepository = suppressionRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly ILogger<ActionSuppressionService> _logger = logger;

        public async Task<LoadActionSuppressionDto> CreateSuppression(AddActionSuppressionDto suppression, long organizationId, long createdBy)
        {
            return await _suppressionRepository.CreateSuppression(suppression, organizationId, createdBy);
        }

        public async Task<bool> IsActionSuppressed(string actionType, long entityId, long organizationId)
        {
            var suppression = await _suppressionRepository.GetSuppressionByActionAndEntity(actionType, entityId, organizationId);
            return suppression != null;
        }

        public async Task<int> CleanupExpiredSuppressions(long organizationId)
        {
            return await _suppressionRepository.DeleteExpiredSuppressions(organizationId);
        }

        public async Task<int> CleanupResolvedIssues(long organizationId)
        {
            var activeSuppressions = await _suppressionRepository.GetActiveSuppressionsByOrganization(organizationId);
            var deletedCount = 0;

            foreach (var suppression in activeSuppressions)
            {
                bool isResolved = false;

                try
                {
                    switch (suppression.ActionType)
                    {
                        case "sendAIFollowUp_OverdueRent":
                            // Check if rent is no longer overdue (draft leases do not count as overdue)
                            var lease = await _leaseRepository.GetLeaseById(suppression.EntityId, organizationId);
                            if (lease != null)
                            {
                                if (lease.LeaseAgreement?.IsDrafted == true)
                                    isResolved = true;
                                else
                                {
                                    var payments = await _paymentRepository.GetRentPaymentsByLeaseId(suppression.EntityId);
                                    var status = RentCalculator.GetStatus(lease, payments);
                                    isResolved = status != ERentStatus.Overdue;
                                }
                            }
                            break;

                        case "sendAIFollowUp_TenantAccount":
                            // Check if tenant now has an account
                            var tenant = await _tenantRepository.GetTenantById(suppression.EntityId);
                            if (tenant != null && tenant.UserId.HasValue)
                            {
                                isResolved = true;
                            }
                            break;

                        case "sendAIFollowUp_LeaseSigning":
                            // Check if lease is now signed
                            var leaseForSigning = await _leaseRepository.GetLeaseById(suppression.EntityId, organizationId);
                            if (leaseForSigning != null && leaseForSigning.LeaseAgreement?.SignatureStatus == ESignatureStatus.Completed)
                            {
                                isResolved = true;
                            }
                            break;
                    }

                    if (isResolved)
                    {
                        await _suppressionRepository.DeleteSuppression(suppression.Id);
                        deletedCount++;
                        _logger.LogInformation("Deleted resolved suppression {SuppressionId} for action {ActionType} on entity {EntityId}",
                            suppression.Id, suppression.ActionType, suppression.EntityId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error checking if suppression {SuppressionId} is resolved", suppression.Id);
                }
            }

            return deletedCount;
        }

        public async Task<List<LoadActionSuppressionDto>> GetActiveSuppressionsByOrganization(long organizationId)
        {
            return await _suppressionRepository.GetActiveSuppressionsByOrganization(organizationId);
        }

        public async Task<int> DeleteSuppressionsByEntityId(long entityId, string actionType)
        {
            return await _suppressionRepository.DeleteSuppressionsByEntityId(entityId, actionType);
        }
    }
}
