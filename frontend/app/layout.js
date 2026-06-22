import Link from 'next/link';
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
          <nav>
            <Link href="/sessions">Sessions</Link>
            <Link href="/heatmap">Heatmap</Link>
          </nav>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
