namespace brownstone_hub_api.Dtos.User
{
    /// <summary>
    /// DTO for admin setting a user's password (no current password required).
    /// Works for any user including Google sign-up; user can then login with email+password or continue using Google.
    /// </summary>
    public class AdminSetPasswordDto
    {
        public string NewPassword { get; set; } = string.Empty;
    }
}
