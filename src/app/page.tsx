import { redirect } from 'next/navigation'

export default async function Home() {
  // Redirect to wallets page (public access)
  redirect('/wallets')
}
