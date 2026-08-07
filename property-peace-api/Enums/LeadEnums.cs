namespace brownstone_hub_api.Enums;

public enum LeadStatus { New = 0, Contacted = 1, Qualified = 2, ShowingScheduled = 3, Applied = 4, Lost = 5 }
public enum LeadSourceKind { ListingWebsite = 0, Syndication = 1, Referral = 2, Direct = 3, Other = 4 }
public enum ShowingStatus { Confirmed = 0, Cancelled = 1, Completed = 2, NoShow = 3 }
public enum LeadTaskStatus { Open = 0, Completed = 1, Cancelled = 2 }
public enum LeadNotificationKind { ContactVerification = 0, ShowingConfirmation = 1, ShowingReminder = 2, ShowingCancellation = 3, ShowingRescheduled = 4 }
public enum NotificationIntentStatus { Pending = 0, Sent = 1, Failed = 2, Cancelled = 3 }
public enum LeadTokenPurpose { ContactVerification = 0, PublicManagement = 1 }
