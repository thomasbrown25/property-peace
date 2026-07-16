namespace brownstone_hub_api.Dtos.BankAccount
{
    public class LoadBankAccountDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public string StripeAccountId { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty; // Alias for DisplayName for frontend compatibility
        public string? Last4 { get; set; }
        public string? BankName { get; set; }
        public string? AccountType { get; set; }
        public bool IsActive { get; set; }
        public bool IsDefault { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}

