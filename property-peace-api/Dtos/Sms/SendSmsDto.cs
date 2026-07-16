using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.Sms
{
    public class SendSmsDto
    {
        [Required]
        public string To { get; set; } = string.Empty;

        [Required]
        [MaxLength(2048, ErrorMessage = "Message cannot exceed 2048 characters")]
        public string Message { get; set; } = string.Empty;
    }
}

