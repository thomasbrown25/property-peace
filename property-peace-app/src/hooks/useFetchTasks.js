import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTasks } from 'store/task/task.action';
import { selectTasks, selectTasksLoading, selectTasksLoadedAt } from 'store/task/task.selector';

export default function useFetchTasks(filters = {}) {
  const dispatch = useDispatch();
  const tasks    = useSelector(selectTasks);
  const loading  = useSelector(selectTasksLoading);
  const loadedAt = useSelector(selectTasksLoadedAt);

  const refetch = useCallback(() => {
    dispatch(fetchTasks(filters));
  }, [dispatch, JSON.stringify(filters)]); // eslint-disable-line

  useEffect(() => {
    if (!loadedAt) refetch();
  }, [refetch, loadedAt]);

  return { tasks, loading, refetch };
}
