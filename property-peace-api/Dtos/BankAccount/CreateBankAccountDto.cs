using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.BankAccount
{
    public class CreateBankAccountDto
    {
        [Required]
        public long OrganizationId { get; set; }

        [Required]
        [MaxLength(255)]
        public string StripeAccountId { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string DisplayName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? Last4 { get; set; }

        [MaxLength(200)]
        public string? BankName { get; set; }

        [MaxLength(50)]
        public string? AccountType { get; set; }

        public bool IsDefault { get; set; } = false;
    }
}

