import { createSelector } from '@reduxjs/toolkit';

export const selectUnit = (state) => state.unit.selectedUnit;
export const selectUnits = (state) => state.unit.units;
export const selectSelectedUnits = (state) => state.unit.selectedUnits;
export const selectSelectedUnitIds = (state) => state.unit.selectedUnitIds;

export const selectUnitCount = createSelector([selectUnits], (units) => units.length);
