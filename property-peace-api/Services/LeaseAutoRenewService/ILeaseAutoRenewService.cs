namespace brownstone_hub_api.Services.LeaseAutoRenewService
{
    /// <summary>
    /// Processes fixed-term leases at their end date and month-to-month leases 15 days before their current end date.
    /// </summary>
    public interface ILeaseAutoRenewService
    {
        /// <summary>
        /// Finds active leases ending on or before the given date with AutoRenewLease enabled,
        /// ends each, creates a new draft lease with copied terms and new dates, and generates the lease agreement.
        /// </summary>
        /// <param name="asOfDate">Date to use as "today" for finding ending leases. If null, uses DateTime.UtcNow.Date.</param>
        Task ProcessAutoRenewalsAsync(DateTime? asOfDate = null);
    }
}
