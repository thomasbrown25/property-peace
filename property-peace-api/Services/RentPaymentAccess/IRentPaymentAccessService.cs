using brownstone_hub_api.Dtos.RentPaymentAccess;

namespace brownstone_hub_api.Services.RentPaymentAccess;

public interface IRentPaymentAccessService
{
    Task<RentPaymentAccessDto> GetForOrganizationAsync(int organizationId, CancellationToken cancellationToken);
    Task<RentPaymentAccessDto> RequestAsync(int organizationId, int actorUserId, CancellationToken cancellationToken);
    Task<IReadOnlyList<RentPaymentAccessListItemDto>> ListForAdminAsync(string? status, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto?> GetForAdminAsync(Guid publicId, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto> ApproveAsync(Guid publicId, int actorUserId,
        ReviewRentPaymentAccessRequestDto review, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto> RejectAsync(Guid publicId, int actorUserId,
        ReviewRentPaymentAccessRequestDto review, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto> SuspendAsync(Guid publicId, int actorUserId,
        ReviewRentPaymentAccessRequestDto review, CancellationToken cancellationToken);
}

public abstract class RentPaymentAccessException(string message) : Exception(message);

public sealed class RentPaymentAccessNotFoundException()
    : RentPaymentAccessException("The rent-payment access request was not found.");

public sealed class RentPaymentAccessInvalidTransitionException()
    : RentPaymentAccessException("The requested rent-payment access transition is not allowed.");

public sealed class RentPaymentAccessValidationException(string message)
    : RentPaymentAccessException(message);

public sealed class RentPaymentAccessConcurrencyException()
    : RentPaymentAccessException("The rent-payment access request changed. Refresh and try again.");
