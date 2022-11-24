export type StateMap<
  T extends {
    [key in string | number | symbol]: Record<string | number | symbol, any>;
  }
> = {
  [key in keyof T]: { kind: key } & T[key];
};

export type SelectStates<
  Machine extends StateMachineDef<any, any>,
  K extends keyof Machine["states"]
> = Machine["states"][K];

type TransitionMap<
  Map extends StateMap<any>,
  T extends Record<keyof Map, Array<keyof Map>>
> = T;

export type StateMachineDef<
  Map extends Record<
    string | number | symbol,
    Record<string | number | symbol, any>
  >,
  Transitions extends TransitionMap<Map, Record<keyof Map, (keyof Map)[]>>
> = {
  states: StateMap<Map>;
  transitions: Transitions;
  allStates: keyof Map;
};

type Listener<MachineDef extends StateMachineDef<any, any>> = (
  prev: MachineDef["states"][keyof MachineDef["states"]],
  next: MachineDef["states"][keyof MachineDef["states"]]
) => void;

export type MachineStoreApi<
  MachineDef extends StateMachineDef<any, any>,
  Actions
> = {
  getState: () => MachineDef["states"][keyof MachineDef["states"]];
  setState: <
    In extends keyof MachineDef["states"],
    Out extends MachineDef["transitions"][In][number]
  >(
    currentState: In,
    kind: Out,
    newState: Omit<MachineDef["states"][Out], "kind">
  ) => MachineDef["states"][Out];
  subscribe: (_listener: Listener<MachineDef>) => () => void;
  actions: Actions;
};

export type MachineData<MachineDef extends StateMachineDef<any, any>> = {
  state: MachineDef["states"][keyof MachineDef["states"]];
} & Record<string | number | symbol, any>;

export type MachineDataTransitionFns<Store extends MachineData<any>> =
  Store extends {
    state: infer _state;
  }
    ? Omit<Store, "state">
    : never;

export type CreateMachineData<
  MachineDef extends StateMachineDef<any, any>,
  Actions
> = (
  get: () => MachineDef["states"][keyof MachineDef["states"]],
  transition: MachineStoreApi<MachineDef, Actions>["setState"]
) => Actions;

const createMachineStore = <
  MachineDef extends StateMachineDef<any, any>,
  Actions
>(
  initial: MachineDef["states"][keyof MachineDef["states"]],
  createMachineData: (
    get: () => MachineDef["states"][keyof MachineDef["states"]],
    set: MachineStoreApi<MachineDef, Actions>["setState"]
  ) => Actions
): MachineStoreApi<MachineDef, Actions> => {
  let actions: Actions;
  let state = initial;

  const listeners = new Set<Listener<MachineDef>>();

  const getState: MachineStoreApi<MachineDef, Actions>["getState"] = () =>
    state;

  const setState: MachineStoreApi<MachineDef, Actions>["setState"] = (
    currentState,
    kind,
    newState
  ) => {
    if (state.kind !== currentState) {
      throw new Error(
        `Invalid state, expected: ${String(currentState)} but got ${state.kind}`
      );
    }

    const prev = state;

    // Cast because tsc gives this error:
    // Type '{ kind: Out; } & Omit<machineDef["states"][Out], "kind">' is not assignable to type 'machineDef["states"][keyof machineDef["states"]]'
    // Even though `{ kind: Out; } & Omit<machineDef["states"][Out], "kind">` is a valid subtype of `machineDef["states"][keyof machineDef["states"]]`
    state = {
      kind,
      ...newState,
    } as MachineDef["states"][keyof MachineDef["states"]];

    listeners.forEach((listener) => listener(prev, state));
    return state as any;
  };
  const subscribe: (listener: Listener<MachineDef>) => () => void = (
    listener
  ) => {
    listeners.add(listener);
    // Unsubscribe
    return () => listeners.delete(listener);
  };

  // eslint-disable-next-line prefer-const
  actions = createMachineData(() => state, setState);

  return { getState, setState, subscribe, actions };
};

export default createMachineStore;
