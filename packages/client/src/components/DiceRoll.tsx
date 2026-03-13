import { useState, useEffect, useCallback, useRef } from 'react';

const DICE_DOTS: Record<number, string> = {
  1: '\u2680', 2: '\u2681', 3: '\u2682',
  4: '\u2683', 5: '\u2684', 6: '\u2685',
};

export type DiceMode =
  | { type: 'interactive' }
  | { type: 'result'; value: number; label?: string; modified?: { original: number; newValue: number; reason: string } }
  | { type: 'animate'; value: number; label?: string; modified?: { original: number; newValue: number; reason: string } };

interface DiceRollProps {
  mode: DiceMode;
  onRollComplete?: (value: number) => void;
  animId?: number;
}

export function DiceRoll({ mode, onRollComplete, animId }: DiceRollProps) {
  const [display, setDisplay] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAnimIdRef = useRef(-1);
  // Always-fresh callback ref to avoid stale closure issues in intervals
  const onRollCompleteRef = useRef(onRollComplete);
  onRollCompleteRef.current = onRollComplete;

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), []);

  // React to mode changes — but DON'T interrupt an ongoing interactive roll
  const isInteractiveRolling = useRef(false);
  useEffect(() => {
    if (isInteractiveRolling.current) return; // don't interrupt player's roll animation

    if (mode.type === 'interactive') {
      clearTimer();
      setDisplay(0);
      setAnimating(false);
      setShowResult(false);
    } else if (mode.type === 'result') {
      clearTimer();
      setDisplay(mode.value);
      setAnimating(false);
      setShowResult(true);
    }
  }, [mode.type, mode.type === 'result' ? mode.value : null]);

  // Handle 'animate' mode: play roll animation then show target value
  useEffect(() => {
    if (mode.type !== 'animate') return;
    if (animId !== undefined && animId === lastAnimIdRef.current) return;
    if (animId !== undefined) lastAnimIdRef.current = animId;

    clearTimer();
    setAnimating(true);
    setShowResult(false);

    let frame = 0;
    const maxFrames = 7;
    const targetValue = mode.value;
    intervalRef.current = setInterval(() => {
      setDisplay(Math.floor(Math.random() * 6) + 1);
      frame++;
      if (frame >= maxFrames) {
        clearTimer();
        setDisplay(targetValue);
        setAnimating(false);
        setShowResult(true);
      }
    }, 70);
  }, [animId, mode.type === 'animate' ? mode.value : null]);

  // Interactive roll
  const doRoll = useCallback(() => {
    if (mode.type !== 'interactive' || animating) return;
    clearTimer();
    isInteractiveRolling.current = true;
    setAnimating(true);
    setShowResult(false);

    let frame = 0;
    const maxFrames = 12;
    const final = Math.floor(Math.random() * 6) + 1;
    intervalRef.current = setInterval(() => {
      setDisplay(Math.floor(Math.random() * 6) + 1);
      frame++;
      if (frame >= maxFrames) {
        clearTimer();
        setDisplay(final);
        setAnimating(false);
        setShowResult(true);
        isInteractiveRolling.current = false;
        onRollCompleteRef.current?.(final);
      }
    }, 70);
  }, [mode.type, animating]);

  const label = mode.type === 'result' ? mode.label
    : mode.type === 'animate' ? mode.label
    : undefined;
  const modified = mode.type === 'result' ? mode.modified
    : mode.type === 'animate' ? mode.modified
    : undefined;

  return (
    <div className="dice-area">
      {label && <div className="dice-owner-label"><span>{label}</span></div>}
      <button
        type="button"
        className={`dice-face-new ${animating ? 'dice-rolling-new' : ''} ${showResult ? 'dice-result' : ''}`}
        onClick={mode.type === 'interactive' && !animating ? doRoll : undefined}
        disabled={mode.type !== 'interactive' || animating}
        aria-label={display > 0 ? `骰子：${display}` : '掷骰子'}
      >
        {display > 0 ? DICE_DOTS[display] : '?'}
      </button>

      {modified && showResult && (
        <div className="dice-mod">
          <span className="dice-mod-original">{modified.original}</span>
          <span className="dice-mod-arrow">→</span>
          <span className="dice-mod-new">{modified.newValue}</span>
          <span className="dice-mod-reason">({modified.reason})</span>
        </div>
      )}

      {mode.type === 'interactive' && !animating && !showResult && (
        <button className="btn-primary dice-roll-btn" onClick={doRoll}>
          掷骰子！
        </button>
      )}
      {animating && (
        <span className="dice-rolling-text">掷骰中…</span>
      )}
    </div>
  );
}
