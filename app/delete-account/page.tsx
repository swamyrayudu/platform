// ============================================================
// app/delete-account/page.tsx — Account deletion (public)
// ============================================================
// Google Play requires a web page where users can delete their account
// without installing the app; this URL goes in the Play Console Data safety
// form. It is deliberately not a protected route, so a signed-out visitor
// sees how deletion works and can sign in from here.
// ============================================================

import type { Metadata } from 'next'
import DeleteAccountPanel from './DeleteAccountPanel'

export const metadata: Metadata = {
  title: 'Delete your account — rsdeducation',
  description:
    'Permanently delete your rsdeducation account and the data attached to it, from the app or from this page.',
}

export default function DeleteAccountPage() {
  return <DeleteAccountPanel />
}
