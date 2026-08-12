using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.User;

public sealed class AppleLoginDto
{
    [Required]
    public string IdentityToken { get; set; } = string.Empty;

    [Required]
    public string Nonce { get; set; } = string.Empty;

    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Timezone { get; set; }
}
