import i18next from '../../../i18n';

export const Breadcrumbs = () => {
  return [
    { text: 'Home', href: '/' },
    { text: 'Admin', href: '/admin/home' },
    {
      text: i18next.t('home.time-keeper'),
      href: '/admin/timekeeper',
    },
  ];
};
