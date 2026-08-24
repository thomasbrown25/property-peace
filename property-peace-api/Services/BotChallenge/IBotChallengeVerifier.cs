namespace brownstone_hub_api.Services.BotChallenge;

public sealed record BotChallengeResult(bool Success, IReadOnlyList<string> ErrorCodes)
{
    public static BotChallengeResult Passed() => new(true, []);
    public static BotChallengeResult Failed(params string[] errorCodes) => new(false, errorCodes);
}

public interface IBotChallengeVerifier
{
    Task<BotChallengeResult> VerifyAsync(
        string? token,
        string? remoteIp,
        string expectedAction,
        CancellationToken cancellationToken = default);
}
