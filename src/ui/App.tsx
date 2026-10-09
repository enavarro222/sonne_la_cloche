import { useEffect, useMemo, useReducer, useState } from "react";
import { bestRide, currentPlayer, initialState, isGameOver, reducer } from "../core/game";
import { isBluetoothSupported } from "../sensors/ble/bluetoothSensor";
import { courseFor } from "../core/handicap";
import { SLOPE_PERCENT } from "../core/settings";
import { loadRoster, loadSettings, saveRoster, saveSettings } from "../storage/storage";
import styles from "./App.module.css";
import { Header } from "./Header";
import { HomeScreen } from "./HomeScreen";
import { ResultScreen } from "./ResultScreen";
import { RideScreen } from "./RideScreen";
import { SettingsScreen } from "./SettingsScreen";
import { sounds } from "./sound";
import { useHistoryGuard } from "./useHistoryGuard";
import { useLeaveWarning } from "./useLeaveWarning";
import { useSensor } from "./useSensor";
import { useWakeLock } from "./useWakeLock";

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(loadRoster(), loadSettings()),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  // ?dev in the address: express games, and every feature without a bike.
  const testMode = new URLSearchParams(location.search).has("dev");
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
  // Right away on connection (the trainer may still be set up for an adult,
  // or in ERG mode after another app), and whenever the setting changes.
  const course = useMemo(
    () =>
      game?.phase === "riding" && game.settings.metric === "distance" ? courseFor(game) : null,
    [game],
  );
  const grade = course?.gradePct ?? SLOPE_PERCENT[state.settings.slope];
  useEffect(() => {
    void sensor?.setSlope?.(grade);
  }, [sensor, grade]);
  useHistoryGuard(game !== null);
  useLeaveWarning(game !== null && !isGameOver(game));

  let screen;
  if (!game) {
    screen = settingsOpen ? (
      <SettingsScreen
        settings={state.settings}
        testMode={testMode}
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
        // Read on each render: what the bike sends only shows once connected.
        measuresPower={sensor?.measuresPower() ?? true}
        bluetoothSupported={isBluetoothSupported()}
        onAddPlayer={(name) => {
          dispatch({ type: "playerAdded", player: { id: crypto.randomUUID(), name } });
        }}
        onRemovePlayer={(id) => {
          dispatch({ type: "playerRemoved", id });
        }}
        onRecolourPlayer={(id) => {
          dispatch({ type: "playerRecoloured", id });
        }}
        onMovePlayer={(id, index) => {
          dispatch({ type: "playerMoved", id, index });
        }}
        onStart={() => {
          dispatch({ type: "gameStarted", measuresPower: sensor?.measuresPower() ?? true });
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
        course={course}
        onFinish={(ride) => {
          sounds.fanfare();
          dispatch({ type: "rideFinished", ...ride });
        }}
      />
    );
  } else {
    screen = (
      <ResultScreen
        game={game}
        bikeReady={sensorState.ready}
        // A demo game on Strava would be a fake activity.
        stravaAvailable={sensorState.connection.kind === "bluetooth" || testMode}
        onNext={() => {
          dispatch({ type: "nextTurn" });
        }}
        onRetry={() => {
          dispatch({ type: "rideRetried" });
        }}
        onPlayAgain={() => {
          dispatch({ type: "gameStarted", measuresPower: sensor?.measuresPower() ?? true });
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
