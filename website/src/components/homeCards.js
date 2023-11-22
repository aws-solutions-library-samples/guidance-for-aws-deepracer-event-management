import i18next from '../i18n';

const HomeCards = () => {
  const cards = [
    {
      name: i18next.t('homeCards.homeCards.models'),
      link: '/models/view',
      description: i18next.t('homeCards.homeCards.models-description'),
    },
  ];
  return cards;
};

const AdminHomeCards = () => {
  const cards = [
    {
      name: i18next.t('homeCards.adminHomeCards.registration'),
      link: '/registration/createuser',
      description: i18next.t('homeCards.adminHomeCards.registration-description'),
    },
    {
      name: i18next.t('homeCards.adminHomeCards.all-models'),
      link: '/admin/models',
      description: i18next.t('homeCards.adminHomeCards.all-models-description'),
    },
    {
      name: i18next.t('homeCards.adminHomeCards.fleets'),
      link: '/admin/fleets',
      description: i18next.t('homeCards.adminHomeCards.fleets-description'),
    },
    {
      name: i18next.t('homeCards.adminHomeCards.devices'),
      link: '/admin/devices',
      description: i18next.t('homeCards.adminHomeCards.devices-description'),
    },
    {
      name: i18next.t('homeCards.adminHomeCards.car-activation'),
      link: '/admin/car_activation',
      description: i18next.t('homeCards.adminHomeCards.car-activation-description'),
    },
    {
      name: i18next.t('homeCards.adminHomeCards.timer-activation'),
      link: '/admin/timer_activation',
      description: i18next.t('homeCards.adminHomeCards.timer-activation-description'),
    },
    {
      name: i18next.t('homeCards.adminHomeCards.events'),
      link: '/admin/events',
      description: i18next.t('homeCards.adminHomeCards.events-description'),
    },
    {
      name: i18next.t('homeCards.adminHomeCards.time-keeper'),
      link: '/admin/timekeeper',
      description: i18next.t('homeCards.adminHomeCards.time-keeper-description'),
    },
  ];
  return cards;
};
export { AdminHomeCards, HomeCards };
