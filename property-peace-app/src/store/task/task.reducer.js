import { TASK_ACTION_TYPES } from './task.types';

const initialState = {
  tasks: [],
  loading: false,
  error: null,
  loadedAt: null,
};

export default function taskReducer(state = initialState, action) {
  switch (action.type) {
    case TASK_ACTION_TYPES.FETCH_TASKS_START:
      return { ...state, loading: true, error: null };

    case TASK_ACTION_TYPES.FETCH_TASKS_SUCCESS:
      return { ...state, tasks: action.payload, loading: false, error: null, loadedAt: Date.now() };

    case TASK_ACTION_TYPES.FETCH_TASKS_FAILURE:
      return { ...state, loading: false, error: action.payload };

    case TASK_ACTION_TYPES.ADD_TASK_SUCCESS:
      return { ...state, tasks: [...state.tasks, action.payload] };

    case TASK_ACTION_TYPES.UPDATE_TASK_SUCCESS:
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t)
      };

    case TASK_ACTION_TYPES.DELETE_TASK_SUCCESS:
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };

    default:
      return state;
  }
}
