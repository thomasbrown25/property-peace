# Conversation Message Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every support and Messages conversation a readable shared light-blue/black bubble style and simplify Messages-page creation actions.

**Architecture:** Add a focused presentation utility that owns the shared bubble tokens, direction-aware corner shape, nested typography contrast, and group-management visibility policy. Consume it from existing support and Messages renderers without changing their data or interaction flows.

**Tech Stack:** React 19, Material UI 7 `sx` styling, Node.js built-in test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-08-27-conversation-message-styling.md`

## Global Constraints

- Both sent and received message bubbles use background `#E7F3FB`, text `#000000`, and border `#B8D8EC`.
- Sender direction remains visible through alignment and directional top corners.
- Urgent-message and AI-suggested-reply cards remain distinct.
- Existing uncommitted workspace changes must be preserved.
- No new dependencies.

---

### Task 1: Shared conversation presentation contract

**Files:**
- Create: `property-peace-app/src/utils/conversationPresentation.js`
- Test: `property-peace-app/src/utils/conversationPresentation.test.js`

**Interfaces:**
- Produces: `getConversationBubbleSx({ isOwn, isConsecutive })`, returning an MUI `sx` object with shared colors, nested Typography contrast, and direction-aware top corners.
- Produces: `canManageGroupConversation(conversation)`, returning true only for an existing group conversation.

- [ ] **Step 1: Write failing tests for shared contrast, direction-aware corners, and group-management visibility**

```js
assert.equal(sent.bgcolor, '#E7F3FB');
assert.equal(received.bgcolor, '#E7F3FB');
assert.equal(sent['& .MuiTypography-root'].color, '#000000');
assert.equal(received['& .MuiTypography-root'].color, '#000000');
assert.equal(sent.borderTopRightRadius, '4px');
assert.equal(received.borderTopLeftRadius, '4px');
assert.equal(canManageGroupConversation({ isGroupChat: true }), true);
assert.equal(canManageGroupConversation({ isGroupChat: false }), false);
```

- [ ] **Step 2: Run the focused test and confirm it fails because the utility does not exist**

Run: `node --experimental-default-type=module --test src/utils/conversationPresentation.test.js`

Expected: FAIL with a missing-module error for `conversationPresentation.js`.

- [ ] **Step 3: Implement the minimal presentation utility**

```js
export function getConversationBubbleSx({ isOwn = false, isConsecutive = false } = {}) {
  return {
    bgcolor: '#E7F3FB',
    color: '#000000',
    border: '1px solid #B8D8EC',
    borderRadius: '16px',
    borderTopLeftRadius: isConsecutive ? '8px' : isOwn ? '16px' : '4px',
    borderTopRightRadius: isConsecutive ? '8px' : isOwn ? '4px' : '16px',
    '& .MuiTypography-root': { color: '#000000' }
  };
}

export function canManageGroupConversation(conversation) {
  return Boolean(conversation && (conversation.isGroupChat ?? conversation.IsGroupChat));
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `node --experimental-default-type=module --test src/utils/conversationPresentation.test.js`

Expected: all tests pass.

### Task 2: Apply the shared presentation to support and Messages views

**Files:**
- Modify: `property-peace-app/src/sections/landlord/support/SupportTicketCenter.jsx`
- Modify: `property-peace-app/src/sections/admin/support/AdminSupportWorkspace.jsx`
- Modify: `property-peace-app/src/pages/landlord/messages.jsx`
- Modify: `property-peace-app/src/pages/tenant/messages.jsx`
- Modify: `property-peace-app/src/pages/admin/messages.jsx`

**Interfaces:**
- Consumes: `getConversationBubbleSx({ isOwn, isConsecutive })` and `canManageGroupConversation(conversation)` from Task 1.
- Produces: consistent readable conversation bubbles in every support/Messages renderer and simplified Messages header actions.

- [ ] **Step 1: Replace each ordinary sent/received bubble's color, border, and corner declarations with the shared helper**

Use the correct ownership mapping in each view: landlord support `!isFromSupport`, admin support `isFromSupport`, and each Messages page's existing `isOwn` flag. Preserve page-specific padding, sizing, optimistic opacity, avatars, timestamps, urgent cards, and suggested-reply cards.

- [ ] **Step 2: Simplify Messages-page creation actions**

Render `GroupConversationManager` only when `canManageGroupConversation(selectedConversation)` is true. Set landlord and tenant header **New message** buttons to `size="small"`, `color="success"`, minimum height `34`, and navy `#061E35` text; apply the same success treatment to the tenant empty-state **New message** action.

- [ ] **Step 3: Format only the changed files**

Run: `npx prettier --write src/utils/conversationPresentation.js src/utils/conversationPresentation.test.js src/sections/landlord/support/SupportTicketCenter.jsx src/sections/admin/support/AdminSupportWorkspace.jsx src/pages/landlord/messages.jsx src/pages/tenant/messages.jsx src/pages/admin/messages.jsx`

- [ ] **Step 4: Run focused tests**

Run: `node --experimental-default-type=module --test src/utils/conversationPresentation.test.js src/utils/supportTicketMessages.test.js`

Expected: all tests pass.

- [ ] **Step 5: Build the application**

Run: `npm run build`

Expected: Vite exits successfully with no compilation errors.

- [ ] **Step 6: Review the task-scoped diff against the approved design**

Confirm all five ordinary message renderers consume the helper, nested Typography receives black text, only existing groups expose management, and unrelated dirty files are unchanged.
