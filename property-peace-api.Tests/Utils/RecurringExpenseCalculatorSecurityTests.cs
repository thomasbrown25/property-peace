using brownstone_hub_api.Enums;
using brownstone_hub_api.Utils;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class RecurringExpenseCalculatorSecurityTests
{
    [Theory]
    [InlineData(ERecurringFrequency.Monthly)]
    [InlineData(ERecurringFrequency.Quarterly)]
    [InlineData(ERecurringFrequency.Yearly)]
    public void AncientStartDate_IsAdvancedWithoutRecursiveStackExhaustion(ERecurringFrequency frequency)
    {
        var next = RecurringExpenseCalculator.CalculateNextOccurrence(
            frequency, 31, DateTime.MinValue.AddDays(1));

        next.Should().NotBeNull();
        next!.Value.Should().BeOnOrAfter(DateTime.Today);
    }

    [Fact]
    public void InvalidInputsAndDateOverflow_FailClosed()
    {
        RecurringExpenseCalculator.CalculateNextOccurrence((ERecurringFrequency)999, 1, DateTime.Today)
            .Should().BeNull();
        RecurringExpenseCalculator.CalculateNextOccurrence(ERecurringFrequency.Monthly, 0, DateTime.Today)
            .Should().BeNull();
        RecurringExpenseCalculator.CalculateNextOccurrence(
            ERecurringFrequency.Yearly, 1, DateTime.MaxValue.AddDays(-1), DateTime.MaxValue.AddDays(-1))
            .Should().BeNull();
    }

    [Fact]
    public void Materialization_IsCappedForUntrustedHugeRanges()
    {
        var occurrences = RecurringExpenseCalculator.CalculateAllOccurrences(
            ERecurringFrequency.Monthly, 1, DateTime.MinValue.AddDays(1), DateTime.MaxValue.AddDays(-1));

        occurrences.Count.Should().BeLessThanOrEqualTo(10_000);
    }
}
