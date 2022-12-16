import useSyncExternalStoreExports from "use-sync-external-store/shim/with-selector";
import createMachineStore, {
  CreateMachineData,
  MachineData,
  MachineDataTransitionFns,
  MachineStoreApi,
  StateMachineDef,
} from "./vanilla";
const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;

export type UseStore<machineStoreApi extends MachineStoreApi<any, any>> =
  () => {
    state: ReturnType<machineStoreApi["getState"]>;
    actions: machineStoreApi["actions"];
  };

export type UseBoundStore<
  MachineDef extends StateMachineDef<any, any>,
  Actions,
  machineStoreApi extends MachineStoreApi<any, any> = MachineStoreApi<
    MachineDef,
    Actions
  >
> = UseStore<machineStoreApi> & machineStoreApi;

export const useStore = <machineStoreApi extends MachineStoreApi<any, any>>(
  store: machineStoreApi extends MachineStoreApi<
    infer stateMap,
    infer transitions
  >
    ? MachineStoreApi<stateMap, transitions>
    : never
): ReturnType<UseStore<machineStoreApi>> => {
  const slice = useSyncExternalStoreWithSelector(
    store.subscribe,
    store.getState,
    store.getState,
    (_) => store.getState()
  );
  return { state: slice, actions: store.actions };
};

const create = <
  MachineDef extends StateMachineDef<any, any>,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Actions extends Record<string, Function>
>(
  initial: MachineDef["states"][keyof MachineDef["states"]],
  createMachineData: CreateMachineData<MachineDef, Actions>
): UseBoundStore<MachineDef, Actions> => {
  const api = createMachineStore(initial, createMachineData);

  const useBoundStore = () => useStore(api);

  Object.assign(useBoundStore, api);

  return useBoundStore as UseBoundStore<MachineDef, Actions>;
};

export default create;
