import { STYLES_ACTION_TYPES } from './styles.types';

const initialState = {
  isSidebarOpen: false,
};

const stylesReducer = (state = initialState, action) => {
  switch (action.type) {
    case STYLES_ACTION_TYPES.OPEN_SIDEBAR:
      return { ...state, isSidebarOpen: true };
    case STYLES_ACTION_TYPES.CLOSE_SIDEBAR:
      return { ...state, isSidebarOpen: false };
    default:
      return state;
  }
};

export default stylesReducer;
