import * as taskAPI from 'api/task';
import { TASK_ACTION_TYPES } from './task.types';
import { openSnackbar } from 'api/snackbar';

export const fetchTasks = (filters = {}) => async (dispatch) => {
  dispatch({ type: TASK_ACTION_TYPES.FETCH_TASKS_START });
  try {
    const response = await taskAPI.getTasks(filters);
    dispatch({ type: TASK_ACTION_TYPES.FETCH_TASKS_SUCCESS, payload: response.data || [] });
  } catch (err) {
    dispatch({ type: TASK_ACTION_TYPES.FETCH_TASKS_FAILURE, payload: err?.message });
  }
};

export const createTask = (task) => async (dispatch) => {
  try {
    const response = await taskAPI.addTask(task);
    dispatch({ type: TASK_ACTION_TYPES.ADD_TASK_SUCCESS, payload: response.data });
    openSnackbar({ open: true, message: 'Task created', variant: 'alert', alert: { color: 'success' } });
    return response.data;
  } catch (err) {
    openSnackbar({ open: true, message: 'Failed to create task', variant: 'alert', alert: { color: 'error' } });
    throw err;
  }
};

export const updateTaskAction = (id, task) => async (dispatch) => {
  try {
    const response = await taskAPI.updateTask(id, task);
    dispatch({ type: TASK_ACTION_TYPES.UPDATE_TASK_SUCCESS, payload: response.data });
    openSnackbar({ open: true, message: 'Task updated', variant: 'alert', alert: { color: 'success' } });
    return response.data;
  } catch (err) {
    openSnackbar({ open: true, message: 'Failed to update task', variant: 'alert', alert: { color: 'error' } });
    throw err;
  }
};

export const deleteTaskAction = (id) => async (dispatch) => {
  try {
    await taskAPI.deleteTask(id);
    dispatch({ type: TASK_ACTION_TYPES.DELETE_TASK_SUCCESS, payload: id });
    openSnackbar({ open: true, message: 'Task deleted', variant: 'alert', alert: { color: 'success' } });
  } catch (err) {
    openSnackbar({ open: true, message: 'Failed to delete task', variant: 'alert', alert: { color: 'error' } });
    throw err;
  }
};
