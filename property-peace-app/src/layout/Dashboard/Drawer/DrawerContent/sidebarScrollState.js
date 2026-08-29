export const SIDEBAR_SCROLL_BOTTOM_THRESHOLD = 2;

export function hasMoreSidebarContent(scrollNode) {
  if (!scrollNode) return false;

  const { scrollHeight, clientHeight, scrollTop } = scrollNode;
  return scrollHeight > clientHeight && scrollHeight - clientHeight - scrollTop > SIDEBAR_SCROLL_BOTTOM_THRESHOLD;
}
