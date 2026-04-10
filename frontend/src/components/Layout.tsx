import React, { useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

type Props = {
  children: React.ReactNode;
  /** If true the content area will be full width (no centered container). Useful for hero/quotation-builder) */
  fullWidth?: boolean;
  /** Optional page title shown above children (keeps backward compatibility) */
  title?: string;
};

const Layout: React.FC<Props> = ({ children, fullWidth = false, title }) => {
  useEffect(() => {
    // Click tracer: capturing phase so we log before other handlers run
    const onClick = (e: MouseEvent) => {
      try {
        const t = e.target as HTMLElement | null;
        const path =
          (e.composedPath &&
            e
              .composedPath()
              .map((el: any) => {
                try {
                  return el && (el.tagName || el.nodeName || (el.constructor && el.constructor.name));
                } catch (_) {
                  return null;
                }
              })
              .filter(Boolean)) ||
          [];

        // Friendly object for console
        const info = {
          time: new Date().toISOString(),
          tag: t?.tagName,
          id: t?.id || null,
          classes: t?.className || null,
          innerText: (t?.innerText || '').slice(0, 120),
          path,
        };
        // lightweight guard for large logs
        // eslint-disable-next-line no-console
        console.log('--- CLICK TRACE ---', info);
      } catch (err) {
        // swallow tracer errors
        // eslint-disable-next-line no-console
        console.error('click tracer error', err);
      }
    };

    // Instrument history push/replace to see programmatic navigations
    const origPush = (history as any).pushState;
    const origReplace = (history as any).replaceState;

    (history as any).pushState = function (...args: any[]) {
      // eslint-disable-next-line no-console
      console.log('--- history.pushState called ---', args);
      return origPush.apply(this, args);
    };
    (history as any).replaceState = function (...args: any[]) {
      // eslint-disable-next-line no-console
      console.log('--- history.replaceState called ---', args);
      return origReplace.apply(this, args);
    };

    const onBeforeUnload = () => {
      // eslint-disable-next-line no-console
      console.log('--- beforeunload firing (page will unload/reload) ---');
    };

    // add capturing listener so we see it before other handlers
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      (history as any).pushState = origPush;
      (history as any).replaceState = origReplace;
    };
  }, []);

  /**
   * Layout notes:
   * - Sidebar is included for desktop and hidden on small screens (Sidebar component can handle toggling)
   * - main content uses a centered container by default (max-w-7xl px-6)
   * - fullWidth prop allows pages to use full-bleed content (hero, pdf preview, quotation builder)
   */
  return (
    <div className="min-h-screen bg-gray-50 text-[hsl(var(--text-default))]">
      <Header />

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <Sidebar />
        </aside>

        {/* Main content area */}
        <main
          className={`flex-1 transition-padding min-h-[calc(100vh-64px)] pt-20 ${
            /* on small screens, reduce left padding because sidebar is hidden */
            'sm:pl-4'
          }`}
          role="main"
        >
          {/* Page container: centered by default, full-bleed when fullWidth=true */}
          <div className={`${fullWidth ? 'w-full px-4' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
            {title ? <h1 className="text-2xl font-semibold text-brand-700 mb-4">{title}</h1> : null}
            <div className="bg-white rounded-2xl shadow-sm p-4">{children}</div>
          </div>

          {/* Footer sits outside the inner container so it doesn't add inner padding/margins */}
          <div className="mt-8">
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
