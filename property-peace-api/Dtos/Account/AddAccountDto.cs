using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Account
{
    public class AddAccountDto
    {
        [Required]
        public long OrganizationId { get; set; }

        [Required]
        [MaxLength(50)]
        public string AccountCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string AccountName { get; set; } = string.Empty;

        [Required]
        public EAccountType AccountType { get; set; }

        public long? ParentAccountId { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public bool IsSystemAccount { get; set; } = false;
    }
}
