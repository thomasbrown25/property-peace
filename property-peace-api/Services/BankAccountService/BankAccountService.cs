using AutoMapper;
using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Repositories.BankAccounts;
using brownstone_hub_api.Utils;
using Stripe;

namespace brownstone_hub_api.Services.BankAccountService
{
    public class BankAccountService : IBankAccountService
    {
        private readonly IBankAccountRepository _bankAccountRepository;
        private readonly IMapper _mapper;
        private readonly ILogger<BankAccountService> _logger;

        public BankAccountService(
            IBankAccountRepository bankAccountRepository,
            IMapper mapper,
            ILogger<BankAccountService> logger)
        {
            _bankAccountRepository = bankAccountRepository;
            _mapper = mapper;
            _logger = logger;
        }

        public async Task<ServiceResponse<List<LoadBankAccountDto>>> GetBankAccountsByOrganizationIdAsync(long organizationId)
        {
            var response = new ServiceResponse<List<LoadBankAccountDto>>();

            try
            {
                var bankAccounts = await _bankAccountRepository.GetBankAccountsByOrganizationIdAsync(organizationId);
                var dtos = new List<LoadBankAccountDto>();

                foreach (var ba in bankAccounts)
                {
                    var dto = _mapper.Map<LoadBankAccountDto>(ba);
                    
                    // Set AccountName from DisplayName for frontend compatibility
                    dto.AccountName = dto.DisplayName;
                    
                    // Fetch account name and bank account details from Stripe if we have a Stripe account ID
                    if (!string.IsNullOrEmpty(ba.StripeAccountId))
                    {
                        try
                        {
                            var accountService = new Stripe.AccountService();
                            var stripeAccount = await accountService.GetAsync(ba.StripeAccountId);
                            
                            // Get account name from Stripe - try business name, display name, or email
                            var accountName = stripeAccount.BusinessProfile?.Name 
                                ?? stripeAccount.Settings?.Dashboard?.DisplayName 
                                ?? stripeAccount.Email 
                                ?? null;
                            
                            if (!string.IsNullOrEmpty(accountName))
                            {
                                // Update DisplayName if it's empty or set to default
                                if (string.IsNullOrEmpty(dto.DisplayName) || dto.DisplayName == "Unnamed Account")
                                {
                                    dto.DisplayName = accountName;
                                }
                                // Also set AccountName for frontend compatibility
                                dto.AccountName = accountName;
                            }
                            
                            // Fetch external accounts (bank accounts) to get last 4 digits
                            try
                            {
                                // Get external accounts from the Stripe account object
                                if (stripeAccount.ExternalAccounts != null && stripeAccount.ExternalAccounts.Data != null && stripeAccount.ExternalAccounts.Data.Count > 0)
                                {
                                    // Get the first bank account (external account of type "bank_account")
                                    var bankAccount = stripeAccount.ExternalAccounts.Data.FirstOrDefault(ea => ea is Stripe.BankAccount) as Stripe.BankAccount;
                                    if (bankAccount != null)
                                    {
                                        // Update Last4 if not already set
                                        if (string.IsNullOrEmpty(dto.Last4) && !string.IsNullOrEmpty(bankAccount.Last4))
                                        {
                                            dto.Last4 = bankAccount.Last4;
                                        }
                                        
                                        // Update BankName if not already set
                                        if (string.IsNullOrEmpty(dto.BankName) && !string.IsNullOrEmpty(bankAccount.BankName))
                                        {
                                            dto.BankName = bankAccount.BankName;
                                        }
                                        
                                        // Update AccountType if not already set
                                        if (string.IsNullOrEmpty(dto.AccountType) && !string.IsNullOrEmpty(bankAccount.AccountType))
                                        {
                                            dto.AccountType = bankAccount.AccountType;
                                        }
                                    }
                                }
                            }
                            catch (StripeException ex)
                            {
                                _logger.LogWarning(ex, "Failed to fetch external accounts for Stripe account {StripeAccountId}", ba.StripeAccountId);
                                // Continue without updating bank account details
                            }
                        }
                        catch (StripeException ex)
                        {
                            _logger.LogWarning(ex, "Failed to fetch Stripe account details for account {StripeAccountId}", ba.StripeAccountId);
                            // Continue without updating the name
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Error fetching Stripe account name for {StripeAccountId}", ba.StripeAccountId);
                            // Continue without updating the name
                        }
                    }
                    
                    dtos.Add(dto);
                }

                response.Data = dtos;
                response.Message = "Bank accounts retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bank accounts for organization {OrganizationId}", organizationId);
                response.Success = false;
                response.Message = $"Error getting bank accounts: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadBankAccountDto>> GetBankAccountByIdAsync(long id)
        {
            var response = new ServiceResponse<LoadBankAccountDto>();

            try
            {
                var bankAccount = await _bankAccountRepository.GetBankAccountByIdAsync(id);
                if (bankAccount == null)
                {
                    response.Success = false;
                    response.Message = "Bank account not found";
                    return response;
                }

                response.Data = _mapper.Map<LoadBankAccountDto>(bankAccount);
                response.Message = "Bank account retrieved successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting bank account {Id}", id);
                response.Success = false;
                response.Message = $"Error getting bank account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadBankAccountDto>> CreateBankAccountAsync(CreateBankAccountDto bankAccountDto)
        {
            var response = new ServiceResponse<LoadBankAccountDto>();

            try
            {
                var bankAccount = await _bankAccountRepository.AddBankAccountAsync(bankAccountDto);
                response.Data = _mapper.Map<LoadBankAccountDto>(bankAccount);
                response.Message = "Bank account created successfully";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating bank account");
                response.Success = false;
                response.Message = $"Error creating bank account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<LoadBankAccountDto>> UpdateBankAccountAsync(UpdateBankAccountDto bankAccountDto)
        {
            var response = new ServiceResponse<LoadBankAccountDto>();

            try
            {
                var bankAccount = await _bankAccountRepository.UpdateBankAccountAsync(bankAccountDto);
                response.Data = _mapper.Map<LoadBankAccountDto>(bankAccount);
                response.Message = "Bank account updated successfully";
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Bank account not found for update");
                response.Success = false;
                response.Message = ex.Message;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating bank account {Id}", bankAccountDto.Id);
                response.Success = false;
                response.Message = $"Error updating bank account: {ex.Message}";
            }

            return response;
        }

        public async Task<ServiceResponse<bool>> DeleteBankAccountAsync(long id)
        {
            var response = new ServiceResponse<bool>();

            try
            {
                var result = await _bankAccountRepository.DeleteBankAccountAsync(id);
                response.Data = result;
                response.Message = result ? "Bank account deleted successfully" : "Bank account not found";
                response.Success = result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting bank account {Id}", id);
                response.Success = false;
                response.Message = $"Error deleting bank account: {ex.Message}";
            }

            return response;
        }
    }
}

