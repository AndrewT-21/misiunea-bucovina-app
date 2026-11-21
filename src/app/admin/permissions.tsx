import { Redirect } from 'expo-router';

// Compatibilitate cu linkurile vechi: administrarea este unificată.
export default function PermissionsRedirect() {
  return <Redirect href={'/admin/departments' as any} />;
}
