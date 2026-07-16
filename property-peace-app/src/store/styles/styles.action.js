import { STYLES_ACTION_TYPES } from './styles.types';

export const openSidebar = () => {
  return {
    type: STYLES_ACTION_TYPES.OPEN_SIDEBAR,
  };
};

export const closeSidebar = () => {
  return {
    type: STYLES_ACTION_TYPES.CLOSE_SIDEBAR,
  };
};
