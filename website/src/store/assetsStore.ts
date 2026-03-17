import { initStore } from './store';
import { merge } from '../support-functions/merge';
import { GlobalState } from './storeTypes';

interface Asset {
  assetId: string;
  [key: string]: any; // Allow other asset properties
}

const configureStore = (): void => {
  const actions = {
    ADD_ASSETS: (curState: GlobalState, assets: Asset[]): Partial<GlobalState> => {
      console.info('ADD_ASSETS DISPATCH FUNCTION', assets);
      const currentAssets = curState.assets || { assets: [], isLoading: true };
      const updatedAssets = { ...currentAssets };
      assets.forEach((asset) => {
        const assetIndex = currentAssets.assets.findIndex((e: any) => e.assetId === asset.assetId);
        if (assetIndex === -1) {
          updatedAssets.assets.push(asset as any);
        } else {
          const mergedAsset = merge(updatedAssets.assets[assetIndex], asset);
          console.info('MERGED ASSET', mergedAsset);
          updatedAssets.assets[assetIndex] = mergedAsset;
        }
      });
      return { assets: updatedAssets };
    },
    UPDATE_ASSET: (curState: GlobalState, assetToUpdate: Asset): Partial<GlobalState> => {
      console.info('UPDATE_ASSET DISPATCH FUNCTION', assetToUpdate);
      const currentAssets = curState.assets || { assets: [], isLoading: true };
      const updatedAssets = { ...currentAssets };
      const assetIndex = currentAssets.assets.findIndex(
        (e: any) => e.assetId === assetToUpdate.assetId
      );
      if (assetIndex === -1) {
        updatedAssets.assets.push(assetToUpdate as any);
      } else {
        const mergedAsset = merge(updatedAssets.assets[assetIndex], assetToUpdate);
        console.info('MERGED ASSET', mergedAsset);
        updatedAssets.assets[assetIndex] = mergedAsset;
      }
      return { assets: updatedAssets };
    },
    DELETE_ASSET: (curState: GlobalState, assetsToDelete: Asset[]): Partial<GlobalState> => {
      console.debug('DELETE_ASSET DISPATCH FUNCTION', assetsToDelete);
      const currentAssets = curState.assets || { assets: [], isLoading: true };
      const updatedAssets = { ...currentAssets };
      updatedAssets.assets = updatedAssets.assets.filter((asset: any) => {
        return !assetsToDelete.find((assetToDelete) => {
          return assetToDelete.assetId === asset.assetId;
        });
      });
      return { assets: updatedAssets };
    },
    ASSETS_IS_LOADING: (curState: GlobalState, isLoading: boolean): Partial<GlobalState> => {
      console.debug('ASSETS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const currentAssets = curState.assets || { assets: [], isLoading: true };
      const updatedAssets = { ...currentAssets };
      updatedAssets.isLoading = isLoading;
      return { assets: updatedAssets };
    },
  };

  initStore(actions, { assets: { assets: [], isLoading: true } });
};

export default configureStore;
