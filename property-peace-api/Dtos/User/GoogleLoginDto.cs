namespace brownstone_hub_api.Dtos.User
{
    public class GoogleLoginDto
    {
        public string? IdToken { get; set; } // Optional - can use AccessToken instead
        public string? AccessToken { get; set; } // Alternative to IdToken for access token flow
        public string? RegistrationCode { get; set; } // Required for new users
        public string? InviteToken { get; set; } // Optional for tenant invites
        public string? Timezone { get; set; } // IANA timezone detected by the browser
    }
}

