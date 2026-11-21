import { Alert as NativeAlert } from 'react-native';

type AlertButtons = Parameters<typeof NativeAlert.alert>[2];
type AlertOptions = Parameters<typeof NativeAlert.alert>[3];
type Dialog = { title: string; message?: string; buttons: NonNullable<AlertButtons>; options?: AlertOptions };
let showDialog: ((dialog: Dialog) => void) | null = null;
const pending: Dialog[] = [];

export function registerConfirmDialog(handler: ((dialog: Dialog) => void) | null) {
  showDialog = handler;
  if (handler) while (pending.length) handler(pending.shift()!);
}

export type { Dialog as ConfirmationDialogRequest };

/** Confirmation requests use the shared in-app dialog on web and native. */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButtons, options?: AlertOptions): void {
    if (buttons && buttons.length > 1) {
      const dialog = { title, message, buttons, options };
      if (showDialog) showDialog(dialog);
      else pending.push(dialog);
      return;
    }
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert([title, message].filter(Boolean).join('\n\n'));
    } else {
      NativeAlert.alert(title, message, buttons, options);
    }
  },
};
