const storageKey = 'parag-site-sound';
let soundOn = true;

export function getSoundPreference() {
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved !== null) soundOn = saved !== 'off';
  } catch {
    // Use the in-page preference when storage is unavailable.
  }
  return soundOn;
}

export function setSoundPreference(enabled) {
  soundOn = enabled;
  try {
    sessionStorage.setItem(storageKey, enabled ? 'on' : 'off');
  } catch {
    // The current page can still honor the choice.
  }
}

export function onSoundInteraction(callback, excludedSelector) {
  function activate(event) {
    if (!event.isTrusted || event.target?.closest?.(excludedSelector)) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    callback();
  }

  const events = ['click', 'touchend', 'keydown'];
  for (const type of events) window.addEventListener(type, activate, { capture: true, passive: true });
  return () => {
    for (const type of events) window.removeEventListener(type, activate, true);
  };
}
