import i18next from '../i18n';

const HomeCards = () => {
  const cards = [
    {
      name: i18next.t('home.models'),
      link: '/models',
      description: i18next.t('home.models-description'),
    },
    {
      name: i18next.t('home.upload'),
      link: '/upload',
      description: i18next.t('home.upload-description'),
    },
  ];
  return cards;
};

const AdminHomeCards = () => {
  const cards = [
    {
      name: i18next.t('home.all-models'),
      link: '/admin/models',
      description: i18next.t('home.all-models-description'),
    },
    {
      name: i18next.t('home.quarantined'),
      link: '/admin/quarantine',
      description: i18next.t('home.quarantined-description'),
    },
    {
      name: i18next.t('home.fleets'),
      link: '/admin/fleets',
      description: i18next.t('home.fleets-description'),
    },
    {
      name: i18next.t('home.cars'),
      link: '/admin/cars',
      description: i18next.t('home.cars-description'),
    },
    {
      name: i18next.t('home.car-activation'),
      link: '/admin/car_activation',
      description: i18next.t('home.car-activation-description'),
    },
    {
      name: i18next.t('home.events'),
      link: '/admin/events',
      description: i18next.t('home.events-description'),
    },
    {
      name: i18next.t('home.time-keeper'),
      link: '/admin/timekeeper',
      description: i18next.t('home.time-keeper-description'),
    },
    {
      name: i18next.t('home.leaderboard'),
      link: '/admin/leaderboard',
      description: i18next.t('home.leaderboard-description'),
    },
  ];
  return cards;
};
export { HomeCards, AdminHomeCards };
