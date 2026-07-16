using brownstone_hub_api.Dtos.BankReconciliation;
using brownstone_hub_api.Services.BankReconciliationService;
using brownstone_hub_api.Services.OrganizationService;
using brownstone_hub_api.Services.UserService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/bank-reconciliation")]
    [Authorize(Roles = "Landlord,Admin")]
    public class BankReconciliationController : ControllerBase
    {
        private readonly IBankReconciliationService _bankReconciliationService;
        private readonly IOrganizationService _organizationService;
        private readonly IUserService _userService;
        private readonly ILogger<BankReconciliationController> _logger;

        public BankReconciliationController(
            IBankReconciliationService bankReconciliationService,
            IOrganizationService organizationService,
            IUserService userService,
            ILogger<BankReconciliationController> logger)
        {
            _bankReconciliationService = bankReconciliationService;
            _organizationService = organizationService;
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Upload bank statement
        /// </summary>
        [HttpPost("upload")]
        public async Task<IActionResult> UploadBankStatement([FromBody] UploadBankStatementDto statementDto)
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _bankReconciliationService.UploadBankStatementAsync(organizationId, statementDto);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading bank statement");
                return StatusCode(500, new { Message = "An error occurred while uploading bank statement" });
            }
        }

        /// <summary>
        /// Get unmatched bank transactions
        /// </summary>
        [HttpGet("unmatched-transactions")]
        public async Task<IActionResult> GetUnmatchedTransactions([FromQuery] long? bankStatementId = null)
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _bankReconciliationService.GetUnmatchedTransactionsAsync(organizationId, bankStatementId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unmatched transactions");
                return StatusCode(500, new { Message = "An error occurred while getting unmatched transactions" });
            }
        }

        /// <summary>
        /// Get unmatched ledger entries
        /// </summary>
        [HttpGet("unmatched-ledger-entries")]
        public async Task<IActionResult> GetUnmatchedLedgerEntries([FromQuery] DateTime? startDate = null, [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _bankReconciliationService.GetUnmatchedLedgerEntriesAsync(organizationId, startDate, endDate);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unmatched ledger entries");
                return StatusCode(500, new { Message = "An error occurred while getting unmatched ledger entries" });
            }
        }

        /// <summary>
        /// Match a bank transaction to a ledger entry
        /// </summary>
        [HttpPost("match")]
        public async Task<IActionResult> MatchTransaction([FromBody] MatchTransactionDto matchDto)
        {
            try
            {
                var response = await _bankReconciliationService.MatchTransactionAsync(matchDto.BankTransactionId, matchDto.LedgerEntryId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error matching transaction");
                return StatusCode(500, new { Message = "An error occurred while matching transaction" });
            }
        }

        /// <summary>
        /// Unmatch a bank transaction
        /// </summary>
        [HttpPost("unmatch")]
        public async Task<IActionResult> UnmatchTransaction([FromBody] UnmatchTransactionDto unmatchDto)
        {
            try
            {
                var response = await _bankReconciliationService.UnmatchTransactionAsync(unmatchDto.BankTransactionId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unmatching transaction");
                return StatusCode(500, new { Message = "An error occurred while unmatching transaction" });
            }
        }

        /// <summary>
        /// Delete a bank transaction
        /// </summary>
        [HttpDelete("transaction/{transactionId}")]
        public async Task<IActionResult> DeleteTransaction(long transactionId)
        {
            try
            {
                var response = await _bankReconciliationService.DeleteTransactionAsync(transactionId);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting transaction");
                return StatusCode(500, new { Message = "An error occurred while deleting transaction" });
            }
        }

        /// <summary>
        /// Get reconciliation report
        /// </summary>
        [HttpGet("statement/{statementId}/report")]
        public async Task<IActionResult> GetReconciliationReport(long statementId)
        {
            try
            {
                var response = await _bankReconciliationService.GetReconciliationReportAsync(statementId);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting reconciliation report");
                return StatusCode(500, new { Message = "An error occurred while getting reconciliation report" });
            }
        }

        /// <summary>
        /// Delete all unmatched bank transactions for the current organization
        /// </summary>
        [HttpDelete("transactions/unmatched")]
        public async Task<IActionResult> ClearUnmatchedTransactions()
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var userOrgResponse = await _organizationService.GetCurrentUserOrganizationAsync(userId);
                if (!userOrgResponse.Success || userOrgResponse.Data == null)
                {
                    return NotFound(new { Message = "Organization not found" });
                }

                var organizationId = userOrgResponse.Data.Id;
                var response = await _bankReconciliationService.ClearUnmatchedTransactionsAsync(organizationId);
                if (!response.Success)
                {
                    return BadRequest(response);
                }
                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error clearing unmatched transactions");
                return StatusCode(500, new { Message = "An error occurred while clearing unmatched transactions" });
            }
        }

        /// <summary>
        /// Reconcile a bank statement
        /// </summary>
        [HttpPost("reconcile")]
        public async Task<IActionResult> ReconcileStatement([FromBody] ReconcileStatementDto reconcileDto)
        {
            try
            {
                var userIdResponse = await _userService.GetCurrentUserIdAsync();
                if (!userIdResponse.Success || !userIdResponse.Data.HasValue)
                {
                    return Unauthorized(new { Message = "User not found" });
                }

                var userId = userIdResponse.Data.Value;
                var response = await _bankReconciliationService.ReconcileStatementAsync(reconcileDto.BankStatementId, userId, reconcileDto.Notes);

                if (!response.Success)
                {
                    return BadRequest(response);
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reconciling statement");
                return StatusCode(500, new { Message = "An error occurred while reconciling statement" });
            }
        }
    }

    public class MatchTransactionDto
    {
        public long BankTransactionId { get; set; }
        public long LedgerEntryId { get; set; }
    }

    public class UnmatchTransactionDto
    {
        public long BankTransactionId { get; set; }
    }

    public class ReconcileStatementDto
    {
        public long BankStatementId { get; set; }
        public string? Notes { get; set; }
    }
}
