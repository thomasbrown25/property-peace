namespace brownstone_hub_api.Enums
{
    public enum ERentStatus
    {
        UpcomingDue,   // before due date, not yet paid
        UpToDate,      // this period's rent fully covered
        Overdue,        // due date passed, rent not fully covered
        Archived,
        NotStarted
    }
}