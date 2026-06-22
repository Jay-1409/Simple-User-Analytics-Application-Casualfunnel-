import Link from 'next/link';
import NavLinks from './nav-links';
import './globals.css';

export const metadata = {
  title: 'Casualfunnel Analytics',
  description: 'Lightweight session analytics dashboard'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link className="brand" href="/sessions">
            Casualfunnel Analytics
          </Link>
          <NavLinks />
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
