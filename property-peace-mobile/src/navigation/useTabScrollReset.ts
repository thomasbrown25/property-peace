import { useCallback } from 'react';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import type { FlatList, ScrollView } from 'react-native';
import type { RefObject } from 'react';

// Tab screens stay mounted, so switching away and back otherwise restores the old offset.
export function useTabScrollReset(ref: RefObject<ScrollView | FlatList<any> | null>) {
  useScrollToTop(ref as RefObject<ScrollView | FlatList<any>>);
  useFocusEffect(useCallback(() => {
    const scrollable = ref.current;
    if (scrollable && 'scrollToOffset' in scrollable) {
      scrollable.scrollToOffset({ offset: 0, animated: false });
    } else {
      scrollable?.scrollTo({ y: 0, animated: false });
    }
  }, [ref]));
}
