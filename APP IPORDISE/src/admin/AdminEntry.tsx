// Native builds never embed the staff dashboard. App.tsx only selects this
// component for web admin routes, where Metro resolves AdminEntry.web.tsx.
export function AdminEntry() {
  return null;
}
