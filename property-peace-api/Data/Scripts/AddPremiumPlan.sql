-- DEPRECATED / INTENTIONALLY NON-EXECUTABLE.
--
-- This legacy seed must not rewrite Premium MonthlyPrice or AnnualPrice. Doing so while
-- retaining an existing StripePriceIdMonthly/StripePriceIdAnnual would make displayed pricing
-- disagree with provider billing; clearing or inventing provider IDs could also orphan active
-- subscriptions. It is retained only so historical references do not break.
--
-- Reconcile Premium pricing only through an explicit, reviewed provider-first workflow that
-- creates real Stripe prices, safely migrates active subscriptions, and then updates database
-- price values and IDs together. Do not add data mutations here.

SET NOCOUNT ON;
THROW 51000, 'AddPremiumPlan.sql is deprecated and must not be executed. Use a reviewed provider-first pricing migration.', 1;
