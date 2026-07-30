using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentPaymentModelTests
{
    [Fact]
    public void FinancialCounters_AreProtectedByDatabaseCheckConstraints()
    {
        using var context = StripeRentPaymentFlowTests.CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;
        var entity = model.FindEntityType(typeof(StripeRentPayment));

        entity.Should().NotBeNull();
        var constraintNames = entity!.GetCheckConstraints().Select(x => x.Name).ToList();
        constraintNames.Should().Contain("CK_StripeRentPayments_PositiveAmount");
        constraintNames.Should().Contain("CK_StripeRentPayments_NonnegativeCounters");
        constraintNames.Should().Contain("CK_StripeRentPayments_LossWithinAmount");
        constraintNames.Should().Contain("CK_StripeRentPayments_ReversalWithinAmount");
    }
}
