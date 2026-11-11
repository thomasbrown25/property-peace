using brownstone_hub_api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;
using Xunit;

namespace brownstone_hub_api.Tests.Controllers;

public sealed class PaymentReviewRouteRemovalTests
{
    [Fact]
    public void Mvc_discovery_excludes_retired_review_and_access_request_controllers()
    {
        var manager = new ApplicationPartManager();
        manager.ApplicationParts.Add(new AssemblyPart(typeof(StripeController).Assembly));
        manager.FeatureProviders.Add(new ControllerFeatureProvider());
        var feature = new ControllerFeature();
        manager.PopulateFeature(feature);

        feature.Controllers.Should().Contain(x => x.AsType() == typeof(StripeController));
        feature.Controllers.Should().NotContain(x => x.AsType() == typeof(StripePayeeReviewController));
        feature.Controllers.Should().NotContain(x => x.AsType() == typeof(AdminRentPaymentAccessController));
        feature.Controllers.Should().NotContain(x => x.AsType() == typeof(RentPaymentAccessController));
    }
}
