'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';

import { isNavItemActive, type NavItem } from './nav-items';

type SideNavProps = {
  items: NavItem[];
};

export default function SideNav({ items }: SideNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() ?? '/';
  const listId = useId();

  return (
    <nav
      className={`app-nav ${collapsed ? 'app-nav--collapsed' : ''}`}
      aria-label="メインナビゲーション"
    >
      <ul className="app-nav__list" id={listId}>
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                className="app-nav__link"
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className="app-nav__mark" aria-hidden="true">
                  {item.mark}
                </span>
                <span className="app-nav__label">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        className="app-nav__toggle"
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        aria-controls={listId}
        aria-label={
          collapsed ? 'ナビゲーションを開く' : 'ナビゲーションを閉じる'
        }
      >
        <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
        {collapsed ? null : <span>閉じる</span>}
      </button>
    </nav>
  );
}
