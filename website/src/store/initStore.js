import configureCarsStore from './carsStore';
import configureEventsStore from './eventsStore';
import configureFleetsStore from './fleetsStore';
import configureHelpPanelStore from './helpPanelStore';
import configureModelsStore from './modelsStore';
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
  configureModelsStore();

  configureSideNavStore();
  configureSplitPanelStore();
  configureHelpPanelStore();
  configureNotificationsStore();
};

export default initDataStores;
