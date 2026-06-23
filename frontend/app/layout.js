import Link from 'next/link';
import NavLinks from './nav-links';
import ThemeToggle from './theme-toggle';
import './globals.css';

export const metadata = {
  title: 'Casualfunnel Analytics',
  description: 'Lightweight session analytics dashboard'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = window.localStorage.getItem('casualfunnel_theme');
                document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
              } catch (_) {
                document.documentElement.dataset.theme = 'dark';
              }
            `
          }}
        />
      </head>
      <body>
        <header className="topbar">
          <Link className="brand" href="/sessions">
            Casualfunnel Analytics
          </Link>
          <div className="navActions">
            <NavLinks />
            <ThemeToggle />
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
