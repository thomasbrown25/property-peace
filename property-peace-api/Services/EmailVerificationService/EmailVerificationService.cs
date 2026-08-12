using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using Microsoft.EntityFrameworkCore;
using brownstone_hub_api.Dtos;
using System.Security.Cryptography;

namespace brownstone_hub_api.Services.EmailVerificationService
{
    public class EmailVerificationService : IEmailVerificationService
    {
        private readonly DataContext _context;
        private readonly IEmailService _emailService;
        private readonly ILogger<EmailVerificationService> _logger;
        private readonly string _proofSecret;

        public EmailVerificationService(
            DataContext context,
            IEmailService emailService,
            ILogger<EmailVerificationService> logger,
            IConfiguration configuration)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
            _proofSecret = configuration["JwtSettings:SecretKey"]
                ?? throw new InvalidOperationException("JwtSettings:SecretKey is required for email verification proofs.");
        }

        public async Task<ServiceResponse<string>> SendVerificationCodeAsync(string email)
        {
            try
            {
                var canonicalEmail = EmailVerificationProof.CanonicalizeEmail(email);
                var nowUtc = DateTime.UtcNow;
                var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();

                // Invalidate any existing codes for this email
                var existingCodes = await _context.EmailVerifications
                    .Where(e => e.Email == canonicalEmail && !e.IsVerified && e.ExpiresAt > nowUtc)
                    .ToListAsync();

                foreach (var existingCode in existingCodes)
                {
                    existingCode.IsVerified = true; // Mark as used
                }

                // Create new verification code
                var verification = new EmailVerification
                {
                    Email = canonicalEmail,
                    Code = code,
                    CreatedAt = nowUtc,
                    ExpiresAt = nowUtc.AddMinutes(10), // Code expires in 10 minutes
                    IsVerified = false
                };

                _context.EmailVerifications.Add(verification);
                await _context.SaveChangesAsync();

                // Send email
                var subject = "Verify Your Email - Property Peace";
                var htmlContent = $@"
                    <html>
                    <body style='font-family: Arial, sans-serif;'>
                        <h2>Email Verification Code</h2>
                        <p>Your verification code is: <strong style='font-size: 24px; color: #1976d2;'>{code}</strong></p>
                        <p>This code will expire in 10 minutes.</p>
                        <p>If you didn't request this code, please ignore this email.</p>
                    </body>
                    </html>";
                var plainTextContent = $"Your verification code is: {code}. This code will expire in 10 minutes.";

                var emailSent = await _emailService.SendEmailAsync(email, subject, htmlContent, plainTextContent);

                if (!emailSent)
                {
                    _logger.LogWarning("Failed to send verification email to {Email}", email);
                    return ServiceResponse<string>.CreateError("Failed to send verification email", "Please try again later.");
                }

                _logger.LogInformation("Verification code sent to {Email}", email);
                return ServiceResponse<string>.CreateSuccess("Verification code sent successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending verification code to {Email}", email);
                return ServiceResponse<string>.CreateError("Error sending verification code", ex.Message);
            }
        }

        public async Task<ServiceResponse<string>> VerifyCodeAsync(string email, string code)
        {
            try
            {
                var canonicalEmail = EmailVerificationProof.CanonicalizeEmail(email);
                var nowUtc = DateTime.UtcNow;
                var verification = await _context.EmailVerifications
                    .Where(e => e.Email == canonicalEmail && e.Code == code && !e.IsVerified)
                    .OrderByDescending(e => e.CreatedAt)
                    .FirstOrDefaultAsync();

                if (verification == null)
                {
                    return ServiceResponse<string>.CreateError("Invalid verification code", "The code you entered is incorrect or has already been used.");
                }

                if (verification.ExpiresAt < nowUtc)
                {
                    return ServiceResponse<string>.CreateError("Verification code expired", "The code has expired. Please request a new one.");
                }

                verification.IsVerified = true;
                verification.VerifiedAt = nowUtc;
                verification.ExpiresAt = nowUtc.AddMinutes(10);
                await _context.SaveChangesAsync();

                var proof = EmailVerificationProof.Create(verification.Id, canonicalEmail, nowUtc, _proofSecret);
                return ServiceResponse<string>.CreateSuccess(proof, "Email verified successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying code for {Email}", email);
                return ServiceResponse<string>.CreateError("Error verifying code", "Unable to verify the email code.");
            }
        }
    }
}

