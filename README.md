# tyfsm (wip)

simple and typesafe finite-state machines. Inspired by zustand and xstate.

## Background

I like [automata-based programming](https://en.wikipedia.org/wiki/Automata-based_programming). Certain problems are solved elegantly when modelled as finite-state machines, particularly
those related to the logic of user interfaces. It's a great tool in a programmer's toolbox.

The most popular js/ts fsm library is [XState](https://github.com/statelyai/xstate). It's pretty good but verbose and difficult to learn, it's a big investment to drop in a team setting. Furthermore, type-safety in XState seems like an afterthought.

For me one of the biggest benefits of finite-state machines is that they enable you to make illegal states unrepresentable, and a large chunk of that is missing from xstate. So that's why I built this library

## Features

`tyfsm`'s state machines are centered around leveraging the type-narrowing features of Typescript's [discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions).

The core of the state machine is a discriminated union, where each state is a single variant of the union. This gives us neat type-safety narrowing features.

## Example

You define your state machine in Typescript's type system:

```typescript
type WebsocketMachine = StateMachine<
  // First define your states and the data each state carries
  {
    idle: {
      addr: string;
    };
    connecting: {
      socket: WebSocket;
      addr: string;
    };
    connected: {
      socket: WebSocket;
      addr: string;
    };
    error: {
      errorMessage: string;
    };
  },
  // Now define the valid transitions between states
  {
    idle: ["connecting"];
    connecting: ["error", "connected"];
    connected: ["idle", "error"];
    error: ["idle"];
  }
>;

// Write a utility to make selecting states easy
type State<K extends WebsocketMachine["allStates"]> = SelectStates<
  WebsocketMachine,
  K
>;

// Now define actions for the machine
type Actions = {
  // This action can only be called in the `idle` state and transitions
  // the machine into the `connecting` state
  connect: (state: State<"idle">) => State<"connecting">;

  // This action can only be called in the `connected` state and transitions
  // the machine into the `idle` state
  disconnect: (state: State<"connected">) => State<"idle">;
};
```

Once you've modelled your state machine, you can create a store in a similar way like in zustand:

```typescript
// Create the initial state
const initial: State<"idle"> = {
  kind: "idle",
  addr: "ws://localhost:8302",
};

export const useWebsocketStore = create<WebsocketMachine, Actions>(
  initial,
  // Create the machine's actions:
  //
  // `get` is a function that returns the current state of the machine
  // `transition` is a function that transitions the machine, with the following parameters:
  //    * the current state
  //    * the next state
  //    * the data for the next state
  (get, transition) => ({
    connect(idleState) {
      const socket = new WebSocket(idleState.addr);

      socket.addEventListener("error", () => {
        // Get the current state of the machine, it is important to not use
        // `idleState` from the above scope because the state may have changed in
        // between the time the outer function returns and this callback runs.
        const currentState = get();
        if (currentState.kind === "connecting") {
          transition(currentState.kind, "error", {
            errorMessage: "Failed to connect",
          });
        }
      });

      socket.addEventListener("open", () => {
        // Same treatment as above
        const currentState = get();
        if (currentState.kind === "connecting") {
          transition(currentState.kind, "connected", {
            socket,
            addr: currentState.addr,
          });
        }
      });

      return transition(idleState.kind, "connecting", {
        socket,
        addr: idleState.addr,
      });
    },
    disconnect(connectedState) {
      return transition(connectedState.kind, "idle", {
        addr: connectedState.addr,
      });
    },
  })
);
```

Now you can use it in React:

```tsx
const App = () => {
  const { state, actions } = useWebsocketStore();

  switch (state.kind) {
    case "idle": {
      return <button onClick={() => actions.connect(state)}>Connect</button>;
    }
    case "connecting": {
      return <p>Connecting...</p>;
    }
    case "connected": {
      return (
        <button onClick={() => actions.disconnect(state)}>Disconnect</button>
      );
    }
    case "error": {
      return <p>Something went wrong: {state.errorMessage}</p>;
    }
  }
};
```

Note that all the actions are type-safe. You can only call `actions.connect(state)` when `state` is in the idle state. Similarly, the `errorMessage` property is only available on the
state object when the machine is in the error state.
