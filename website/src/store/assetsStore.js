import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_ASSETS: (curState, assets) => {
      console.info('ADD_ASSETS DISPATCH FUNCTION', assets);
      const updatedAssets = { ...curState.assets };
      assets.forEach((asset) => {
        const assetIndex = curState.assets.assets.findIndex((e) => e.assetId === asset.assetId);
        if (assetIndex === -1) {
          updatedAssets.assets.push(asset);
        } else {
          const mergedAsset = mergeDeep(updatedAssets.assets[assetIndex], asset);
          console.info('MERGED ASSET', mergedAsset);
          updatedAssets.assets[assetIndex] = mergedAsset;
        }
      });
      return { assets: updatedAssets, isLoading: false };
    },
    UPDATE_ASSET: (curState, assetToUpdate) => {
      console.info('UPDATE_ASSET DISPATCH FUNCTION', assetToUpdate);
      const updatedAssets = { ...curState.assets };
      const assetIndex = curState.assets.assets.findIndex(
        (e) => e.assetId === assetToUpdate.assetId
      );
      if (assetIndex === -1) {
        updatedAssets.assets.push(assetToUpdate);
      } else {
        const mergedAsset = mergeDeep(updatedAssets.assets[assetIndex], assetToUpdate);
        console.info('MERGED ASSET', mergedAsset);
        updatedAssets.assets[assetIndex] = mergedAsset;
      }
      return { assets: updatedAssets, isLoading: false };
    },
    DELETE_ASSET: (curState, assetsToDelete) => {
      console.debug('DELETE_ASSET DISPATCH FUNCTION', assetsToDelete);
      const updatedAssets = { ...curState.assets };
      updatedAssets.assets = updatedAssets.assets.filter((asset) => {
        return !assetsToDelete.find((assetToDelete) => {
          return assetToDelete.assetId === asset.assetId;
        });
      });
      return { assets: updatedAssets, isLoading: false };
    },
    ASSETS_IS_LOADING: (curState, isLoading) => {
      console.debug('ASSETS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedAssets = { ...curState.assets };
      updatedAssets.isLoading = isLoading;
      return { assets: updatedAssets };
    },
  };

  initStore(actions, { assets: { assets: [], isLoading: true } });
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
