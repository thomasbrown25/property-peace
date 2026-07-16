using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Dtos.Sms
{
    public class SendBulkSmsDto
    {
        [Required]
        [MinLength(1, ErrorMessage = "At least one recipient is required")]
        public List<string> To { get; set; } = new List<string>();

        [Required]
        [MaxLength(2048, ErrorMessage = "Message cannot exceed 2048 characters")]
        public string Message { get; set; } = string.Empty;
    }
}

