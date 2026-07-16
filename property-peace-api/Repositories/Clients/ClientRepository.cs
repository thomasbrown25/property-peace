
using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Client;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Clients
{
    public class ClientRepository(DataContext context, IMapper mapper) : IClientRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;

        public async Task<List<LoadClientDto>> GetClientsByOrganizationId(long organizationId)
        {
            var clients = await _context.Clients
                .Where(c => c.OrganizationId == organizationId && !c.IsDeleted)
                .Include(c => c.Properties.Where(p => !p.IsDeleted))
                .OrderBy(c => c.LastName)
                .ThenBy(c => c.FirstName)
                .ToListAsync();

            var dtos = _mapper.Map<List<LoadClientDto>>(clients);
            
            // Set property count
            foreach (var dto in dtos)
            {
                var client = clients.FirstOrDefault(c => c.Id == dto.Id);
                if (client != null)
                {
                    dto.PropertyCount = client.Properties.Count;
                }
            }

            return dtos;
        }

        public async Task<LoadClientDto?> GetClientById(long id)
        {
            var client = await _context.Clients
                .Include(c => c.Properties.Where(p => !p.IsDeleted))
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            if (client == null)
                return null;

            var dto = _mapper.Map<LoadClientDto>(client);
            dto.PropertyCount = client.Properties.Count;
            return dto;
        }

        public async Task<LoadClientDto?> GetClientByEmail(string email, long organizationId)
        {
            var client = await _context.Clients
                .FirstOrDefaultAsync(c => 
                    c.Email.ToLower() == email.ToLower() && 
                    c.OrganizationId == organizationId && 
                    !c.IsDeleted);

            if (client == null)
                return null;

            return _mapper.Map<LoadClientDto>(client);
        }

        public async Task<LoadClientDto> AddClient(AddOrUpdateClientDto clientDto)
        {
            var client = _mapper.Map<Models.Client>(clientDto);
            client.CreatedAt = DateTime.Now;
            client.UpdatedAt = DateTime.Now;

            await _context.Clients.AddAsync(client);
            await _context.SaveChangesAsync();

            return _mapper.Map<LoadClientDto>(client);
        }

        public async Task<LoadClientDto> UpdateClient(long id, AddOrUpdateClientDto clientDto)
        {
            var existingClient = await _context.Clients
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            if (existingClient == null)
                return null;

            _mapper.Map(clientDto, existingClient);
            existingClient.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return _mapper.Map<LoadClientDto>(existingClient);
        }

        public async Task<bool> DeleteClient(long id)
        {
            var client = await _context.Clients
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted);

            if (client == null)
                return false;

            // Soft delete
            client.IsDeleted = true;
            client.DeletedAt = DateTime.Now;
            client.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<long>> GetPropertiesByClientId(long clientId)
        {
            return await _context.Properties
                .Where(p => p.ClientId == clientId && !p.IsDeleted)
                .Select(p => p.Id)
                .ToListAsync();
        }
    }
}
