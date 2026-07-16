using System.Text;

namespace brownstone_hub_api.Helpers
{
    /// <summary>
    /// Helper class for validating file uploads
    /// </summary>
    public static class FileValidationHelper
    {
        // Maximum file size: 10MB
        private const long MaxFileSizeBytes = 10 * 1024 * 1024;

        // Allowed file extensions for documents
        private static readonly HashSet<string> AllowedDocumentExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".doc", ".docx", ".txt", ".rtf",
            ".jpg", ".jpeg", ".png", ".gif", ".bmp",
            ".xls", ".xlsx", ".csv"
        };

        // Allowed file extensions for images
        private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
        };

        // Allowed MIME types for documents
        private static readonly HashSet<string> AllowedDocumentMimeTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "application/rtf",
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/bmp",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/csv"
        };

        // Allowed MIME types for images
        private static readonly HashSet<string> AllowedImageMimeTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/bmp",
            "image/webp"
        };

        // Dangerous file extensions that should never be allowed
        private static readonly HashSet<string> DangerousExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".exe", ".bat", ".cmd", ".com", ".pif", ".scr", ".vbs", ".js", ".jar",
            ".app", ".deb", ".pkg", ".rpm", ".msi", ".dmg", ".sh", ".ps1", ".py",
            ".php", ".asp", ".aspx", ".jsp", ".html", ".htm", ".xml", ".svg"
        };

        /// <summary>
        /// Validates a document file upload
        /// </summary>
        public static (bool IsValid, string ErrorMessage) ValidateDocumentFile(IFormFile file)
        {
            if (file == null)
            {
                return (false, "File is required");
            }

            // Check file size
            if (file.Length == 0)
            {
                return (false, "File is empty");
            }

            if (file.Length > MaxFileSizeBytes)
            {
                return (false, $"File size exceeds maximum allowed size of {MaxFileSizeBytes / (1024 * 1024)}MB");
            }

            // Get file extension
            var extension = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(extension))
            {
                return (false, "File must have a valid extension");
            }

            // Check for dangerous extensions
            if (DangerousExtensions.Contains(extension))
            {
                return (false, $"File type '{extension}' is not allowed for security reasons");
            }

            // Validate extension
            if (!AllowedDocumentExtensions.Contains(extension))
            {
                return (false, $"File type '{extension}' is not allowed. Allowed types: {string.Join(", ", AllowedDocumentExtensions)}");
            }

            // Validate MIME type
            if (string.IsNullOrEmpty(file.ContentType))
            {
                return (false, "File content type is missing");
            }

            if (!AllowedDocumentMimeTypes.Contains(file.ContentType))
            {
                return (false, $"Content type '{file.ContentType}' is not allowed");
            }

            // Basic file signature validation (magic bytes)
            var signatureValidation = ValidateFileSignature(file, extension);
            if (!signatureValidation.IsValid)
            {
                return signatureValidation;
            }

            return (true, string.Empty);
        }

        /// <summary>
        /// Validates an image file upload
        /// </summary>
        public static (bool IsValid, string ErrorMessage) ValidateImageFile(IFormFile file)
        {
            if (file == null)
            {
                return (false, "File is required");
            }

            // Check file size
            if (file.Length == 0)
            {
                return (false, "File is empty");
            }

            if (file.Length > MaxFileSizeBytes)
            {
                return (false, $"File size exceeds maximum allowed size of {MaxFileSizeBytes / (1024 * 1024)}MB");
            }

            // Get file extension
            var extension = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(extension))
            {
                return (false, "File must have a valid extension");
            }

            // Check for dangerous extensions
            if (DangerousExtensions.Contains(extension))
            {
                return (false, $"File type '{extension}' is not allowed for security reasons");
            }

            // Validate extension
            if (!AllowedImageExtensions.Contains(extension))
            {
                return (false, $"File type '{extension}' is not allowed. Allowed image types: {string.Join(", ", AllowedImageExtensions)}");
            }

            // Validate MIME type
            if (string.IsNullOrEmpty(file.ContentType))
            {
                return (false, "File content type is missing");
            }

            if (!AllowedImageMimeTypes.Contains(file.ContentType))
            {
                return (false, $"Content type '{file.ContentType}' is not allowed for images");
            }

            // Basic file signature validation (magic bytes)
            var signatureValidation = ValidateFileSignature(file, extension);
            if (!signatureValidation.IsValid)
            {
                return signatureValidation;
            }

            return (true, string.Empty);
        }

        /// <summary>
        /// Validates file signature (magic bytes) to ensure file type matches extension
        /// </summary>
        private static (bool IsValid, string ErrorMessage) ValidateFileSignature(IFormFile file, string extension)
        {
            try
            {
                using var stream = file.OpenReadStream();
                var buffer = new byte[12];
                var bytesRead = stream.Read(buffer, 0, buffer.Length);

                if (bytesRead < 4)
                {
                    return (false, "File is too small to validate");
                }

                // Check file signatures (magic bytes)
                var extensionLower = extension.ToLowerInvariant();

                // PDF: %PDF
                if (extensionLower == ".pdf")
                {
                    var header = Encoding.ASCII.GetString(buffer, 0, 4);
                    if (header != "%PDF")
                    {
                        return (false, "File signature does not match PDF format");
                    }
                }
                // JPEG: FF D8 FF
                else if (extensionLower == ".jpg" || extensionLower == ".jpeg")
                {
                    if (buffer[0] != 0xFF || buffer[1] != 0xD8 || buffer[2] != 0xFF)
                    {
                        return (false, "File signature does not match JPEG format");
                    }
                }
                // PNG: 89 50 4E 47
                else if (extensionLower == ".png")
                {
                    if (buffer[0] != 0x89 || buffer[1] != 0x50 || buffer[2] != 0x4E || buffer[3] != 0x47)
                    {
                        return (false, "File signature does not match PNG format");
                    }
                }
                // GIF: GIF87a or GIF89a
                else if (extensionLower == ".gif")
                {
                    var header = Encoding.ASCII.GetString(buffer, 0, 6);
                    if (header != "GIF87a" && header != "GIF89a")
                    {
                        return (false, "File signature does not match GIF format");
                    }
                }
                // BMP: BM
                else if (extensionLower == ".bmp")
                {
                    if (buffer[0] != 0x42 || buffer[1] != 0x4D)
                    {
                        return (false, "File signature does not match BMP format");
                    }
                }
                // ZIP-based formats (DOCX, XLSX): PK (ZIP signature)
                else if (extensionLower == ".docx" || extensionLower == ".xlsx")
                {
                    if (buffer[0] != 0x50 || buffer[1] != 0x4B)
                    {
                        return (false, $"File signature does not match {extensionLower.ToUpper()} format");
                    }
                }

                // For other file types, we rely on extension and MIME type validation
                return (true, string.Empty);
            }
            catch (Exception ex)
            {
                return (false, $"Error validating file signature: {ex.Message}");
            }
        }
    }
}

