import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import i18next from '../../../i18n';

/**
 * Returns breadcrumb navigation items for timekeeper pages
 * @returns Array of breadcrumb items
 */
export const Breadcrumbs = (): BreadcrumbGroupProps.Item[] => {
  return [
    { text: i18next.t('home.breadcrumb'), href: '/' },
    { text: i18next.t('operator.breadcrumb'), href: '/admin/home' },
    { text: i18next.t('timekeeper.breadcrumb'), href: '/admin/timekeeper' },
  ];
};
