using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.BankAccount
{
    public class UpdateBankAccountDto
    {
        [Required]
        public long Id { get; set; }

        [MaxLength(200)]
        public string? DisplayName { get; set; }

        public bool? IsActive { get; set; }

        public bool? IsDefault { get; set; }
    }
}

