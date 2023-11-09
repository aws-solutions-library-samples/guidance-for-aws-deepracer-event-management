import i18next from '../../../i18n';

export const Breadcrumbs = () => {
  return [
    { text: i18next.t('home.breadcrumb'), href: '/' },
    { text: i18next.t('operator.breadcrumb'), href: '/admin/home' },
    { text: i18next.t('timekeeper.breadcrumb'), href: '/admin/timekeeper' },
  ];
};
