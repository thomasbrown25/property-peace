import type {
  AddChecklistItemPayload,
  AddChecklistPayload,
  Checklist,
  ChecklistHome,
  ChecklistLease,
  Id,
  UpdateChecklistPayload,
} from './checklistTypes';

const MOVE_IN = 40;
const MOVE_OUT = 41;

const DEFAULT_INSPECTION_ROOMS = [
  { category: 'Kitchen', names: ['Walls & Ceiling', 'Floors', 'Countertops', 'Cabinets & Drawers', 'Sink & Faucet', 'Refrigerator', 'Stove & Oven', 'Dishwasher', 'Microwave', 'Light Fixtures & Outlets'] },
  { category: 'Living Room', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Doors & Locks', 'Light Fixtures & Outlets'] },
  { category: 'Bedroom', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Closet & Doors', 'Light Fixtures & Outlets'] },
  { category: 'Bathroom', names: ['Walls & Ceiling', 'Floors', 'Toilet', 'Sink & Faucet', 'Shower & Tub', 'Exhaust Fan', 'Light Fixtures & Mirror'] },
  { category: 'Laundry', names: ['Washer & Dryer Hookups', 'Floors'] },
  { category: 'General', names: ['Entry Door & Locks', 'Smoke Detectors', 'Carbon Monoxide Detectors', 'HVAC Filter', 'Keys & Access Cards'] },
] as const;

export interface StartChecklistInput {
  type: 40 | 41;
  home: ChecklistHome;
  now: string;
  counterpart?: Checklist | null;
  lease?: ChecklistLease | null;
  inspectionDate?: string | null;
}

export interface ChecklistGateway {
  create(payload: AddChecklistPayload): Promise<Checklist>;
  update(id: Id, checklist: Checklist | UpdateChecklistPayload): Promise<Checklist>;
  remove(id: Id): Promise<void>;
}

const idOf = (source: any): Id | null => source?.id ?? source?.Id ?? null;
const listOf = <T>(source: any, camel: string, pascal: string): T[] => source?.[camel] ?? source?.[pascal] ?? [];

const defaultItems = (): AddChecklistItemPayload[] => {
  let sortOrder = 0;
  return DEFAULT_INSPECTION_ROOMS.flatMap(({ category, names }) => names.map((name) => ({
    Name: name,
    Category: category,
    SortOrder: sortOrder++,
  })));
};

const counterpartItems = (checklist: Checklist): AddChecklistItemPayload[] => checklist.items.map((item) => ({
  Name: item.name,
  Category: item.category?.trim() || 'General',
  SortOrder: item.sortOrder ?? 0,
}));

const tenantFrom = (lease?: ChecklistLease | null) => listOf<any>(lease, 'tenants', 'Tenants')[0] ?? null;

export const buildStartChecklistPayload = (input: StartChecklistInput): AddChecklistPayload => {
  const { home, counterpart } = input;
  const lease = input.lease ?? null;
  const tenant = tenantFrom(lease);
  const items = counterpart?.items?.length ? counterpartItems(counterpart) : defaultItems();
  const roomNames = counterpart
    ? [...new Set([...(counterpart.roomNames ?? []), ...items.map((item) => item.Category || 'General')])]
    : DEFAULT_INSPECTION_ROOMS.map(({ category }) => category);
  const typeLabel = input.type === MOVE_IN ? 'Move-In' : 'Move-Out';
  const unitLabel = home.unitName ? ` – ${home.unitName}` : '';

  return {
    ChecklistType: input.type,
    PropertyId: Number(home.propertyId),
    UnitId: home.unitId ? Number(home.unitId) : null,
    LeaseId: counterpart?.leaseId ?? idOf(lease),
    TenantId: counterpart?.tenantId ?? idOf(tenant),
    CounterpartChecklistId: counterpart?.id ?? null,
    Title: `${home.propertyName}${unitLabel} – ${typeLabel} Checklist`,
    InspectionDate: input.inspectionDate !== undefined ? input.inspectionDate : input.now,
    RoomNames: roomNames,
    Items: items,
  };
};

export const startChecklistCycle = async (
  input: StartChecklistInput,
  gateway: ChecklistGateway,
): Promise<{ primary: Checklist; counterpart?: Checklist }> => {
  const createdIds: Id[] = [];
  try {
    const primary = await gateway.create(buildStartChecklistPayload(input));
    if (primary.id == null) throw new Error('Created checklist did not include an ID');
    createdIds.push(primary.id);

    if (input.counterpart) {
      if (input.counterpart.id == null) throw new Error('Counterpart checklist did not include an ID');
      const linkedCounterpart = await gateway.update(input.counterpart.id, {
        Id: Number(input.counterpart.id),
        CounterpartChecklistId: primary.id,
      });
      return { primary, counterpart: linkedCounterpart };
    }

    if (input.type !== MOVE_IN) return { primary };

    const moveOut = await gateway.create(buildStartChecklistPayload({
      ...input,
      type: MOVE_OUT,
      counterpart: primary,
      inspectionDate: null,
    }));
    if (moveOut.id == null) throw new Error('Created move-out checklist did not include an ID');
    createdIds.push(moveOut.id);

    const linkedMoveIn = await gateway.update(primary.id, {
      Id: Number(primary.id),
      CounterpartChecklistId: moveOut.id,
    });
    return { primary: linkedMoveIn, counterpart: moveOut };
  } catch (error) {
    const cleanup = await Promise.allSettled([...createdIds].reverse().map((id) => gateway.remove(id)));
    if (cleanup.some((result) => result.status === 'rejected')) {
      const original = error instanceof Error ? error.message : 'unknown error';
      throw new Error(
        `Checklist creation failed and cleanup left incomplete records. Refresh checklist history before retrying. Original error: ${original}`,
        { cause: error },
      );
    }
    throw error;
  }
};
