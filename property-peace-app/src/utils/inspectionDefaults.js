// The same starter inspection items are used whether a checklist is created
// from its property workspace or from the portfolio list.
export const DEFAULT_INSPECTION_ITEMS = [
  { category: 'Kitchen', names: ['Walls & Ceiling', 'Floors', 'Countertops', 'Cabinets & Drawers', 'Sink & Faucet', 'Refrigerator', 'Stove & Oven', 'Dishwasher', 'Microwave', 'Light Fixtures & Outlets'] },
  { category: 'Living Room', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Doors & Locks', 'Light Fixtures & Outlets'] },
  { category: 'Bedroom', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Closet & Doors', 'Light Fixtures & Outlets'] },
  { category: 'Bathroom', names: ['Walls & Ceiling', 'Floors', 'Toilet', 'Sink & Faucet', 'Shower & Tub', 'Exhaust Fan', 'Light Fixtures & Mirror'] },
  { category: 'Laundry', names: ['Washer & Dryer Hookups', 'Floors'] },
  { category: 'General', names: ['Entry Door & Locks', 'Smoke Detectors', 'Carbon Monoxide Detectors', 'HVAC Filter', 'Keys & Access Cards'] }
];

export function defaultInspectionItems() {
  let sortOrder = 0;
  return DEFAULT_INSPECTION_ITEMS.flatMap(({ category, names }) =>
    names.map((name) => ({ Name: name, Category: category, SortOrder: sortOrder++, IsChecked: false }))
  );
}
