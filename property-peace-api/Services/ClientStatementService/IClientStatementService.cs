
using brownstone_hub_api.Dtos.ClientStatement;

namespace brownstone_hub_api.Services.ClientStatementService
{
    public interface IClientStatementService
    {
        Task<ServiceResponse<ClientStatementDto>> GenerateClientStatement(long clientId, long propertyId, DateTime startDate, DateTime endDate);
        Task<ServiceResponse<List<ClientStatementDto>>> GetClientStatements(long clientId, DateTime? startDate = null, DateTime? endDate = null);
        Task<ServiceResponse<ClientFinancialSummaryDto>> GetClientFinancialSummary(long clientId, DateTime? startDate = null, DateTime? endDate = null);
    }
}
