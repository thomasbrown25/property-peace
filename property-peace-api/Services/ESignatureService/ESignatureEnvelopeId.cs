namespace brownstone_hub_api.Services.ESignatureService;

/// <summary>Canonical identifier contract shared by provider, persistence, and Connect boundaries.</summary>
internal static class ESignatureEnvelopeId
{
    // Connect accepts at most 128 characters; the persistence column currently allows 200.
    public const int MaximumLength = 128;

    public static bool IsCanonical(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        value.Length <= MaximumLength &&
        string.Equals(value, value.Trim(), StringComparison.Ordinal) &&
        !value.Any(char.IsControl);

    public static string RequireCanonical(string? value)
    {
        if (!IsCanonical(value))
            throw new InvalidOperationException("The e-signature provider returned an invalid envelope identifier.");
        return value!;
    }
}
