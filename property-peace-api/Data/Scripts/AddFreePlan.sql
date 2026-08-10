-- DEPRECATED / INTENTIONALLY NON-EXECUTABLE.
--
-- This legacy seed cannot safely reconcile Free packaging in a live environment because
-- subscription plan/provider state is managed through the application and reviewed admin
-- workflows. It is retained only so historical references do not break.
--
-- Do not add data mutations here. Use an explicit, reviewed migration whose preconditions,
-- provider reconciliation, and idempotency are testable.

SET NOCOUNT ON;
THROW 51000, 'AddFreePlan.sql is deprecated and must not be executed. Use a reviewed subscription-plan migration.', 1;
