import { useEffect, useState } from 'react'
import type { WeatherKind } from '../../data/atmosphere'
import { gameDurationSeconds, useSceneStore } from '../../store/sceneStore'
import { playDefeatRumble, playVictoryFanfare } from './gameAudio'

// Two independent ramps over the 5 minutes: the clock runs from mid-afternoon
// into dusk, while the weather builds from clear through rain into a storm.
const gameStartHour = 15
const gameEndHour = 19.5

const weatherRamp: Array<[number, WeatherKind, number]> = [
  [0, 'clear', 0],
  [60, 'overcast', 0.5],
  [130, 'rain', 0.6],
  [210, 'storm', 0.85],
  [260, 'storm', 1],
]

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function GameHud() {
  const gameMode = useSceneStore((state) => state.gameMode)
  const gameStartedAt = useSceneStore((state) => state.gameStartedAt)
  const gameTimeRemaining = useSceneStore((state) => state.gameTimeRemaining)
  const gameTasks = useSceneStore((state) => state.gameTasks)
  const gamePrompt = useSceneStore((state) => state.gamePrompt)
  const gamePromptProgress = useSceneStore((state) => state.gamePromptProgress)
  const setGameTimeRemaining = useSceneStore(
    (state) => state.setGameTimeRemaining,
  )
  const setTimeOfDay = useSceneStore((state) => state.setTimeOfDay)
  const setWeather = useSceneStore((state) => state.setWeather)
  const loseGame = useSceneStore((state) => state.loseGame)
  const startGame = useSceneStore((state) => state.startGame)
  const exitGame = useSceneStore((state) => state.exitGame)
  const isMuted = useSceneStore((state) => state.isMuted)
  const [isOverlayDismissed, setOverlayDismissed] = useState(false)

  useEffect(() => {
    setOverlayDismissed(false)
  }, [gameMode])

  useEffect(() => {
    if (gameMode === 'won') {
      playVictoryFanfare(isMuted)
    } else if (gameMode === 'lost') {
      playDefeatRumble(isMuted)
    }
    // isMuted is read at fire time only; re-running on mute toggle would replay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode])

  useEffect(() => {
    if (gameMode !== 'playing' || gameStartedAt === null) {
      return
    }

    const intervalId = window.setInterval(() => {
      const elapsed = (Date.now() - gameStartedAt) / 1000
      const remaining = Math.max(0, gameDurationSeconds - elapsed)

      setGameTimeRemaining(Math.ceil(remaining))

      // Clock ramps smoothly toward dusk
      const dayProgress = Math.min(1, elapsed / gameDurationSeconds)
      setTimeOfDay(gameStartHour + (gameEndHour - gameStartHour) * dayProgress)

      // Weather builds on its own schedule
      let kind: WeatherKind = weatherRamp[0][1]
      let strength = weatherRamp[0][2]
      for (const [threshold, rampKind, rampStrength] of weatherRamp) {
        if (elapsed >= threshold) {
          kind = rampKind
          strength = rampStrength
        }
      }

      const current = useSceneStore.getState()
      if (current.weather !== kind || current.weatherIntensity !== strength) {
        setWeather(kind, strength)
      }

      if (remaining <= 0) {
        loseGame()
      }
    }, 250)

    return () => window.clearInterval(intervalId)
  }, [gameMode, gameStartedAt, loseGame, setTimeOfDay, setWeather, setGameTimeRemaining])

  if (gameMode === 'sandbox') {
    return null
  }

  if (gameMode === 'briefing') {
    return (
      <div className="game-overlay" role="dialog" aria-label="Storm Game briefing">
        <div className="game-overlay-panel is-briefing">
          <span className="game-overlay-kicker">Storm Game</span>
          <h2>Beat the storm home</h2>
          <p>
            You have <strong>five minutes</strong> before the weather turns.
            Work through the list, then get back to the lighthouse.
          </p>
          <ol className="game-briefing-steps">
            <li>
              <span className="game-briefing-key">E</span>
              Hold <strong>E</strong> at the woodpile to collect firewood
            </li>
            <li>
              <span className="game-briefing-key">E</span>
              Hold <strong>E</strong> at the bridge to repair it — you cannot
              cross until it is fixed
            </li>
            <li>
              <span className="game-briefing-key">→</span>
              Cross the river and reach the lighthouse
            </li>
          </ol>
          <p className="game-briefing-hint">
            <strong>WASD</strong> to move, <strong>drag</strong> to look around.
          </p>
          <div className="game-overlay-actions">
            <button type="button" className="btn-primary" onClick={startGame}>
              Start the Clock
            </button>
            <button type="button" onClick={exitGame}>
              Back to Building
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (gameMode === 'playing') {
    const isUrgent = gameTimeRemaining <= 60
    const allTasksDone = gameTasks.collectWood && gameTasks.repairBridge

    const checklist = [
      { done: gameTasks.collectWood, label: 'Collect firewood' },
      { done: gameTasks.repairBridge, label: 'Repair the bridge' },
      { done: allTasksDone, label: 'Return to the lighthouse' },
    ]

    return (
      <>
        {isUrgent ? (
          <div className="game-urgency-vignette" aria-hidden="true" />
        ) : null}
        <div className="game-hud" aria-live="polite">
          <span className={`game-hud-timer${isUrgent ? ' is-urgent' : ''}`}>
            {formatTime(gameTimeRemaining)}
          </span>
          <ul className="game-hud-tasks">
            {checklist.map((task) => (
              <li
                key={task.label}
                className={task.done ? 'is-done' : undefined}
              >
                <span className="game-task-check">{task.done ? '✓' : '○'}</span>
                {task.label}
              </li>
            ))}
          </ul>
        </div>
        {gamePrompt ? (
          <div className="game-prompt" aria-live="polite">
            <span className="game-prompt-label">{gamePrompt}</span>
            <span className="game-prompt-bar">
              <span
                className="game-prompt-fill"
                style={{ width: `${Math.round(gamePromptProgress * 100)}%` }}
              />
            </span>
          </div>
        ) : null}
      </>
    )
  }

  if (gameMode === 'won') {
    if (isOverlayDismissed) {
      return (
        <div className="game-hud" aria-live="polite">
          <span className="game-hud-task">
            The lighthouse shines. Exit Walk when you are ready.
          </span>
        </div>
      )
    }

    return (
      <div className="game-overlay" role="dialog" aria-label="Game won">
        <div className="game-overlay-panel">
          <span className="game-overlay-kicker">Safe at last</span>
          <h2>You made it home!</h2>
          <p>
            The lighthouse lamp turns, sweeping its warm light across the
            river. The storm can rage all it wants now.
          </p>
          <div className="game-overlay-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setOverlayDismissed(true)}
            >
              Watch the Light
            </button>
            <button type="button" onClick={startGame}>
              Play Again
            </button>
            <button type="button" onClick={exitGame}>
              Back to Building
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game-overlay" role="dialog" aria-label="Game lost">
      <div className="game-overlay-panel is-lost">
        <span className="game-overlay-kicker">The storm caught you</span>
        <h2>Time ran out...</h2>
        <p>
          Rain hammers the valley and the lighthouse stays dark. Maybe next
          time, take the bridge.
        </p>
        <div className="game-overlay-actions">
          <button type="button" className="btn-primary" onClick={startGame}>
            Try Again
          </button>
          <button type="button" onClick={exitGame}>
            Back to Building
          </button>
        </div>
      </div>
    </div>
  )
}
