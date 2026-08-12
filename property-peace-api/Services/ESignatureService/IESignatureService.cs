using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.ESignatureService
{
    /// <summary>
    /// Interface for e-signature service (DocuSign, HelloSign, etc.)
    /// </summary>
    public interface IESignatureService
    {
        /// <summary>
        /// Send a lease document for e-signature
        /// </summary>
        /// <param name="request">Signature request details</param>
        /// <param name="documentBytes">PDF document bytes to be signed</param>
        /// <param name="documentName">Name of the document</param>
        /// <returns>Envelope/envelope ID and signing URLs</returns>
        Task<ServiceResponse<SignatureEnvelopeDto>> SendForSignature(
            SendLeaseForSignatureDto request,
            byte[] documentBytes,
            string documentName,
            CancellationToken cancellationToken);

        /// <summary>
        /// Get the status of a signature envelope
        /// </summary>
        /// <param name="envelopeId">Envelope/envelope ID from the e-signature provider</param>
        /// <returns>Current status and signing URLs</returns>
        Task<ServiceResponse<SignatureStatusDto>> GetSignatureStatus(string envelopeId, CancellationToken cancellationToken);

        /// <summary>
        /// Get the signed document from the e-signature provider
        /// </summary>
        /// <param name="envelopeId">Envelope/envelope ID</param>
        /// <returns>Signed document bytes</returns>
        Task<ServiceResponse<byte[]>> GetSignedDocument(string envelopeId, CancellationToken cancellationToken);

        /// <summary>
        /// Cancel a signature request
        /// </summary>
        /// <param name="envelopeId">Envelope/envelope ID</param>
        /// <param name="reason">Reason for cancellation</param>
        Task<ServiceResponse<bool>> CancelSignature(string envelopeId, string? reason, CancellationToken cancellationToken);

        /// <summary>
        /// Resend signature request to signers
        /// </summary>
        /// <param name="envelopeId">Envelope/envelope ID</param>
        Task<ServiceResponse<bool>> ResendSignatureRequest(string envelopeId, CancellationToken cancellationToken);

        /// <summary>
        /// Get embedded signing URL for a recipient (allows signing directly in the app)
        /// </summary>
        /// <param name="envelopeId">Envelope/envelope ID</param>
        /// <param name="recipientEmail">Email of the recipient</param>
        /// <param name="recipientName">Name of the recipient</param>
        /// <param name="returnUrl">URL to redirect to after signing</param>
        /// <returns>Embedded signing URL</returns>
        Task<ServiceResponse<string>> GetEmbeddedSigningUrl(string envelopeId, string recipientEmail, string recipientName, string returnUrl, CancellationToken cancellationToken);
    }

    /// <summary>
    /// Response containing envelope information after sending for signature
    /// </summary>
    public class SignatureEnvelopeDto
    {
        public string EnvelopeId { get; set; } = string.Empty; // Provider's envelope/envelope ID
        public Dictionary<string, string> SignerUrls { get; set; } = []; // Key: email, Value: signing URL
        public DateTime? ExpiresAt { get; set; }
    }

    /// <summary>
    /// Current status of a signature envelope
    /// </summary>
    public class SignatureStatusDto
    {
        public string EnvelopeId { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // "sent", "delivered", "signed", "completed", "declined", "voided", etc.
        public Dictionary<string, SignerStatusDto> SignerStatuses { get; set; } = []; // Key: email
        public DateTime? CompletedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    /// <summary>
    /// Status of an individual signer
    /// </summary>
    public class SignerStatusDto
    {
        public string Email { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // "sent", "delivered", "signed", "declined", etc.
        public DateTime? SignedAt { get; set; }
        public string? SigningUrl { get; set; } // URL for this signer to access the document
    }
}

