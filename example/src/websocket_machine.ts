import create, { StateMachineDef, SelectStates } from "../../dist";

export type WebsocketMachine = StateMachineDef<
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
export type State<K extends WebsocketMachine["allStates"]> = SelectStates<
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
