namespace brownstone_hub_api.Dtos.Stripe
{
    public sealed record SaveStripeConnectPreparationRequest(
        string OperatingType,
        string DisplayName,
        IReadOnlyList<long> PropertyIds,
        string AuthorityRelationship,
        bool AuthorityAttested);

    public sealed record StripeConnectPreparationDto(
        long Id,
        long UserId,
        long OrganizationId,
        string OperatingType,
        string DisplayName,
        IReadOnlyList<long> PropertyIds,
        string AuthorityRelationship,
        bool AuthorityAttested,
        DateTimeOffset? AuthorityAttestedAt,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt);
}
