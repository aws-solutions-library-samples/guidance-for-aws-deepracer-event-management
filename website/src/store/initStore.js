import configureCarsStore from './carsStore';
import configureEventsStore from './eventsStore';
import configureFleetsStore from './fleetsStore';
import configureHelpPanelStore from './helpPanelStore';
import configureNotificationsStore from './notificationsStore';
import configureRacesStore from './racesStore';
import configureSideNavStore from './sideNavStore';
import configureSplitPanelStore from './splitPanelStore';
import configureUsersStore from './usersStore';

const initDataStores = () => {
  configureUsersStore();
  configureRacesStore();
  configureCarsStore();
  configureFleetsStore();
  configureEventsStore();

  configureSideNavStore();
  configureSplitPanelStore();
  configureHelpPanelStore();
  configureNotificationsStore();
};

export default initDataStores;
