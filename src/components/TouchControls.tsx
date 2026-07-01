import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { VirtualStickCommandInput, VirtualStickVector } from "../game/input";

type StickName = "left" | "right";

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

export interface TouchControlsProps {
  enabled: boolean;
  onChange: (sticks: VirtualStickCommandInput) => void;
  onRelease?: () => void;
}

interface TouchStickProps {
  name: StickName;
  label: string;
  hint: string;
  value: VirtualStickVector;
  disabled: boolean;
  onValueChange: (name: StickName, value: VirtualStickVector) => void;
}

const neutralStick: VirtualStickVector = { x: 0, y: 0 };

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(-1, Math.min(1, value));
}

export function normalizeTouchStickPoint(
  clientX: number,
  clientY: number,
  rect: RectLike,
): VirtualStickVector {
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: clampUnit((clientX - centerX) / radius),
    y: clampUnit((centerY - clientY) / radius),
  };
}

function knobStyle(value: VirtualStickVector) {
  return {
    transform: `translate(${value.x * 34}px, ${value.y * -34}px)`,
  };
}

function TouchStick({
  name,
  label,
  hint,
  value,
  disabled,
  onValueChange,
}: TouchStickProps) {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = stickRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    onValueChange(
      name,
      normalizeTouchStickPoint(event.clientX, event.clientY, rect),
    );
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }

    activePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onValueChange(name, neutralStick);
  };

  return (
    <div
      ref={stickRef}
      className="touch-stick"
      data-stick={name}
      data-disabled={disabled ? "true" : "false"}
      role="application"
      aria-label={`${label} 조이스틱`}
      onPointerDown={(event) => {
        if (disabled) {
          return;
        }

        activePointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (disabled || activePointerIdRef.current !== event.pointerId) {
          return;
        }

        updateFromPointer(event);
      }}
      onPointerCancel={releasePointer}
      onPointerUp={releasePointer}
    >
      <span className="touch-stick-ring" aria-hidden="true">
        <span className="touch-stick-knob" style={knobStyle(value)} />
      </span>
      <span className="touch-stick-label">{label}</span>
      <span className="touch-stick-hint">{hint}</span>
    </div>
  );
}

export function TouchControls({
  enabled,
  onChange,
  onRelease,
}: TouchControlsProps) {
  const [sticks, setSticks] = useState<VirtualStickCommandInput>({
    left: neutralStick,
    right: neutralStick,
  });
  const sticksRef = useRef(sticks);

  const setStick = (name: StickName, value: VirtualStickVector) => {
    const next = {
      ...sticksRef.current,
      [name]: value,
    };

    sticksRef.current = next;
    setSticks(next);
    onChange(next);
  };

  useEffect(() => {
    if (enabled) {
      return;
    }

    const next = { left: neutralStick, right: neutralStick };
    sticksRef.current = next;
    setSticks(next);
    onChange(next);
    onRelease?.();
  }, [enabled, onChange, onRelease]);

  return (
    <div className="touch-controls" data-enabled={enabled ? "true" : "false"}>
      <TouchStick
        name="left"
        label="스로틀"
        hint="요우"
        value={sticks.left ?? neutralStick}
        disabled={!enabled}
        onValueChange={setStick}
      />
      <TouchStick
        name="right"
        label="피치"
        hint="롤"
        value={sticks.right ?? neutralStick}
        disabled={!enabled}
        onValueChange={setStick}
      />
    </div>
  );
}
