import { initStore } from './store';
import { GlobalState, ModelsState } from './storeTypes';
import { Model } from '../types/domain';

const configureStore = (): void => {
  const actions = {
    ADD_MODELS: (curState: GlobalState, models: Model[]): Partial<GlobalState> => {
      console.info('ADD_MODELS DISPATCH FUNCTION', models);
      const currentModels = curState.models?.models || [];
      const updatedModels: ModelsState = { ...(curState.models || { models: [], isLoading: false }) };
      
      models.forEach((model) => {
        const modelIndex = currentModels.findIndex((e) => e.modelId === model.modelId);
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
    UPDATE_MODEL: (curState: GlobalState, model: Model): Partial<GlobalState> => {
      console.info('UPDATE_MODEL DISPATCH FUNCTION', model);
      const currentModels = curState.models?.models || [];
      const updatedModels: ModelsState = { ...(curState.models || { models: [], isLoading: false }) };
      const modelIndex = currentModels.findIndex((e) => e.modelId === model.modelId);
      if (modelIndex === -1) {
        updatedModels.models.push(model);
      } else {
        const mergedModel = mergeDeep(updatedModels.models[modelIndex], model);
        console.info('MERGED MODEL', mergedModel);
        updatedModels.models[modelIndex] = mergedModel;
      }
      return { models: updatedModels };
    },
    DELETE_MODELS: (curState: GlobalState, modelsToDelete: Model[]): Partial<GlobalState> => {
      console.debug('DELETE_MODEL DISPATCH FUNCTION', modelsToDelete);
      const currentModels = curState.models?.models || [];
      const updatedModels: ModelsState = {
        ...(curState.models || { models: [], isLoading: false }),
        models: currentModels.filter(
          (model) => !modelsToDelete.find((modelToDelete) => modelToDelete.modelId === model.modelId)
        )
      };
      return { models: updatedModels };
    },
    MODELS_IS_LOADING: (curState: GlobalState, isLoading: boolean): Partial<GlobalState> => {
      console.debug('MODELS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedModels: ModelsState = { ...(curState.models || { models: [], isLoading: false }) };
      updatedModels.isLoading = isLoading;
      return { models: updatedModels };
    },
  };

  initStore(actions, { models: { models: [], isLoading: true } });
};

export default configureStore;

// deep merge two objects
const mergeDeep = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  const result = { ...target };
  
  if (typeof source === 'object' && source !== null) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = mergeDeep(result[key] || {} as any, value);
        } else {
          result[key] = value as any;
        }
      }
    }
  }
  return result;
};
