# Notification/Alert Trigger Workflow

This document explains how the notification/alert system works and when notifications should be triggered.

## Overview

The notification system works in two parts:
1. **Backend**: Creates notifications when events occur (e.g., rent payment, maintenance updates)
2. **Frontend**: Displays notifications to users and allows them to mark as read/manage preferences

## Current Frontend Implementation

The frontend is already set up to:
- Display notifications in the navbar bell icon
- Show a full notifications page (`/landlord/notifications`)
- Allow users to mark notifications as read
- Allow users to configure notification preferences (`/landlord/settings?tab=notifications`)
- Auto-refresh notifications every 30 seconds

## Payment Workflow Example

### Current Payment Flow:

1. **User Action**: Landlord clicks "Make Payment" button on a rent card
2. **Frontend**: Opens `PaymentModal` component
3. **User Confirms**: Landlord enters payment date and amount, clicks "Confirm"
4. **Frontend Action**: Dispatches `makePayment(leaseId, paymentDate, amount)` to Redux
5. **API Call**: Frontend sends `POST /api/rent-collection/payment` to backend
6. **Backend Processing**: Backend should:
   - Process the payment
   - Update rent records
   - **TRIGGER NOTIFICATION** (if enabled in user's preferences)

### Backend Notification Trigger (Example):

When a payment is successfully processed, the backend should:

```javascript
// Pseudocode for backend
async function processPayment(leaseId, paymentDate, amount, landlordId) {
  // 1. Process the payment
  const payment = await savePayment(leaseId, paymentDate, amount);
  
  // 2. Update rent records
  await updateRentStatus(leaseId);
  
  // 3. Get landlord's notification preferences
  const notificationSettings = await getNotificationSettings(landlordId);
  
  // 4. Check if payment confirmations are enabled
  if (notificationSettings?.paymentConfirmations?.email || 
      notificationSettings?.paymentConfirmations?.phone) {
    
    // 5. Create notification record
    await createNotification({
      userId: landlordId,
      type: 'payment',
      title: 'Payment Received',
      message: `Payment of $${amount} was received for ${propertyName}`,
      relatedId: leaseId,
      isRead: false,
      createdAt: new Date()
    });
    
    // 6. Send email/SMS if enabled
    if (notificationSettings.paymentConfirmations.email) {
      await sendEmail({
        to: notificationSettings.emailAddress,
        subject: 'Payment Confirmation',
        body: `Payment of $${amount} was received for ${propertyName} on ${paymentDate}`
      });
    }
    
    if (notificationSettings.paymentConfirmations.phone) {
      await sendSMS({
        to: notificationSettings.phoneNumber,
        message: `Payment of $${amount} received for ${propertyName}`
      });
    }
  }
  
  return payment;
}
```

## When to Trigger Notifications

Notifications should be triggered automatically by the backend when these events occur:

### 1. **Rent Reminders** (Scheduled)
- **Trigger**: Daily job that checks for upcoming rent due dates
- **When**: 
  - 7 days before rent is due
  - 3 days before rent is due
  - On the due date
- **Type**: `"rent"`
- **Condition**: Check `settings.rentReminders.email` or `settings.rentReminders.phone`
- **Example**: "Rent of $1,500 is due on January 1, 2024 for 123 Main St"

### 2. **Overdue Alerts** (Scheduled)
- **Trigger**: Daily job that checks for overdue rent
- **When**: 
  - 1 day after due date
  - 7 days after due date
  - 14 days after due date
  - Every 7 days thereafter until paid
- **Type**: `"rent"` (with `relatedId` pointing to lease/property)
- **Condition**: Check `settings.overdueAlerts.email` or `settings.overdueAlerts.phone`
- **Example**: "Rent of $1,500 is overdue for 123 Main St. Total overdue: $3,000"

### 3. **Payment Confirmations** (Immediate)
- **Trigger**: When a payment is successfully processed
- **When**: Immediately after `POST /api/rent-collection/payment` succeeds
- **Type**: `"payment"`
- **Condition**: Check `settings.paymentConfirmations.email` or `settings.paymentConfirmations.phone`
- **Example**: "Payment of $1,500 received for 123 Main St on January 1, 2024"

### 4. **Maintenance Updates** (Immediate)
- **Trigger**: When maintenance request status changes
- **When**: 
  - Maintenance request is created
  - Maintenance status changes (e.g., "In Progress", "Completed")
  - Maintenance is assigned to a vendor
- **Type**: `"maintenance"`
- **Condition**: Check `settings.maintenanceUpdates.email` or `settings.maintenanceUpdates.phone`
- **Example**: "Maintenance request #123 for 123 Main St has been completed"

### 5. **Lease Expiration Alerts** (Scheduled)
- **Trigger**: Daily job that checks lease expiration dates
- **When**: 
  - 90 days before expiration
  - 60 days before expiration
  - 30 days before expiration
  - On expiration date
- **Type**: `"lease"`
- **Condition**: Check `settings.leaseExpiration.email` or `settings.leaseExpiration.phone`
- **Example**: "Lease for 123 Main St expires on January 31, 2024"

### 6. **New Tenant Notifications** (Immediate)
- **Trigger**: When a new tenant is added to a property
- **When**: After `POST /api/tenant` or `POST /api/household` succeeds
- **Type**: `"message"`
- **Condition**: Check `settings.newTenantNotifications.email` or `settings.newTenantNotifications.phone`
- **Example**: "New tenant John Doe has been added to 123 Main St, Unit 2"

## Backend API Endpoint for Creating Notifications

You'll need to add this endpoint to create notifications:

### **POST** `/api/notifications/create`

Creates a new notification and optionally sends email/SMS.

**Request Body:**
```json
{
  "userId": 123,
  "type": "payment",
  "title": "Payment Received",
  "message": "Payment of $1,500 was received for 123 Main St",
  "relatedId": 456, // Optional: leaseId, propertyId, maintenanceId, etc.
  "sendEmail": true, // Optional: defaults to false
  "sendSMS": true, // Optional: defaults to false
  "metadata": {} // Optional: Additional data
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 789,
    "userId": 123,
    "type": "payment",
    "title": "Payment Received",
    "message": "Payment of $1,500 was received for 123 Main St",
    "isRead": false,
    "createdAt": "2024-01-01T10:00:00Z",
    "relatedId": 456
  }
}
```

**Implementation Notes:**
- This endpoint should check the user's notification preferences before sending email/SMS
- If `sendEmail: true` and user has email enabled for this notification type, send email
- If `sendSMS: true` and user has phone enabled for this notification type, send SMS
- Always create the notification record, even if email/SMS is disabled

## Integration Points

### 1. Payment Processing
**File**: Backend route handler for `POST /api/rent-collection/payment`

```javascript
// After successfully processing payment:
const landlordId = payment.landlordId;
const notificationSettings = await getNotificationSettings(landlordId);

if (notificationSettings?.paymentConfirmations?.email || 
    notificationSettings?.paymentConfirmations?.phone) {
  
  await axios.post('/api/notifications/create', {
    userId: landlordId,
    type: 'payment',
    title: 'Payment Received',
    message: `Payment of $${amount} was received for ${propertyName}`,
    relatedId: leaseId,
    sendEmail: notificationSettings.paymentConfirmations.email,
    sendSMS: notificationSettings.paymentConfirmations.phone
  });
}
```

### 2. Scheduled Jobs (Cron/Scheduled Tasks)

You'll need scheduled jobs that run daily to check for:
- Rent due dates (rent reminders)
- Overdue rent (overdue alerts)
- Lease expirations (lease expiration alerts)

**Example Scheduled Job Structure:**

```javascript
// Daily job (runs at 9 AM)
async function dailyNotificationJob() {
  const landlords = await getAllLandlords();
  
  for (const landlord of landlords) {
    const settings = await getNotificationSettings(landlord.id);
    
    // Check for rent due in 7 days
    if (settings.rentReminders.email || settings.rentReminders.phone) {
      const upcomingRent = await getRentDueInDays(landlord.id, 7);
      for (const rent of upcomingRent) {
        await createNotification({
          userId: landlord.id,
          type: 'rent',
          title: 'Rent Due Soon',
          message: `Rent of $${rent.amount} is due on ${rent.dueDate} for ${rent.propertyName}`,
          relatedId: rent.leaseId,
          sendEmail: settings.rentReminders.email,
          sendSMS: settings.rentReminders.phone
        });
      }
    }
    
    // Check for overdue rent
    if (settings.overdueAlerts.email || settings.overdueAlerts.phone) {
      const overdueRent = await getOverdueRent(landlord.id);
      for (const rent of overdueRent) {
        await createNotification({
          userId: landlord.id,
          type: 'rent',
          title: 'Rent Overdue',
          message: `Rent of $${rent.amount} is overdue for ${rent.propertyName}`,
          relatedId: rent.leaseId,
          sendEmail: settings.overdueAlerts.email,
          sendSMS: settings.overdueAlerts.phone
        });
      }
    }
    
    // Check for expiring leases
    if (settings.leaseExpiration.email || settings.leaseExpiration.phone) {
      const expiringLeases = await getLeasesExpiringInDays(landlord.id, 30);
      for (const lease of expiringLeases) {
        await createNotification({
          userId: landlord.id,
          type: 'lease',
          title: 'Lease Expiring Soon',
          message: `Lease for ${lease.propertyName} expires on ${lease.expirationDate}`,
          relatedId: lease.id,
          sendEmail: settings.leaseExpiration.email,
          sendSMS: settings.leaseExpiration.phone
        });
      }
    }
  }
}
```

## Notification Settings Structure

The notification settings saved via `POST /api/user/notification-settings` should have this structure:

```json
{
  "emailEnabled": true,
  "phoneEnabled": true,
  "emailAddress": "landlord@example.com",
  "phoneNumber": "(555) 123-4567",
  "rentReminders": {
    "email": true,
    "phone": false
  },
  "overdueAlerts": {
    "email": true,
    "phone": true
  },
  "paymentConfirmations": {
    "email": true,
    "phone": true
  },
  "maintenanceUpdates": {
    "email": true,
    "phone": false
  },
  "leaseExpiration": {
    "email": true,
    "phone": true
  },
  "newTenantNotifications": {
    "email": true,
    "phone": false
  }
}
```

## Summary

**To trigger notifications when rent is paid:**

1. In your backend payment processing endpoint (`POST /api/rent-collection/payment`):
   - After successfully saving the payment
   - Fetch the landlord's notification settings
   - Check if `paymentConfirmations` is enabled
   - Call `/api/notifications/create` with appropriate data
   - If email/SMS enabled, send those as well

2. **For scheduled notifications** (rent reminders, overdue alerts, lease expirations):
   - Set up a daily cron job or scheduled task
   - Check for conditions (upcoming rent, overdue rent, expiring leases)
   - Create notifications for landlords who have those preferences enabled

The frontend will automatically display these notifications within 30 seconds (via SWR auto-refresh).

