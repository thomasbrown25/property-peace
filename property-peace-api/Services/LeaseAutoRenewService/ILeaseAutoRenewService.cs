namespace brownstone_hub_api.Services.LeaseAutoRenewService
{
    /// <summary>
    /// Processes auto-renewal for leases that have reached their end date and have AutoRenewLease enabled.
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
