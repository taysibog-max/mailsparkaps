import Link from 'next/link';
import UserMenu from './UserMenu';

export default function SiteHeaderNext(){
  return (
    <header className="sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between glass">
        <Link href="/" className="font-extrabold">Automailer</Link>
        <nav className="hidden md:flex items-center gap-6 text-sm opacity-90">
          <Link href="/dashboard/overview" className="hover:text-white">Overview</Link>
          <Link href="/dashboard/contacts" className="hover:text-white">Contacts</Link>
          <Link href="/dashboard/campaigns" className="hover:text-white">Campaigns</Link>
          <Link href="/dashboard/billing" className="hover:text-white">Billing</Link>
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}


