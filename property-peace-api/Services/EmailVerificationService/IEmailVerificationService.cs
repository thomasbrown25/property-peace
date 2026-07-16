namespace brownstone_hub_api.Services.EmailVerificationService
{
    public interface IEmailVerificationService
    {
        Task<ServiceResponse<string>> SendVerificationCodeAsync(string email);
        Task<ServiceResponse<bool>> VerifyCodeAsync(string email, string code);
    }
}

