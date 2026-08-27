# Conversation Message Styling Design

## Goal

Make support and in-app conversation text reliably readable while giving sent and received messages one consistent visual treatment.

## Approved design

- Use a light-blue background, black text, and a subtle blue border for both sent and received message bubbles.
- Preserve sender direction through left/right alignment and directional top corners.
- Apply the shared treatment to landlord support, admin support, and landlord, tenant, and admin Messages views.
- Leave urgent-message and AI-suggested-reply cards visually distinct.
- Remove the landlord Messages page's **New group** action, but retain **Manage group** for an already-selected group conversation.
- Make Messages-page **New message** actions slightly smaller, with a green background and navy text.

## Visual tokens

- Bubble surface: `#E7F3FB`
- Bubble text: `#000000`
- Bubble border: `#B8D8EC`
- Action green: the existing `success` palette
- Action text: Property Peace navy `#061E35`

## Constraints

- The fixed bubble foreground must be applied directly to nested Typography because the global Typography override sets `body2` and `caption` colors explicitly.
- Existing alignment, avatars, timestamps, optimistic state, urgent-message treatment, and reply behavior remain unchanged.
