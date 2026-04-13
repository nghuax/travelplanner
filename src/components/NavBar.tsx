'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavBarProps {
  tripName?: string;
  onAddTrip?: () => void;
}

export function NavBar({ tripName }: NavBarProps) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  const centerText = tripName
    ? tripName.toUpperCase()
    : 'VIETNAM TRAVEL PLANNER';

  return (
    <nav className="relative z-40 px-8 py-5 flex items-center justify-between">
      <Link
        href="/"
        className="text-cream-200/80 hover:text-cream-200 text-xs font-medium uppercase tracking-wide-custom transition-colors"
      >
        Home
      </Link>

      <span className="font-serif text-sm text-cream-200/90 uppercase tracking-wide-custom">
        {centerText}
      </span>

      <button className="text-cream-200/80 hover:text-cream-200 text-xs font-medium uppercase tracking-wide-custom transition-colors">
        Log In
      </button>
    </nav>
  );
}
