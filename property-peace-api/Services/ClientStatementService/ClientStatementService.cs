
using brownstone_hub_api.Dtos.ClientStatement;
using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Repositories.Clients;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Payments;

namespace brownstone_hub_api.Services.ClientStatementService
{
    public class ClientStatementService(
        IClientRepository clientRepository,
        IPropertyRepository propertyRepository,
        IExpenseRepository expenseRepository,
        IPaymentRepository paymentRepository,
        ILogger<ClientStatementService> logger) : IClientStatementService
    {
        private readonly IClientRepository _clientRepository = clientRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly ILogger<ClientStatementService> _logger = logger;

        public async Task<ServiceResponse<ClientStatementDto>> GenerateClientStatement(
            long clientId, 
            long propertyId, 
            DateTime startDate, 
            DateTime endDate)
        {
            try
            {
                // Get client
                var client = await _clientRepository.GetClientById(clientId);
                if (client == null)
                {
                    return ServiceResponse<ClientStatementDto>.CreateError("Client not found", "The specified client does not exist.");
                }

                // Get property
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null)
                {
                    return ServiceResponse<ClientStatementDto>.CreateError("Property not found", "The specified property does not exist.");
                }

                // Verify property belongs to client
                if (property.ClientId != clientId)
                {
                    return ServiceResponse<ClientStatementDto>.CreateError("Invalid property", "The specified property does not belong to this client.");
                }

                // Get organization ID from property
                if (!property.OrganizationId.HasValue)
                {
                    return ServiceResponse<ClientStatementDto>.CreateError("Invalid property", "Property must belong to an organization.");
                }

                var organizationId = property.OrganizationId.Value;

                // Get expenses for this property
                var expenses = await _expenseRepository.GetExpensesByOrganizationId(
                    organizationId, propertyId, startDate, endDate, null, null);

                // Get payments (income) for this property
                var payments = await _paymentRepository.GetPaymentsByPropertyId(propertyId, startDate, endDate);

                // Calculate management fee
                decimal managementFee = 0;
                string? managementFeeType = null;
                if (client.ManagementFeePercentage.HasValue)
                {
                    var totalIncome = payments.Sum(p => p.Amount);
                    managementFee = totalIncome * (client.ManagementFeePercentage.Value / 100);
                    managementFeeType = "Percentage";
                }
                else if (client.ManagementFeeFlat.HasValue)
                {
                    managementFee = client.ManagementFeeFlat.Value;
                    managementFeeType = "Flat";
                }

                // Build statement
                var statement = new ClientStatementDto
                {
                    Id = propertyId, // Using property ID as statement ID for now
                    PropertyId = propertyId,
                    PropertyName = property.Name,
                    PropertyAddress = $"{property.StreetAddress}, {property.City}, {property.State} {property.ZipCode}",
                    ClientId = clientId,
                    ClientName = $"{client.FirstName} {client.LastName}",
                    StartDate = startDate,
                    EndDate = endDate,
                    TotalIncome = payments.Sum(p => p.Amount),
                    IncomeItems = payments.Select(p => new ClientStatementIncomeItem
                    {
                        Date = p.PaymentDate,
                        Description = $"Rent Payment - {p.UnitName ?? "Unit"}",
                        Amount = p.Amount,
                        UnitName = p.UnitName
                    }).ToList(),
                    TotalExpenses = expenses.Sum(e => e.Amount),
                    ExpenseItems = expenses.Select(e => new ClientStatementExpenseItem
                    {
                        Date = e.ExpenseDate,
                        Description = e.Name,
                        Category = e.Category,
                        Amount = e.Amount,
                        Vendor = e.VendorName ?? e.Vendor
                    }).ToList(),
                    ManagementFee = managementFee,
                    ManagementFeeType = managementFeeType,
                    NetIncome = payments.Sum(p => p.Amount) - expenses.Sum(e => e.Amount) - managementFee,
                    ReserveFundBalance = 0 // TODO: Implement reserve fund tracking
                };

                return new ServiceResponse<ClientStatementDto>
                {
                    Success = true,
                    Data = statement,
                    Message = "Client statement generated successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating client statement for client {ClientId}, property {PropertyId}", clientId, propertyId);
                return ServiceResponse<ClientStatementDto>.CreateError("Error generating client statement", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<ClientStatementDto>>> GetClientStatements(
            long clientId, 
            DateTime? startDate = null, 
            DateTime? endDate = null)
        {
            try
            {
                var client = await _clientRepository.GetClientById(clientId);
                if (client == null)
                {
                    return ServiceResponse<List<ClientStatementDto>>.CreateError("Client not found", "The specified client does not exist.");
                }

                // Get all properties for this client
                var propertyIds = await _clientRepository.GetPropertiesByClientId(clientId);
                
                var statements = new List<ClientStatementDto>();
                
                foreach (var propertyId in propertyIds)
                {
                    var property = await _propertyRepository.GetPropertyById(propertyId);
                    if (property == null || !property.OrganizationId.HasValue)
                        continue;

                    var start = startDate ?? DateTime.Now.AddMonths(-1).Date;
                    var end = endDate ?? DateTime.Now.Date;

                    var statementResponse = await GenerateClientStatement(clientId, propertyId, start, end);
                    if (statementResponse.Success && statementResponse.Data != null)
                    {
                        statements.Add(statementResponse.Data);
                    }
                }

                return new ServiceResponse<List<ClientStatementDto>>
                {
                    Success = true,
                    Data = statements,
                    Message = "Client statements retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving client statements for client {ClientId}", clientId);
                return ServiceResponse<List<ClientStatementDto>>.CreateError("Error retrieving client statements", ex.Message);
            }
        }

        public async Task<ServiceResponse<ClientFinancialSummaryDto>> GetClientFinancialSummary(
            long clientId, 
            DateTime? startDate = null, 
            DateTime? endDate = null)
        {
            try
            {
                var client = await _clientRepository.GetClientById(clientId);
                if (client == null)
                {
                    return ServiceResponse<ClientFinancialSummaryDto>.CreateError("Client not found", "The specified client does not exist.");
                }

                var start = startDate ?? DateTime.Now.AddMonths(-1).Date;
                var end = endDate ?? DateTime.Now.Date;

                // Get all properties for this client
                var propertyIds = await _clientRepository.GetPropertiesByClientId(clientId);
                
                var propertySummaries = new List<ClientPropertySummary>();
                decimal totalIncome = 0;
                decimal totalExpenses = 0;
                decimal totalManagementFees = 0;

                foreach (var propertyId in propertyIds)
                {
                    var property = await _propertyRepository.GetPropertyById(propertyId);
                    if (property == null || !property.OrganizationId.HasValue)
                        continue;

                    var organizationId = property.OrganizationId.Value;

                    // Get income
                    var payments = await _paymentRepository.GetPaymentsByPropertyId(propertyId, start, end);
                    var income = payments.Sum(p => p.Amount);

                    // Get expenses
                    var expenses = await _expenseRepository.GetExpensesByOrganizationId(
                        organizationId, propertyId, start, end, null, null);
                    var propertyExpenses = expenses.Sum(e => e.Amount);

                    // Calculate management fee
                    decimal managementFee = 0;
                    if (client.ManagementFeePercentage.HasValue)
                    {
                        managementFee = income * (client.ManagementFeePercentage.Value / 100);
                    }
                    else if (client.ManagementFeeFlat.HasValue)
                    {
                        managementFee = client.ManagementFeeFlat.Value;
                    }

                    var netIncome = income - propertyExpenses - managementFee;

                    propertySummaries.Add(new ClientPropertySummary
                    {
                        PropertyId = propertyId,
                        PropertyName = property.Name,
                        Income = income,
                        Expenses = propertyExpenses,
                        ManagementFee = managementFee,
                        NetIncome = netIncome
                    });

                    totalIncome += income;
                    totalExpenses += propertyExpenses;
                    totalManagementFees += managementFee;
                }

                var summary = new ClientFinancialSummaryDto
                {
                    ClientId = clientId,
                    ClientName = $"{client.FirstName} {client.LastName}",
                    StartDate = start,
                    EndDate = end,
                    TotalIncome = totalIncome,
                    TotalExpenses = totalExpenses,
                    TotalManagementFees = totalManagementFees,
                    NetIncome = totalIncome - totalExpenses - totalManagementFees,
                    Properties = propertySummaries
                };

                return new ServiceResponse<ClientFinancialSummaryDto>
                {
                    Success = true,
                    Data = summary,
                    Message = "Client financial summary retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving client financial summary for client {ClientId}", clientId);
                return ServiceResponse<ClientFinancialSummaryDto>.CreateError("Error retrieving client financial summary", ex.Message);
            }
        }
    }
}
