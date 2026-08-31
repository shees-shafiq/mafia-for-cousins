'use client';

import { motion } from 'framer-motion';
import { Settings, Users, Heart, Laugh, Check, EyeOff } from 'lucide-react';
import type { GameConfig } from '@/types/game';
import { useSocket } from '@/context/SocketContext';

// ─── Checkbox Component ───────────────────────────────────────────────────────
function CheckboxOption({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => onChange(!checked)}
      className={[
        'flex items-center gap-3.5 w-full p-3.5 rounded-2xl border-2 text-left',
        'transition-all duration-200 cursor-pointer select-none',
        checked
          ? 'border-accent-violet/80 bg-accent-violet/10 shadow-glow-violet/20'
          : 'border-bg-border bg-bg-card hover:border-text-muted/40',
      ].join(' ')}
      aria-checked={checked}
      role="checkbox"
    >
      {/* Custom checkbox box */}
      <div
        className={[
          'w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150',
          checked
            ? 'border-accent-violet bg-accent-violet text-white shadow-sm'
            : 'border-bg-border bg-bg-hover text-transparent',
        ].join(' ')}
      >
        <Check size={14} strokeWidth={3} className={checked ? 'opacity-100' : 'opacity-0'} />
      </div>

      {/* Role Icon */}
      <span className="text-xl flex-shrink-0">{icon}</span>

      {/* Labels */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${checked ? 'text-text-primary' : 'text-text-secondary'}`}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-text-muted leading-snug mt-0.5">{description}</p>
        )}
      </div>
    </motion.button>
  );
}

// ─── Segmented Control ────────────────────────────────────────────────────────
function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(opt.value)}
            className={[
              'flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center',
              'transition-all duration-150 cursor-pointer',
              value === opt.value
                ? 'border-accent-violet/70 bg-accent-violet/10 text-text-primary'
                : 'border-bg-border bg-bg-card text-text-secondary hover:border-text-muted/40',
            ].join(' ')}
          >
            <span className="text-sm font-bold">{opt.label}</span>
            <span className="text-[10px] text-text-muted leading-tight">{opt.description}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Imposter Count Stepper ───────────────────────────────────────────────────
function CountStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl border-2 border-bg-border bg-bg-card">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-accent-violet-light" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Imposters</p>
          <p className="text-xs text-text-muted">How many imposters?</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="w-8 h-8 rounded-full border-2 border-bg-border flex items-center justify-center
                     text-text-secondary disabled:opacity-30 hover:border-text-muted transition-colors"
        >
          <span className="text-lg leading-none font-bold">−</span>
        </motion.button>
        <span className="w-6 text-center text-xl font-bold text-accent-yellow-light">{value}</span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border-2 border-bg-border flex items-center justify-center
                     text-text-secondary disabled:opacity-30 hover:border-text-muted transition-colors"
        >
          <span className="text-lg leading-none font-bold">+</span>
        </motion.button>
      </div>
    </div>
  );
}

// ─── Main HostConfig Component ────────────────────────────────────────────────
export default function HostConfig() {
  const { roomState, updateConfig } = useSocket();
  const config = roomState?.config;
  if (!config) return null;

  // Fully merge previous config state before sending to backend to prevent overwriting
  const patch = (partial: Partial<GameConfig>) => {
    const merged: GameConfig = {
      imposterCount: config.imposterCount,
      imposterMode: config.imposterMode,
      hasDoctor: Boolean(config.hasDoctor),
      hasJester: Boolean(config.hasJester),
      revealMode: config.revealMode,
      ...partial,
    };
    updateConfig(merged);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Settings size={16} className="text-accent-violet-light" />
        <span className="text-sm font-bold text-text-secondary uppercase tracking-wider">
          Game Settings
        </span>
      </div>

      {/* Imposter count */}
      <CountStepper
        value={config.imposterCount}
        min={1}
        max={5}
        onChange={(v) => patch({ imposterCount: v })}
      />

      {/* Imposter mode */}
      <SegmentedControl
        label="Imposter Mode"
        value={config.imposterMode}
        options={[
          {
            value: 'godfather',
            label: '🎩 Godfather',
            description: 'One boss decides the kill',
          },
          {
            value: 'roulette',
            label: '🎲 Roulette',
            description: 'Random kill picked from all',
          },
        ]}
        onChange={(v) => patch({ imposterMode: v })}
      />

      {/* Special Roles (Independent Checkboxes — Both can be active simultaneously) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Special Roles
          </p>
          <span className="text-[10px] text-text-muted font-medium">Select any combination</span>
        </div>
        <div className="space-y-2">
          <CheckboxOption
            label="Doctor"
            description="Can choose one player (or self) to protect from death each night"
            icon={<Heart size={18} className="text-accent-green" />}
            checked={Boolean(config.hasDoctor)}
            onChange={(checked) => patch({ hasDoctor: checked })}
          />
          <CheckboxOption
            label="Jester"
            description="Wins immediately if voted out by the town during the day"
            icon={<Laugh size={18} className="text-accent-violet-light" />}
            checked={Boolean(config.hasJester)}
            onChange={(checked) => patch({ hasJester: checked })}
          />
        </div>
      </div>

      {/* Reveal mode */}
      <SegmentedControl
        label="Reveal Mode"
        value={config.revealMode}
        options={[
          {
            value: 'classic',
            label: '👁 Classic',
            description: 'Role shown when eliminated',
          },
          {
            value: 'secret',
            label: '🤫 Secret',
            description: 'Role stays hidden — use Declare Victory',
          },
        ]}
        onChange={(v) => patch({ revealMode: v })}
      />

      {config.revealMode === 'secret' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-accent-yellow/10
                     border border-accent-yellow/30 text-xs text-accent-yellow-light"
        >
          <EyeOff size={14} className="mt-0.5 flex-shrink-0" />
          <span>Game continues until 75% of living players press "Declare Victory".</span>
        </motion.div>
      )}
    </motion.div>
  );
}
