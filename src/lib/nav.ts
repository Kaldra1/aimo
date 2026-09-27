export const NAV_ITEMS = [
  { key: 'lectures', label: 'Лекції', href: '/lectures/' },
  { key: 'labs', label: 'Лабораторні', href: '/labs/' },
  { key: 'practicals', label: 'Практичні', href: '/practicals/' },
  { key: 'emulators', label: 'Емулятори', href: '/emulators/' },
  { key: 'tasks', label: 'Задачі', href: '/tasks/' },
  { key: 'about', label: 'Про курс', href: '/about/' },
] as const;

export type Section = (typeof NAV_ITEMS)[number]['key'];

export interface Crumb {
  label: string;
  href?: string;
}
