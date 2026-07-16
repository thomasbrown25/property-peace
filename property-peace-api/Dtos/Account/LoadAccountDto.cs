using brownstone_hub_api.Enums;

namespace brownstone_hub_api.Dtos.Account
{
    public class LoadAccountDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public string AccountCode { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public EAccountType AccountType { get; set; }
        public long? ParentAccountId { get; set; }
        public string? ParentAccountName { get; set; }
        public List<LoadAccountDto> ChildAccounts { get; set; } = [];
        public bool IsSystemAccount { get; set; }
        public bool IsActive { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
