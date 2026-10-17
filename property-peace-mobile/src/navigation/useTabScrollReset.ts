import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useNavigation, useScrollToTop } from '@react-navigation/native';
import type { FlatList, ScrollView } from 'react-native';
import type { RefObject } from 'react';

// Switching tabs retains the screen and its offset. Re-tapping the active tab
// scrolls its root to the top, including when that tab is currently on a detail.
export function useTabScrollReset(ref: RefObject<ScrollView | FlatList<any> | null>) {
  const navigation = useNavigation();
  const pendingReset = useRef(false);
  useScrollToTop(ref as RefObject<ScrollView | FlatList<any>>);

  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    return parent.addListener('tabPress' as never, (event: { target?: string }) => {
      const state = parent.getState();
      const activeRoute = state.routes[state.index];
      // Only the root of the currently selected stack can request a reset.
      // An inactive tab's first press must preserve its saved position.
      if (event.target === activeRoute?.key && activeRoute.state?.key === navigation.getState().key
        && !navigation.isFocused()) {
        pendingReset.current = true;
      }
    });
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    if (!pendingReset.current) return;
    pendingReset.current = false;
    const scrollable = ref.current;
    if (scrollable && 'scrollToOffset' in scrollable) {
      scrollable.scrollToOffset({ offset: 0, animated: false });
    } else {
      scrollable?.scrollTo({ y: 0, animated: false });
    }
  }, [ref]));
}
