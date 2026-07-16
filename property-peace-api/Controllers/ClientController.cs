
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Dtos.Client;
using brownstone_hub_api.Services.ClientService;
using brownstone_hub_api.Helpers;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Landlord,Admin")]
    public class ClientController : ControllerBase
    {
        private readonly IClientService _clientService;
        private readonly ILogger<ClientController> _logger;

        public ClientController(
            IClientService clientService,
            ILogger<ClientController> logger)
        {
            _clientService = clientService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetClients()
        {
            try
            {
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                    return StatusCode(403, new { Message = "Organization context is required" });

                var response = await _clientService.GetClientsByOrganization(organizationId.Value);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving clients");
                return StatusCode(500, new { message = "An error occurred while retrieving clients" });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetClient(long id)
        {
            try
            {
                var response = await _clientService.GetClientById(id);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving client {ClientId}", id);
                return StatusCode(500, new { message = "An error occurred while retrieving the client" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateClient([FromBody] AddOrUpdateClientDto dto)
        {
            try
            {
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                    return StatusCode(403, new { Message = "Organization context is required" });

                // Set organization ID on DTO
                dto.OrganizationId = organizationId.Value;

                var response = await _clientService.AddOrUpdateClient(dto);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                if (response.Data == null)
                {
                    return StatusCode(500, new { message = "Client data is null" });
                }

                return CreatedAtAction(nameof(GetClient), new { id = response.Data.Id }, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating client");
                return StatusCode(500, new { message = "An error occurred while creating the client" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateClient(long id, [FromBody] AddOrUpdateClientDto dto)
        {
            try
            {
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                if (!organizationId.HasValue)
                    return StatusCode(403, new { Message = "Organization context is required" });

                // Set organization ID and ID on DTO
                dto.Id = id;
                dto.OrganizationId = organizationId.Value;

                var response = await _clientService.AddOrUpdateClient(dto);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating client {ClientId}", id);
                return StatusCode(500, new { message = "An error occurred while updating the client" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteClient(long id)
        {
            try
            {
                var response = await _clientService.DeleteClient(id);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting client {ClientId}", id);
                return StatusCode(500, new { message = "An error occurred while deleting the client" });
            }
        }

        [HttpPost("{id}/link-property/{propertyId}")]
        public async Task<IActionResult> LinkPropertyToClient(long id, long propertyId)
        {
            try
            {
                var response = await _clientService.LinkPropertyToClient(propertyId, id);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error linking property {PropertyId} to client {ClientId}", propertyId, id);
                return StatusCode(500, new { message = "An error occurred while linking the property to the client" });
            }
        }

        [HttpPost("{id}/unlink-property/{propertyId}")]
        public async Task<IActionResult> UnlinkPropertyFromClient(long id, long propertyId)
        {
            try
            {
                var response = await _clientService.UnlinkPropertyFromClient(propertyId);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unlinking property {PropertyId} from client {ClientId}", propertyId, id);
                return StatusCode(500, new { message = "An error occurred while unlinking the property from the client" });
            }
        }

        [HttpPost("{id}/resend-invite")]
        public async Task<IActionResult> ResendInvite(long id)
        {
            try
            {
                var response = await _clientService.ResendInvite(id);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending invite for client {ClientId}", id);
                return StatusCode(500, new { message = "An error occurred while resending the invite" });
            }
        }

        [HttpGet("invite/validate/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateInviteToken(string token)
        {
            try
            {
                var response = await _clientService.ValidateInviteToken(token);

                if (!response.Success)
                {
                    return StatusCode(response.StatusCode, new { response.Message, response.Errors });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating client invite token");
                return StatusCode(500, new { message = "An error occurred while validating the invite token" });
            }
        }
    }
}
