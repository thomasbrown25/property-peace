import type { Checklist, Id } from './checklistTypes';

const sameId = (left?: Id | null, right?: Id | null) => left != null && right != null && String(left) === String(right);
const roomKey = (value?: string | null) => (value?.trim() || 'General').toLowerCase();
const roomLabel = (value?: string | null) => value?.trim() || 'General';

const roomNames = (checklist: Checklist) => {
  const names: string[] = [];
  [...(checklist.roomNames ?? []), ...checklist.items.map((item) => roomLabel(item.category))].forEach((name) => {
    if (!names.some((existing) => roomKey(existing) === roomKey(name))) names.push(roomLabel(name));
  });
  return names;
};

const addRoom = (checklist: Checklist, proposedName: string) => {
  const name = proposedName.trim();
  if (!name) throw new Error('Room name is required');
  if (roomNames(checklist).some((room) => roomKey(room) === roomKey(name))) throw new Error('That room already exists');
  return { ...checklist, roomNames: [...(checklist.roomNames ?? []), name] };
};

const renameRoom = (checklist: Checklist, currentName: string, proposedName: string) => {
  const name = proposedName.trim();
  if (!name) throw new Error('Room name is required');
  if (roomNames(checklist).some((room) => roomKey(room) !== roomKey(currentName) && roomKey(room) === roomKey(name))) {
    throw new Error('That room already exists');
  }
  const nextNames = (checklist.roomNames ?? []).map((room) => roomKey(room) === roomKey(currentName) ? name : room);
  if (!nextNames.some((room) => roomKey(room) === roomKey(name))) nextNames.push(name);
  return {
    ...checklist,
    roomNames: nextNames,
    items: checklist.items.map((item) => roomKey(item.category) === roomKey(currentName) ? { ...item, category: name } : item),
  };
};

export const withChecklistItemDetails = (
  checklist: Checklist,
  itemId: Id,
  details: { notes: string; damageDescription: string },
): Checklist => ({
  ...checklist,
  items: checklist.items.map((item) => sameId(item.id, itemId) ? {
    ...item,
    notes: details.notes.trim(),
    damageDescription: details.damageDescription.trim(),
    hasDamage: Boolean(details.damageDescription.trim()),
  } : item),
});

export const addRoomToChecklistPair = (
  active: Checklist,
  counterpart: Checklist | null,
  roomName: string,
) => ({
  active: addRoom(active, roomName),
  counterpart: counterpart && !roomNames(counterpart).some((room) => roomKey(room) === roomKey(roomName))
    ? addRoom(counterpart, roomName)
    : counterpart,
});

export const renameRoomInChecklistPair = (
  active: Checklist,
  counterpart: Checklist | null,
  currentName: string,
  nextName: string,
) => ({
  active: renameRoom(active, currentName, nextName),
  counterpart: counterpart && roomNames(counterpart).some((room) => roomKey(room) === roomKey(currentName))
    ? renameRoom(counterpart, currentName, nextName)
    : counterpart,
});

type ChecklistUpdateGateway = {
  update: (id: Id, checklist: Checklist) => Promise<Checklist>;
};

export const persistChecklistPair = async (
  currentActive: Checklist,
  nextActive: Checklist,
  currentCounterpart: Checklist | null,
  nextCounterpart: Checklist | null,
  gateway: ChecklistUpdateGateway,
): Promise<{ active: Checklist; counterpart: Checklist | null }> => {
  if (nextActive.id == null) throw new Error('Checklist ID is missing');
  if (currentActive.counterpartChecklistId != null && currentCounterpart == null) {
    throw new Error('The connected checklist is unavailable. Refresh it before changing rooms.');
  }
  const savedActive = await gateway.update(nextActive.id, nextActive);
  if (nextCounterpart?.id == null) {
    return { active: savedActive, counterpart: currentCounterpart };
  }

  try {
    return {
      active: savedActive,
      counterpart: await gateway.update(nextCounterpart.id, nextCounterpart),
    };
  } catch (counterpartError) {
    if (currentActive.id == null) {
      throw new Error(
        'The connected checklist did not update and the active checklist cannot be restored. Refresh before making another change.',
        { cause: counterpartError },
      );
    }
    try {
      await gateway.update(currentActive.id, currentActive);
    } catch (rollbackError) {
      throw new Error(
        'The connected checklist did not update and restoring the active checklist also failed. Refresh before making another change.',
        { cause: { counterpartError, rollbackError } },
      );
    }
    throw new Error(
      'The connected checklist did not update. The active checklist was restored; retry the room change.',
      { cause: counterpartError },
    );
  }
};
