export function hoverDetailVisibility(currentVisibility, eventType) {
  if (eventType === 'pointer-enter' || eventType === 'keyboard-focus') return true;
  if (eventType === 'pointer-leave' || eventType === 'blur' || eventType === 'click') return false;
  return Boolean(currentVisibility);
}
