export const SAVE_SUCCESS_MESSAGE = 'Actualizările s-au efectuat cu succes!';
type Listener = (message: string | null) => void;
const listeners = new Set<Listener>();
let current: string | null = null;
export function subscribeSaveMessage(listener: Listener) { listeners.add(listener); listener(current); return () => { listeners.delete(listener); }; }
export function showSaveSuccess() { current = SAVE_SUCCESS_MESSAGE; listeners.forEach(listener => listener(current)); }
export function clearSaveMessage() { current = null; listeners.forEach(listener => listener(null)); }
