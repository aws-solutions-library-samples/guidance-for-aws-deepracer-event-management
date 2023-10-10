import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_MODELS: (curState, models) => {
      console.info('ADD_MODELS DISPATCH FUNCTION', models);
      const updatedModels = { ...curState.models };
      models.forEach((model) => {
        const modelIndex = curState.models.models.findIndex((e) => e.modelId === model.modelId);
        if (modelIndex === -1) {
          updatedModels.models.push(model);
        } else {
          const mergedModel = mergeDeep(updatedModels.models[modelIndex], model);
          console.info('MERGED MODEL', mergedModel);
          updatedModels.models[modelIndex] = mergedModel;
        }
      });
      return { models: updatedModels };
    },
    UPDATE_MODEL: (curState, model) => {
      console.info('UPDATE_MODEL DISPATCH FUNCTION', model);
      const updatedModels = { ...curState.models };
      const modelIndex = curState.models.models.findIndex((e) => e.modelId === model.modelId);
      if (modelIndex === -1) {
        updatedModels.models.push(model);
      } else {
        const mergedModel = mergeDeep(updatedModels.models[modelIndex], model);
        console.info('MERGED MODEL', mergedModel);
        updatedModels.models[modelIndex] = mergedModel;
      }
      return { models: updatedModels };
    },
    DELETE_MODELS: (curState, modelsToDelete) => {
      console.debug('DELETE_MODEL DISPATCH FUNCTION', modelsToDelete);
      const updatedModels = { ...curState.models };
      updatedModels.models = updatedModels.models.filter((model) => {
        return !modelsToDelete.find((modelToDelete) => {
          return modelToDelete.modelId === model.modelId;
        });
      });
      return { models: updatedModels };
    },
    MODELS_IS_LOADING: (curState, isLoading) => {
      console.debug('MODELS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedModels = { ...curState.models };
      updatedModels.isLoading = isLoading;
      return { models: updatedModels };
    },
  };

  initStore(actions, { models: { models: [], isLoading: true } });
};

export default configureStore;

// deep merge two objects
const mergeDeep = (target, source) => {
  if (typeof source === 'object') {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];
        if (typeof value === 'object') {
          target[key] = mergeDeep(target[key], value);
        } else {
          target[key] = value;
        }
      }
    }
  }
  return target;
};
