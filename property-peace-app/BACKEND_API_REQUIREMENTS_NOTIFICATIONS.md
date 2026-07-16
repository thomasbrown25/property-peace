# Backend API Requirements - Notifications

This document outlines the backend API endpoints required for the notifications feature.

## Base URL
All endpoints are prefixed with `/api/notifications`

## Endpoints

### 1. Get Notifications List
**GET** `/api/notifications/:userId/list`

Returns all notifications for a user, ordered by most recent first.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "userId": 123,
        "type": "rent" | "maintenance" | "payment" | "lease" | "message",
        "title": "Rent Payment Due",
        "message": "Rent payment of $1,500 is due on January 1, 2024",
        "isRead": false,
        "createdAt": "2024-01-01T10:00:00Z",
        "relatedId": 456, // Optional: ID of related entity (propertyId, maintenanceId, leaseId, etc.)
        "metadata": {} // Optional: Additional data
      }
    ],
    "unreadCount": 5
  }
}
```

**Alternative Response Format (if unreadCount is separate):**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "unreadCount": 5
  }
}
```

**OR:**
```json
{
  "success": true,
  "notifications": [...],
  "unreadCount": 5
}
```

### 2. Get Unread Count
**GET** `/api/notifications/:userId/unread-count`

Returns only the count of unread notifications.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

**OR:**
```json
{
  "success": true,
  "unreadCount": 5
}
```

### 3. Mark Notification as Read
**POST** `/api/notifications/mark-read/:notificationId`

Marks a single notification as read.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "isRead": true
  }
}
```

### 4. Mark All Notifications as Read
**POST** `/api/notifications/:userId/mark-all-read`

Marks all notifications for a user as read.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "updatedCount": 10
  }
}
```

## Notification Types

The `type` field should be one of:
- `"rent"` - Rent-related notifications (due dates, overdue, etc.)
- `"maintenance"` - Maintenance request updates
- `"payment"` - Payment confirmations
- `"lease"` - Lease-related notifications (expirations, renewals, etc.)
- `"message"` - General messages

## Related IDs

The `relatedId` field should contain the ID of the related entity:
- For `rent` type: propertyId or leaseId
- For `maintenance` type: maintenanceId
- For `lease` type: leaseId
- For `payment` type: paymentId or leaseId

## Authentication

All endpoints require authentication. The user ID should be extracted from the JWT token, but can also be passed as a URL parameter for convenience.

## Error Responses

All endpoints should return errors in this format:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE" // Optional
}
```

## Notes

1. The frontend uses SWR for data fetching, which automatically refetches every 30 seconds for the notifications list and unread count.
2. The frontend expects notifications to be sorted by most recent first (newest at the top).
3. The `createdAt` field should be in ISO 8601 format (e.g., "2024-01-01T10:00:00Z").
4. The `isRead` field is a boolean indicating whether the notification has been read.
5. When a user clicks on a notification, the frontend will navigate to the related page based on the `type` and `relatedId` fields.

