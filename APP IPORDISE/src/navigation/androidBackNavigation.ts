export type AndroidBackAction = () => boolean;

const scopedActions: AndroidBackAction[] = [];
const MAX_NAVIGATION_HISTORY = 24;

export function registerAndroidBackAction(action: AndroidBackAction) {
  scopedActions.push(action);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const index = scopedActions.lastIndexOf(action);
    if (index >= 0) scopedActions.splice(index, 1);
  };
}

export function runScopedAndroidBackAction() {
  for (let index = scopedActions.length - 1; index >= 0; index -= 1) {
    if (scopedActions[index]()) return true;
  }
  return false;
}

export function hasScopedAndroidBackAction() {
  return scopedActions.length > 0;
}

export function recordNavigationEntry<T>(history: T[], current: T, next: T) {
  if (current === next) return false;
  history.push(current);
  if (history.length > MAX_NAVIGATION_HISTORY) history.splice(0, history.length - MAX_NAVIGATION_HISTORY);
  return true;
}

export function popPreviousNavigationEntry<T>(history: T[], current: T) {
  let previous = history.pop();
  while (previous === current) previous = history.pop();
  return previous;
}
