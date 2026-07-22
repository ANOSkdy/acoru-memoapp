export type NavItem = {
  href: string;
  label: string;
  /** Short text mark used when the desktop navigation is collapsed. */
  mark: string;
};

export const navItems: NavItem[] = [
  { href: '/', label: 'ホーム', mark: 'ホ' },
  { href: '/trash', label: 'ゴミ箱', mark: 'ゴ' },
  { href: '/settings', label: '設定', mark: '設' }
];

export const isNavItemActive = (pathname: string, href: string) => {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/p/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
};
