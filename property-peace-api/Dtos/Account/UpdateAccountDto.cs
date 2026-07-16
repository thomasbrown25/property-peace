using System.ComponentModel.DataAnnotations;
using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Account
{
    public class UpdateAccountDto
    {
        [Required]
        public long Id { get; set; }

        [MaxLength(50)]
        public string? AccountCode { get; set; }

        [MaxLength(200)]
        public string? AccountName { get; set; }

        public EAccountType? AccountType { get; set; }

        public long? ParentAccountId { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public bool? IsActive { get; set; }
    }
}
