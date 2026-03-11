/**
 * Public layout — wraps sign-in, sign-up, and access-denied pages.
 * No AuthGuard, no sidebar, no header.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
