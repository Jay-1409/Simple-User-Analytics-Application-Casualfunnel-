'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/sessions', label: 'Sessions' },
  { href: '/heatmap', label: 'Heatmap' },
  { href: '/funnels', label: 'Funnels' }
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link className={active ? 'active' : ''} href={link.href} key={link.href}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
