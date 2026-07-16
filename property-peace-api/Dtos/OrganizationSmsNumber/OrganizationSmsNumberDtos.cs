namespace brownstone_hub_api.Dtos.OrganizationSmsNumber
{
    public class OrganizationSmsNumberStatusDto
    {
        public bool HasPremiumAccess { get; set; }
        public bool HasActiveNumber { get; set; }
        public long? Id { get; set; }
        public string? PhoneNumber { get; set; }
        public string? FriendlyName { get; set; }
        public string? State { get; set; }
        public string? AreaCode { get; set; }
        public string? Status { get; set; }
    }

    public class AvailableSmsNumberDto
    {
        public string PhoneNumber { get; set; } = string.Empty;
        public string FriendlyName { get; set; } = string.Empty;
        public string? Locality { get; set; }
        public string? Region { get; set; }
        public string? PostalCode { get; set; }
        public bool Sms { get; set; }
        public bool Mms { get; set; }
        public bool Voice { get; set; }
    }

    public class SmsAreaCodeDto
    {
        public string State { get; set; } = string.Empty;
        public string AreaCode { get; set; } = string.Empty;
    }

    public class SearchSmsNumbersRequestDto
    {
        public string State { get; set; } = string.Empty;
        public string AreaCode { get; set; } = string.Empty;
    }

    public class PurchaseSmsNumberDto
    {
        public string PhoneNumber { get; set; } = string.Empty;
        public string State { get; set; } = string.Empty;
        public string AreaCode { get; set; } = string.Empty;
    }
}
