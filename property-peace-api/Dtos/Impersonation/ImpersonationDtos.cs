using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;
using brownstone_hub_api.Dtos.User;

namespace brownstone_hub_api.Dtos.Impersonation
{
    public class StartImpersonationDto
    {
        public long TargetUserId { get; set; }
        [Required, StringLength(1000, MinimumLength = 1)]
        public string Reason { get; set; } = string.Empty;
        [StringLength(200)]
        public string? SupportReference { get; set; }
    }

    [JsonConverter(typeof(ImpersonationRefreshDtoConverter))]
    public class ImpersonationRefreshDto
    {
        [Required, StringLength(128, MinimumLength = 97)]
        public string RefreshToken { get; set; } = string.Empty;
    }

    // Keeps the strongly typed contract while accepting the existing JSON-string client payload.
    public sealed class ImpersonationRefreshDtoConverter : JsonConverter<ImpersonationRefreshDto>
    {
        public override ImpersonationRefreshDto Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.String)
                return new ImpersonationRefreshDto { RefreshToken = reader.GetString() ?? string.Empty };
            if (reader.TokenType != JsonTokenType.StartObject) throw new JsonException("Expected a refresh token object.");

            using var document = JsonDocument.ParseValue(ref reader);
            return new ImpersonationRefreshDto
            {
                RefreshToken = document.RootElement.TryGetProperty("refreshToken", out var token)
                    ? token.GetString() ?? string.Empty
                    : string.Empty
            };
        }

        public override void Write(Utf8JsonWriter writer, ImpersonationRefreshDto value, JsonSerializerOptions options)
        {
            writer.WriteStartObject();
            writer.WriteString("refreshToken", value.RefreshToken);
            writer.WriteEndObject();
        }
    }

    public class ImpersonationTokenDto
    {
        public Guid SessionId { get; set; }
        public string AccessToken { get; set; } = string.Empty;
        public DateTime AccessTokenExpiresAt { get; set; }
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime SessionExpiresAt { get; set; }
        public LoadUserDto User { get; set; } = null!;
    }

    public class ImpersonationStatusDto
    {
        public Guid SessionId { get; set; }
        public long ActorUserId { get; set; }
        public long TargetUserId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string? SupportReference { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public bool IsActive { get; set; }
    }

    public class StopImpersonationDto
    {
        public string AccessToken { get; set; } = string.Empty;
        public LoadUserDto User { get; set; } = null!;
    }
}
