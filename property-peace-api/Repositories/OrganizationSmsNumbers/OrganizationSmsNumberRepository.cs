using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.OrganizationSmsNumbers
{
    public interface IOrganizationSmsNumberRepository
    {
        Task<OrganizationSmsNumber?> GetActivePrimaryAsync(long organizationId);
        Task<OrganizationSmsNumber?> GetByPhoneNumberAsync(string phoneNumber);
        Task<OrganizationSmsNumber?> GetByTwilioPhoneNumberSidAsync(string twilioPhoneNumberSid);
        Task<OrganizationSmsNumber> AddAsync(OrganizationSmsNumber number);
        Task<OrganizationSmsNumber> UpdateAsync(OrganizationSmsNumber number);
    }

    public class OrganizationSmsNumberRepository(DataContext context) : IOrganizationSmsNumberRepository
    {
        private readonly DataContext _context = context;

        public async Task<OrganizationSmsNumber?> GetActivePrimaryAsync(long organizationId)
        {
            return await _context.OrganizationSmsNumbers
                .FirstOrDefaultAsync(x => x.OrganizationId == organizationId && x.IsActive && x.IsPrimary);
        }

        public async Task<OrganizationSmsNumber?> GetByPhoneNumberAsync(string phoneNumber)
        {
            var normalized = NormalizePhone(phoneNumber);
            return await _context.OrganizationSmsNumbers
                .FirstOrDefaultAsync(x => x.IsActive && x.PhoneNumber == normalized);
        }

        public async Task<OrganizationSmsNumber?> GetByTwilioPhoneNumberSidAsync(string twilioPhoneNumberSid)
        {
            return await _context.OrganizationSmsNumbers
                .FirstOrDefaultAsync(x => x.TwilioPhoneNumberSid == twilioPhoneNumberSid);
        }

        public async Task<OrganizationSmsNumber> AddAsync(OrganizationSmsNumber number)
        {
            _context.OrganizationSmsNumbers.Add(number);
            await _context.SaveChangesAsync();
            return number;
        }

        public async Task<OrganizationSmsNumber> UpdateAsync(OrganizationSmsNumber number)
        {
            number.UpdatedAt = DateTime.UtcNow;
            _context.OrganizationSmsNumbers.Update(number);
            await _context.SaveChangesAsync();
            return number;
        }

        private static string NormalizePhone(string phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber)) return string.Empty;
            var digits = new string(phoneNumber.Where(char.IsDigit).ToArray());
            if (digits.Length == 10) return $"+1{digits}";
            return phoneNumber.Trim();
        }
    }
}
