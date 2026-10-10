import { DEFAULT_INSPECTION_ITEMS } from './inspectionDefaults.js';

export const MAX_FLOORS = 20;
export const MAX_ROOMS_PER_FLOOR = 20;

function validCount(value, min, max) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const text = String(value);
  return /^\d+$/.test(text) && Number(text) >= min && Number(text) <= max;
}

export function isValidBathroomCount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const text = String(value);
  return /^(?:0|[1-9]\d*)(?:\.5)?$/.test(text) && Number(text) <= MAX_ROOMS_PER_FLOOR + 0.5;
}

export function isValidFloorPlan(floorCount, floors) {
  return validCount(floorCount, 1, MAX_FLOORS)
    && floors.length >= Number(floorCount)
    && floors.slice(0, Number(floorCount)).every((floor) =>
      validCount(floor?.bedrooms, 0, MAX_ROOMS_PER_FLOOR)
      && isValidBathroomCount(floor?.bathrooms));
}

export function floorLabel(number) {
  const suffix = number % 100 >= 11 && number % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th');
  return `${number}${suffix} Floor`;
}

export function getRoomNameErrors(roomNames) {
  const seen = new Set();
  return roomNames.map((value) => {
    const name = String(value || '').trim();
    if (!name) return 'Enter a room name';
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return 'Room names must be unique';
    seen.add(key);
    return '';
  });
}

export function removeInspectionRooms(items, removedRoomNames) {
  const removed = new Set(removedRoomNames);
  return items.filter((item) => !removed.has(item.Category))
    .map((item, index) => ({ ...item, SortOrder: index }));
}

export function applyRoomNames(items, roomNames) {
  const originalNames = [...new Set(items.map((item) => item.Category))];
  if (originalNames.length !== roomNames.length || getRoomNameErrors(roomNames).some(Boolean)) {
    throw new Error('Enter a unique name for every room');
  }
  const renamed = new Map(originalNames.map((name, index) => [name, roomNames[index].trim()]));
  return items.map((item) => ({ ...item, Category: renamed.get(item.Category) }));
}

export function buildFloorInspectionItems(floors) {
  let sortOrder = 0;
  const items = [];
  const addRoom = (category, names) => {
    names.forEach((name) => items.push({ Name: name, Category: category, SortOrder: sortOrder++, IsChecked: false }));
  };

  const multipleFloors = floors.length > 1;
  const totals = {
    Bedroom: floors.reduce((total, floor) => total + Number(floor.bedrooms), 0),
    BathroomFull: floors.reduce((total, floor) => total + Math.floor(Number(floor.bathrooms)), 0),
    BathroomHalf: floors.reduce((total, floor) => total + (Number(floor.bathrooms) % 1 === 0.5 ? 1 : 0), 0)
  };
  const numbers = { Bedroom: 0, BathroomFull: 0, BathroomHalf: 0 };
  const roomName = (floorIndex, category, number) => {
    const prefix = multipleFloors && floorIndex > 0 ? `${floorLabel(floorIndex + 1)} - ` : '';
    const suffix = totals[category] > 1 ? ` ${number}` : '';
    return `${prefix}${category}${suffix}`;
  };
  const bathroomName = (floorIndex, kind) => {
    numbers[kind] += 1;
    const prefix = multipleFloors && floorIndex > 0 ? `${floorLabel(floorIndex + 1)} - ` : '';
    const label = kind === 'BathroomHalf' ? 'Bathroom Half' : totals.BathroomHalf ? 'Bathroom Full' : 'Bathroom';
    const suffix = totals[kind] > 1 ? ` ${numbers[kind]}` : '';
    return `${prefix}${label}${suffix}`;
  };
  floors.forEach((floor, index) => {
    DEFAULT_INSPECTION_ITEMS.forEach(({ category, names }) => {
      if (category === 'Bedroom') {
        for (let number = 0; number < Number(floor.bedrooms); number += 1) {
          numbers.Bedroom += 1;
          addRoom(roomName(index, 'Bedroom', numbers.Bedroom), names);
        }
      } else if (category === 'Bathroom') {
        const bathroomCount = Number(floor.bathrooms);
        for (let number = 0; number < Math.floor(bathroomCount); number += 1) {
          addRoom(bathroomName(index, 'BathroomFull'), names);
        }
        if (bathroomCount % 1 === 0.5) addRoom(bathroomName(index, 'BathroomHalf'), names);
      } else if (index === 0) {
        addRoom(category, names);
      }
    });
  });
  return items;
}

// Keep existing checklists readable without rewriting persisted room names or item sort orders.
export function sortRoomsByFloor(rooms) {
  const floorNumber = (name) => {
    const match = /^(\d+)(?:st|nd|rd|th) Floor(?=\s*-\s*|\s|$)/i.exec(name);
    return match ? Number(match[1]) : Infinity;
  };
  const hasNamedFirstFloor = rooms.some((room) => floorNumber(room.name) === 1);
  // Older floor-prefixed checklists may have loose custom rooms; keep those last.
  // Newer lists without a "1st Floor" prefix treat unprefixed rooms as floor one.
  return rooms.map((room, index) => {
    const floor = floorNumber(room.name);
    return { room, index, floor: floor === Infinity && !hasNamedFirstFloor ? 1 : floor };
  })
    .sort((a, b) => a.floor - b.floor || a.index - b.index)
    .map(({ room }) => room);
}
