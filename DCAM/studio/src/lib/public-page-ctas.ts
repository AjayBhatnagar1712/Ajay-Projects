export type PublicPageCtaLink = {
  href: string;
  label: string;
  tone?: 'primary' | 'secondary' | 'outline';
};

export const seoHeaderActions: PublicPageCtaLink[] = [
  { href: '/login', label: 'Login', tone: 'outline' },
  { href: '/signup', label: 'Signup', tone: 'primary' },
  { href: '/student-enquiry', label: 'Student Enquiry Form', tone: 'secondary' },
];

export const seoHeroPrimaryCta: PublicPageCtaLink = {
  href: '/signup',
  label: 'Signup',
  tone: 'primary',
};

export const seoHeroSecondaryCta: PublicPageCtaLink = {
  href: '/student-enquiry',
  label: 'Student Enquiry Form',
  tone: 'secondary',
};

export const seoHeroTertiaryCta: PublicPageCtaLink = {
  href: '/login',
  label: 'Login',
  tone: 'outline',
};

export const seoFooterActions: PublicPageCtaLink[] = [
  { href: '/login', label: 'Login', tone: 'outline' },
  { href: '/signup', label: 'Signup', tone: 'primary' },
  { href: '/student-enquiry', label: 'Student Enquiry Form', tone: 'secondary' },
];
