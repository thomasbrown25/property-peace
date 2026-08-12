namespace brownstone_hub_api.Domain.Screening;

public static class ScreeningTransitionPolicy
{
    public static bool CanTransition(ScreeningStatus current, ScreeningStatus next)
    {
        if (!Enum.IsDefined(current) || !Enum.IsDefined(next))
        {
            return false;
        }

        if (current == next)
        {
            return true;
        }

        return current switch
        {
            ScreeningStatus.Invited => next is
                ScreeningStatus.ConsentPending or
                ScreeningStatus.Expired or
                ScreeningStatus.Failed,

            ScreeningStatus.ConsentPending => next is
                ScreeningStatus.PaymentPending or
                ScreeningStatus.ActionRequired or
                ScreeningStatus.Expired or
                ScreeningStatus.Failed,

            ScreeningStatus.PaymentPending => next is
                ScreeningStatus.Processing or
                ScreeningStatus.ActionRequired or
                ScreeningStatus.Expired or
                ScreeningStatus.Failed,

            ScreeningStatus.Processing => next is
                ScreeningStatus.Complete or
                ScreeningStatus.ActionRequired or
                ScreeningStatus.Expired or
                ScreeningStatus.Failed,

            ScreeningStatus.ActionRequired => next is
                ScreeningStatus.Processing or
                ScreeningStatus.Expired or
                ScreeningStatus.Failed,

            ScreeningStatus.Complete => next is ScreeningStatus.Disputed,

            ScreeningStatus.Disputed => next is
                ScreeningStatus.Processing or
                ScreeningStatus.Complete or
                ScreeningStatus.ActionRequired or
                ScreeningStatus.Failed,

            ScreeningStatus.Expired or ScreeningStatus.Failed => false,
            _ => false
        };
    }
}
