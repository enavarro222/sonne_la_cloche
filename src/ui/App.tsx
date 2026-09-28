import { useEffect, useReducer, useState } from "react";
import { bestRide, currentPlayer, initialState, reducer } from "../core/game";
import { isBluetoothSupported } from "../sensors/ble/bluetoothSensor";
import { loadRoster, loadSettings, saveRoster, saveSettings } from "../storage/storage";
import styles from "./App.module.css";
import { Header } from "./Header";
import { HomeScreen } from "./HomeScreen";
import { ResultScreen } from "./ResultScreen";
import { RideScreen } from "./RideScreen";
import { SettingsScreen } from "./SettingsScreen";
import { sounds } from "./sound";
import { useHistoryGuard } from "./useHistoryGuard";
import { useSensor } from "./useSensor";
import { useWakeLock } from "./useWakeLock";

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(loadRoster(), loadSettings()),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sensorState = useSensor();
  const { sensor } = sensorState;
  const { game } = state;

  useEffect(() => {
    saveRoster(state.roster);
  }, [state.roster]);
  useEffect(() => {
    saveSettings(state.settings);
  }, [state.settings]);
  useWakeLock(sensor !== null);
  useHistoryGuard(game !== null);

  let screen;
  if (!game) {
    screen = settingsOpen ? (
      <SettingsScreen
        settings={state.settings}
        onChange={(settings) => {
          dispatch({ type: "settingsChanged", settings });
        }}
        onDone={() => {
          setSettingsOpen(false);
        }}
      />
    ) : (
      <HomeScreen
        roster={state.roster}
        settings={state.settings}
        sensor={sensorState}
        bluetoothSupported={isBluetoothSupported()}
        onAddPlayer={(name) => {
          dispatch({ type: "playerAdded", player: { id: crypto.randomUUID(), name } });
        }}
        onRemovePlayer={(id) => {
          dispatch({ type: "playerRemoved", id });
        }}
        onStart={() => {
          dispatch({ type: "gameStarted" });
        }}
        onOpenSettings={() => {
          setSettingsOpen(true);
        }}
      />
    );
  } else if (game.phase === "riding") {
    // A game only starts with a ready sensor, and a sensor is never removed.
    if (!sensor) throw new Error("Riding without a sensor");
    screen = (
      <RideScreen
        key={game.rideId}
        player={currentPlayer(game)}
        round={game.round}
        settings={game.settings}
        record={bestRide(game)}
        sensor={sensor}
        onFinish={(points) => {
          sounds.fanfare();
          dispatch({ type: "rideFinished", points });
        }}
      />
    );
  } else {
    screen = (
      <ResultScreen
        game={game}
        bikeReady={sensorState.ready}
        onNext={() => {
          dispatch({ type: "nextTurn" });
        }}
        onRetry={() => {
          dispatch({ type: "rideRetried" });
        }}
        onPlayAgain={() => {
          dispatch({ type: "gameStarted" });
        }}
        onHome={() => {
          dispatch({ type: "gameQuit" });
        }}
      />
    );
  }

  return (
    <div className={styles.app}>
      <Header {...sensorState} />
      <main className={styles.main}>{screen}</main>
    </div>
  );
}
