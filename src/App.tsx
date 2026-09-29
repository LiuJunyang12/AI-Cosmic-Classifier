import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Archetype, CelestialTarget, Difficulty, TargetType, Upgrades, Wavelength } from './types';
import { sfx } from './sound';
import { drawAstronomicalTarget } from './drawTarget';

const TARGET_TYPES: Archetype[] = [
  { type: 'spiral_galaxy', name: 'Spiral Galaxy', dustProb: 0.35 },
  { type: 'elliptical_galaxy', name: 'Elliptical Galaxy', dustProb: 0.2 },
  { type: 'supernova', name: 'Supernova Transient', dustProb: 0.25 },
  { type: 'black_hole', name: 'Supermassive Black Hole / AGN', dustProb: 0.4 },
  { type: 'noise_artifact', name: 'CCD Sensor Noise', dustProb: 0.0 },
];

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
}

export default function App() {
  // Screens & Modals
  const [screen, setScreen] = useState<'start' | 'game'>('start');
  const [showManual, setShowManual] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  // Settings & Sound
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  // Game stats
  const [score, setScore] = useState(0);
  const [targetScore, setTargetScore] = useState(1000);
  const [computePoints, setComputePoints] = useState(0);
  const [integrity, setIntegrity] = useState(100);
  const [combo, setCombo] = useState(0);
  const [peakCombo, setPeakCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalClassified, setTotalClassified] = useState(0);

  // Wavelength
  const [currentWavelength, setCurrentWavelength] = useState<Wavelength>('optical');

  // Upgrades
  const [upgrades, setUpgrades] = useState<Upgrades>({
    scoreEnhancer: 0,
    quantumScanner: 0,
    redundancyBuffer: 0,
  });

  // Active temporary buffs
  const [autoScanActive, setAutoScanActive] = useState(false);
  const [timeDilationActive, setTimeDilationActive] = useState(false);

  // Floating notifications
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);

  // Canvas Refs
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const surveyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable Game Loop State in Ref to avoid stale closures during 60fps render
  const gameStateRef = useRef({
    active: false,
    paused: false,
    difficulty: 'easy' as Difficulty,
    targetScore: 1000,
    score: 0,
    computePoints: 0,
    integrity: 100,
    combo: 0,
    peakCombo: 0,
    correctCount: 0,
    totalClassified: 0,
    currentWavelength: 'optical' as Wavelength,
    selectedTarget: null as CelestialTarget | null,
    targets: [] as CelestialTarget[],
    upgrades: { scoreEnhancer: 0, quantumScanner: 0, redundancyBuffer: 0 },
    autoScanActive: false,
    timeDilationActive: false,
    spawnInterval: 2800,
    lastSpawn: 0,
    animFrame: null as number | null,
  });

  // Selected Target state for UI
  const [selectedTarget, setSelectedTarget] = useState<CelestialTarget | null>(null);

  // Sync React states to ref
  useEffect(() => {
    gameStateRef.current.currentWavelength = currentWavelength;
  }, [currentWavelength]);

  useEffect(() => {
    gameStateRef.current.upgrades = upgrades;
  }, [upgrades]);

  useEffect(() => {
    gameStateRef.current.autoScanActive = autoScanActive;
  }, [autoScanActive]);

  useEffect(() => {
    gameStateRef.current.timeDilationActive = timeDilationActive;
  }, [timeDilationActive]);

  const triggerFloatingText = useCallback((text: string, x: number, y: number, color: string) => {
    const id = Date.now() + Math.random();
    setFloatingTexts((prev) => [...prev, { id, text, x, y, color }]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((item) => item.id !== id));
    }, 800);
  }, []);

  // Background Starfield Setup
  useEffect(() => {
    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let stars: Array<{ x: number; y: number; size: number; alpha: number; speed: number }> = [];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = [];
      for (let i = 0; i < 150; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          alpha: Math.random(),
          speed: Math.random() * 0.02 + 0.005,
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      stars.forEach((s) => {
        s.alpha += s.speed;
        const a = ((Math.sin(s.alpha) + 1) / 2) * 0.8 + 0.2;
        ctx.globalAlpha = a;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Wavelength Switcher
  const handleSetWavelength = useCallback((wave: Wavelength) => {
    setCurrentWavelength(wave);
    gameStateRef.current.currentWavelength = wave;
    sfx.playWaveSwitch();
  }, []);

  // Sound Toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sfx.enabled = next;
    if (next) sfx.init();
  };

  // Misclassification handler
  const handleMisclassification = useCallback((reason: string) => {
    const g = gameStateRef.current;
    g.combo = 0;
    setCombo(0);

    let damage = 10;
    if (g.upgrades.redundancyBuffer > 0) {
      damage *= 1 - g.upgrades.redundancyBuffer * 0.2;
    }

    g.integrity = Math.max(0, g.integrity - damage);
    setIntegrity(Math.round(g.integrity));

    const sCanvas = surveyCanvasRef.current;
    const fxX = sCanvas ? sCanvas.width / 2 : window.innerWidth / 2;
    const fxY = sCanvas ? sCanvas.height - 40 : window.innerHeight / 2;
    triggerFloatingText(`⚠️ ${reason}`, fxX, fxY, '#FF0055');

    if (g.integrity <= 0) {
      endGameSession();
    }
  }, [triggerFloatingText]);

  // Victory Handler
  const victorySession = useCallback(() => {
    const g = gameStateRef.current;
    g.active = false;
    g.paused = false;
    if (g.animFrame) cancelAnimationFrame(g.animFrame);
    sfx.playVictory();
    setShowVictory(true);
  }, []);

  // End Game Handler
  const endGameSession = useCallback(() => {
    const g = gameStateRef.current;
    g.active = false;
    g.paused = false;
    if (g.animFrame) cancelAnimationFrame(g.animFrame);
    setShowGameOver(true);
  }, []);

  // Classification logic
  const classifyTarget = useCallback((submittedType: TargetType, forcedTarget?: CelestialTarget | null) => {
    const g = gameStateRef.current;
    const tgt = forcedTarget || g.selectedTarget;
    if (!tgt || !g.active || g.paused) return;

    g.totalClassified++;
    setTotalClassified(g.totalClassified);

    const isObscuredByDust =
      tgt.hasDust && g.currentWavelength === 'optical' && g.upgrades.quantumScanner === 0;

    if (isObscuredByDust) {
      sfx.playError();
      handleMisclassification('Dust Fog Obscured Spectral Image! Switch Wavelength!');
      return;
    }

    if (submittedType === tgt.type) {
      sfx.playCorrect();
      g.correctCount++;
      setCorrectCount(g.correctCount);
      g.combo++;
      if (g.combo > g.peakCombo) {
        g.peakCombo = g.combo;
        setPeakCombo(g.combo);
      }
      setCombo(g.combo);

      const basePoints = 100;
      const multiplier = 1 + g.upgrades.scoreEnhancer * 0.5 + g.combo * 0.1;
      const earnedScore = Math.floor(basePoints * multiplier);
      const earnedCP = 10 + Math.floor(g.combo * 2);

      g.score += earnedScore;
      g.computePoints += earnedCP;
      setScore(g.score);
      setComputePoints(g.computePoints);

      const sCanvas = surveyCanvasRef.current;
      const canvasRect = sCanvas?.getBoundingClientRect();
      const fxX = canvasRect ? canvasRect.left + tgt.x : tgt.x;
      const fxY = canvasRect ? canvasRect.top + tgt.y : tgt.y;
      triggerFloatingText(`+${earnedScore} PTS`, fxX, fxY, '#00F2FE');

      // Remove Target
      const index = g.targets.findIndex((t) => t.id === tgt.id);
      if (index !== -1) g.targets.splice(index, 1);
      g.selectedTarget = g.targets[0] || null;
      setSelectedTarget(g.selectedTarget);

      if (g.score >= g.targetScore) {
        victorySession();
      }
    } else {
      sfx.playError();
      handleMisclassification(`Incorrect Label! Was ${tgt.name}`);
    }
  }, [handleMisclassification, triggerFloatingText, victorySession]);

  // Target Factory
  const spawnTarget = useCallback(() => {
    const sCanvas = surveyCanvasRef.current;
    if (!sCanvas) return;

    const archetype = TARGET_TYPES[Math.floor(Math.random() * TARGET_TYPES.length)];
    const size = 56;
    const margin = 40;
    const cWidth = sCanvas.width > 100 ? sCanvas.width : 500;
    const x = margin + Math.random() * (cWidth - margin * 2);

    let speed = 0.35 + Math.random() * 0.35;
    if (gameStateRef.current.difficulty === 'medium') speed *= 1.25;
    if (gameStateRef.current.difficulty === 'hard') speed *= 1.5;

    const hasDust = Math.random() < archetype.dustProb;

    const target: CelestialTarget = {
      id: 'tgt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: archetype.type,
      name: archetype.name,
      x: x,
      y: -size,
      size: size,
      speed: speed,
      hasDust: hasDust,
      pulse: Math.random() * 10,
      ra: Math.floor(Math.random() * 24) + 'h ' + Math.floor(Math.random() * 60) + 'm',
      dec: (Math.random() > 0.5 ? '+' : '-') + Math.floor(Math.random() * 90) + '°',
    };

    gameStateRef.current.targets.push(target);
    if (!gameStateRef.current.selectedTarget) {
      gameStateRef.current.selectedTarget = target;
      setSelectedTarget(target);
    }
  }, []);

  // Update Left Analyzer Preview Canvas
  const updateAnalyzerHUD = useCallback((tgt: CelestialTarget | null) => {
    const pCanvas = previewCanvasRef.current;
    if (!pCanvas) return;
    const pCtx = pCanvas.getContext('2d');
    if (!pCtx) return;

    pCanvas.width = 160;
    pCanvas.height = 160;
    pCtx.clearRect(0, 0, 160, 160);

    if (tgt) {
      pCtx.save();
      const scale = 160 / tgt.size;
      pCtx.scale(scale, scale);
      const bypassDust = gameStateRef.current.upgrades.quantumScanner > 0;
      drawAstronomicalTarget(
        pCtx,
        tgt.type,
        tgt.size,
        gameStateRef.current.currentWavelength,
        bypassDust ? false : tgt.hasDust,
        tgt.pulse
      );
      pCtx.restore();
    }
  }, []);

  // Canvas loop
  const gameLoop = useCallback(
    (timestamp: number) => {
      const g = gameStateRef.current;
      if (!g.active || g.paused) return;

      const sCanvas = surveyCanvasRef.current;
      if (!sCanvas) return;
      const sCtx = sCanvas.getContext('2d');
      if (!sCtx) return;

      // Handle Spawning
      const effectiveInterval = g.timeDilationActive ? g.spawnInterval * 2 : g.spawnInterval;
      if (timestamp - g.lastSpawn > effectiveInterval) {
        spawnTarget();
        g.lastSpawn = timestamp;
      }

      sCtx.clearRect(0, 0, sCanvas.width, sCanvas.height);

      const speedMultiplier = g.timeDilationActive ? 0.4 : 1.0;
      const bypassDust = g.upgrades.quantumScanner > 0;

      for (let i = g.targets.length - 1; i >= 0; i--) {
        const tgt = g.targets[i];
        tgt.y += tgt.speed * speedMultiplier;
        tgt.pulse += 0.05;

        sCtx.save();
        sCtx.translate(tgt.x - tgt.size / 2, tgt.y - tgt.size / 2);

        // Draw Selection Reticle
        if (g.selectedTarget && g.selectedTarget.id === tgt.id) {
          sCtx.strokeStyle = '#00F2FE';
          sCtx.lineWidth = 1.5;
          sCtx.strokeRect(-4, -4, tgt.size + 8, tgt.size + 8);

          sCtx.fillStyle = '#00F2FE';
          sCtx.fillRect(-6, -6, 6, 2);
          sCtx.fillRect(-6, -6, 2, 6);
          sCtx.fillRect(tgt.size, -6, 6, 2);
          sCtx.fillRect(tgt.size + 4, -6, 2, 6);
        }

        drawAstronomicalTarget(
          sCtx,
          tgt.type,
          tgt.size,
          g.currentWavelength,
          bypassDust ? false : tgt.hasDust,
          tgt.pulse
        );
        sCtx.restore();

        // Check boundary
        if (tgt.y - tgt.size > sCanvas.height) {
          handleMisclassification('Escaped Survey FOV');
          g.targets.splice(i, 1);
          if (g.selectedTarget && g.selectedTarget.id === tgt.id) {
            g.selectedTarget = g.targets[0] || null;
            setSelectedTarget(g.selectedTarget);
          }
        }
      }

      // Auto-scan execution
      if (g.autoScanActive && g.targets.length > 0) {
        const autoTgt = g.targets[0];
        classifyTarget(autoTgt.type, autoTgt);
      }

      // Update Preview
      if (g.selectedTarget) {
        updateAnalyzerHUD(g.selectedTarget);
      } else {
        updateAnalyzerHUD(null);
      }

      g.animFrame = requestAnimationFrame(gameLoop);
    },
    [classifyTarget, handleMisclassification, spawnTarget, updateAnalyzerHUD]
  );

  // Resize survey canvas
  const resizeSurveyCanvas = useCallback(() => {
    const canvas = surveyCanvasRef.current;
    if (canvas && canvas.parentElement) {
      const rect = canvas.parentElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    }
  }, []);

  // Start game session
  const startGameSession = () => {
    sfx.init();

    const targetGoal = difficulty === 'easy' ? 1000 : difficulty === 'medium' ? 2500 : 5000;
    setTargetScore(targetGoal);
    setScore(0);
    setComputePoints(0);
    setIntegrity(100);
    setCombo(0);
    setPeakCombo(0);
    setCorrectCount(0);
    setTotalClassified(0);
    setCurrentWavelength('optical');
    setSelectedTarget(null);

    const g = gameStateRef.current;
    g.active = true;
    g.paused = false;
    g.difficulty = difficulty;
    g.targetScore = targetGoal;
    g.score = 0;
    g.computePoints = 0;
    g.integrity = 100;
    g.combo = 0;
    g.peakCombo = 0;
    g.correctCount = 0;
    g.totalClassified = 0;
    g.currentWavelength = 'optical';
    g.targets = [];
    g.selectedTarget = null;
    g.lastSpawn = performance.now();

    setScreen('game');
    setShowGameOver(false);
    setShowPause(false);
    setShowVictory(false);

    setTimeout(() => {
      resizeSurveyCanvas();
      g.animFrame = requestAnimationFrame(gameLoop);
    }, 50);
  };

  const pauseGame = () => {
    if (!gameStateRef.current.active || gameStateRef.current.paused) return;
    gameStateRef.current.paused = true;
    setShowPause(true);
  };

  const resumeGame = () => {
    if (!gameStateRef.current.active || !gameStateRef.current.paused) return;
    gameStateRef.current.paused = false;
    setShowPause(false);
    gameStateRef.current.lastSpawn = performance.now();
    gameStateRef.current.animFrame = requestAnimationFrame(gameLoop);
  };

  const returnToHome = () => {
    const g = gameStateRef.current;
    g.active = false;
    g.paused = false;
    if (g.animFrame) cancelAnimationFrame(g.animFrame);

    setShowPause(false);
    setShowVictory(false);
    setShowGameOver(false);
    setScreen('start');
  };

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const g = gameStateRef.current;
      if (!g.active) return;

      const key = e.key.toLowerCase();
      if (key === 'p' || key === 'escape') {
        if (g.paused) resumeGame();
        else pauseGame();
        return;
      }

      if (g.paused) return;

      switch (key) {
        case '1':
          handleSetWavelength('optical');
          break;
        case '2':
          handleSetWavelength('infrared');
          break;
        case '3':
          handleSetWavelength('xray');
          break;
        case 'q':
          classifyTarget('spiral_galaxy');
          break;
        case 'w':
          classifyTarget('elliptical_galaxy');
          break;
        case 'e':
          classifyTarget('supernova');
          break;
        case 'r':
          classifyTarget('black_hole');
          break;
        case 't':
          classifyTarget('noise_artifact');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [classifyTarget, handleSetWavelength]);

  // Window resize observer
  useEffect(() => {
    window.addEventListener('resize', resizeSurveyCanvas);
    return () => window.removeEventListener('resize', resizeSurveyCanvas);
  }, [resizeSurveyCanvas]);

  // Ability activations
  const triggerAutoScan = () => {
    const g = gameStateRef.current;
    if (g.computePoints >= 100 && !g.autoScanActive) {
      g.computePoints -= 100;
      setComputePoints(g.computePoints);
      setAutoScanActive(true);
      setTimeout(() => {
        setAutoScanActive(false);
      }, 5000);
    }
  };

  const triggerTimeDilation = () => {
    const g = gameStateRef.current;
    if (g.computePoints >= 150 && !g.timeDilationActive) {
      g.computePoints -= 150;
      setComputePoints(g.computePoints);
      setTimeDilationActive(true);
      setTimeout(() => {
        setTimeDilationActive(false);
      }, 8000);
    }
  };

  // Shop Upgrades
  const buyUpgrade1 = () => {
    const g = gameStateRef.current;
    if (g.computePoints >= 100 && upgrades.scoreEnhancer < 5) {
      g.computePoints -= 100;
      setComputePoints(g.computePoints);
      setUpgrades((prev) => ({ ...prev, scoreEnhancer: prev.scoreEnhancer + 1 }));
    }
  };

  const buyUpgrade2 = () => {
    const g = gameStateRef.current;
    if (g.computePoints >= 250 && upgrades.quantumScanner === 0) {
      g.computePoints -= 250;
      setComputePoints(g.computePoints);
      setUpgrades((prev) => ({ ...prev, quantumScanner: 1 }));
    }
  };

  const buyUpgrade3 = () => {
    const g = gameStateRef.current;
    if (g.computePoints >= 150 && upgrades.redundancyBuffer < 3) {
      g.computePoints -= 150;
      setComputePoints(g.computePoints);
      setUpgrades((prev) => ({ ...prev, redundancyBuffer: prev.redundancyBuffer + 1 }));
    }
  };

  const accuracyRate =
    totalClassified > 0 ? ((correctCount / totalClassified) * 100).toFixed(1) : '100.0';

  return (
    <div className="min-h-screen flex flex-col relative select-none bg-[#060813] text-slate-200 font-rajdhani overflow-x-hidden">
      {/* Background Starfield Canvas */}
      <canvas ref={bgCanvasRef} className="fixed inset-0 pointer-events-none z-0" />
      <div className="scanline fixed inset-0 pointer-events-none z-10 opacity-60" />

      {/* Floating Animated Text */}
      {floatingTexts.map((f) => (
        <div
          key={f.id}
          className="fixed pointer-events-none font-orbitron font-extrabold text-sm z-50 animate-bounce"
          style={{
            color: f.color,
            left: f.x,
            top: f.y,
            textShadow: '0 0 8px currentColor',
          }}
        >
          {f.text}
        </div>
      ))}

      {/* Header */}
      <header className="relative z-20 border-b border-cyan-500/20 bg-slate-950/80 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg border border-cyan-400/50 bg-cyan-950/40 flex items-center justify-center text-cyan-400 font-orbitron font-bold text-lg shadow-glow-cyan">
            AI
          </div>
          <div>
            <h1 className="font-orbitron font-extrabold text-lg sm:text-xl tracking-wider text-cyan-400 flex items-center gap-2">
              AI COSMIC CLASSIFIER
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                v3.1 RUBIN-LSST
              </span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Deep Space Multi-Wavelength Survey & Neural Pattern Recognition System
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4 font-orbitron text-xs sm:text-sm">
          <button
            onClick={() => setShowManual(true)}
            className="px-3 py-1.5 rounded-md glass-panel hover:bg-emerald-500/20 text-emerald-300 transition flex items-center gap-1.5 border border-emerald-500/30 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden md:inline">GAMEPLAY</span> MANUAL
          </button>

          <button
            onClick={() => setShowCodex(true)}
            className="px-3 py-1.5 rounded-md glass-panel hover:bg-cyan-500/20 text-cyan-300 transition flex items-center gap-1.5 border border-cyan-500/30 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="hidden md:inline">ASTRO</span> CODEX
          </button>

          <button
            onClick={() => setShowShop(true)}
            className="px-3 py-1.5 rounded-md glass-panel hover:bg-amber-500/20 text-amber-300 transition flex items-center gap-1.5 border border-amber-500/30 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden md:inline">AI TECH</span> SHOP
          </button>

          <button
            onClick={toggleSound}
            className="p-2 rounded-md glass-panel hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 cursor-pointer"
            title="Toggle Sound"
          >
            {soundEnabled ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M11 5L6 9H2v6h4l5 4V5z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Screen 1: Start Screen */}
      {screen === 'start' && (
        <main className="relative z-20 flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-3xl glass-panel rounded-2xl p-6 sm:p-10 border border-cyan-500/40 shadow-glow-cyan relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-mono mb-4">
              MISSION OVERVIEW // RUBIN OBSERVATORY AI INITIATIVE
            </div>

            <h2 className="font-orbitron text-3xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-200 to-purple-400 mb-4 tracking-wide">
              TRAIN THE AI COSMIC ENGINE
            </h2>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 max-w-2xl mx-auto">
              The Vera C. Rubin Observatory generates over <strong>20 Terabytes</strong> of sky survey data every single night.
              As lead Neural Network Trainer, your objective is to analyze deep space targets in real-time, switch between{' '}
              <span className="text-cyan-300 font-semibold">Optical</span>,{' '}
              <span className="text-orange-400 font-semibold">Infrared</span>, and{' '}
              <span className="text-purple-400 font-semibold">X-Ray</span> spectrums to pierce cosmic dust, and accurately classify galaxies, supernovas, black holes, and sensor noise.
            </p>

            {/* Key Mechanics Quick Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-cyan-500/20">
                <div className="text-cyan-400 font-bold font-orbitron mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> 1. DATA STREAM
                </div>
                <span className="text-slate-400">Targets flow down the scanner. Classify before they collapse.</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-orange-500/20">
                <div className="text-orange-400 font-bold font-orbitron mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400" /> 2. SPECTRUM SHIFT
                </div>
                <span className="text-slate-400">Cosmic dust obscures targets. Switch wavelengths to reveal true forms.</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-amber-500/20">
                <div className="text-amber-400 font-bold font-orbitron mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> 3. EARN COMPUTE
                </div>
                <span className="text-slate-400">Gain CP (Compute Points) to purchase Neural Auto-Scan & Time Dilation.</span>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <span className="text-xs font-orbitron text-slate-400 uppercase tracking-widest">
                Select Sector Difficulty:
              </span>
              <div className="flex rounded-lg bg-slate-900/80 p-1 border border-slate-700/60 font-orbitron text-xs">
                <button
                  type="button"
                  onClick={() => setDifficulty('easy')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    difficulty === 'easy'
                      ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  NOVICE (1,000 PTS)
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('medium')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    difficulty === 'medium'
                      ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  PRO (2,500 PTS)
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('hard')}
                  className={`px-3 py-1.5 rounded-md transition ${
                    difficulty === 'hard'
                      ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  ASTROPHYSICIST (5,000 PTS)
                </button>
              </div>
            </div>

            <button
              onClick={startGameSession}
              className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-extrabold text-lg tracking-wider transition-all duration-300 shadow-glow-cyan transform hover:-translate-y-0.5 cursor-pointer"
            >
              INITIALIZE SURVEY AI SESSION
            </button>
          </div>
        </main>
      )}

      {/* Screen 2: Game Screen */}
      {screen === 'game' && (
        <main className="relative z-20 flex-1 flex flex-col lg:flex-row p-2 sm:p-4 gap-3">
          {/* LEFT PANEL: HUD Telemetry & Current Target Info */}
          <div className="w-full lg:w-72 flex flex-col gap-3">
            {/* Status Card */}
            <div className="glass-panel rounded-xl p-3 border border-cyan-500/30">
              <div className="text-xs font-orbitron text-cyan-400 tracking-wider mb-2 flex items-center justify-between">
                <span>AI NEURAL INTEGRITY</span>
                <span
                  className={`font-bold ${
                    integrity < 30 ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {integrity}%
                </span>
              </div>
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-300 ${
                    integrity < 30
                      ? 'bg-gradient-to-r from-red-600 to-rose-500'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                  }`}
                  style={{ width: `${integrity}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 font-orbitron">
              <div className="glass-panel rounded-xl p-3 border border-slate-700/50">
                <div className="text-[10px] text-slate-400 flex justify-between items-center">
                  <span>TOTAL SCORE</span>
                  <span className="text-cyan-400/90 text-[9px] font-bold">
                    GOAL: {targetScore.toLocaleString()}
                  </span>
                </div>
                <div className="text-xl font-bold text-cyan-300">{score.toLocaleString()}</div>
              </div>

              <div className="glass-panel rounded-xl p-3 border border-amber-500/30 bg-amber-950/10">
                <div className="text-[10px] text-amber-400">COMPUTE POINTS</div>
                <div className="text-xl font-bold text-amber-300">{computePoints} CP</div>
              </div>

              <div className="glass-panel rounded-xl p-3 border border-slate-700/50">
                <div className="text-[10px] text-slate-400">ACCURACY</div>
                <div className="text-lg font-bold text-teal-300">{accuracyRate}%</div>
              </div>

              <div className="glass-panel rounded-xl p-3 border border-purple-500/30">
                <div className="text-[10px] text-purple-400">COMBO STREAK</div>
                <div className="text-lg font-bold text-purple-300">x{combo}</div>
              </div>
            </div>

            {/* Active Scanner Analysis Box */}
            <div className="glass-panel rounded-xl p-3 border border-cyan-500/30 flex-1 flex flex-col">
              <div className="text-xs font-orbitron text-cyan-400 tracking-wider mb-2 flex items-center justify-between">
                <span>SPECTRAL TARGET ANALYZER</span>
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              </div>

              <div className="w-full aspect-square rounded-lg bg-slate-950/80 border border-slate-800 relative flex flex-col items-center justify-center overflow-hidden mb-2">
                <canvas ref={previewCanvasRef} className="w-full h-full" />
                <div className="absolute inset-0 pointer-events-none border border-cyan-500/20 rounded-lg flex flex-col justify-between p-2">
                  <div className="flex justify-between text-[9px] font-mono text-cyan-500/70">
                    <span>FOV: 0.12°</span>
                    <span>
                      {currentWavelength === 'optical' && 'OPTICAL [400-700nm]'}
                      {currentWavelength === 'infrared' && 'INFRARED [750nm-1mm]'}
                      {currentWavelength === 'xray' && 'X-RAY [0.01-10nm]'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-cyan-500/70">
                    <span>
                      {selectedTarget
                        ? `RA: ${selectedTarget.ra} / DEC: ${selectedTarget.dec}`
                        : 'RA: -- / DEC: --'}
                    </span>
                    <span>NOISE: LOW</span>
                  </div>
                </div>
              </div>

              {/* Target Info Breakdown */}
              <div className="text-xs font-mono space-y-1 text-slate-300 flex-1 flex flex-col justify-center">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">Dust Density:</span>
                  <span
                    className={
                      selectedTarget?.hasDust && currentWavelength === 'optical' && upgrades.quantumScanner === 0
                        ? 'text-amber-400 font-bold'
                        : 'text-slate-300'
                    }
                  >
                    {selectedTarget
                      ? selectedTarget.hasDust
                        ? currentWavelength === 'optical' && upgrades.quantumScanner === 0
                          ? 'HIGH (Obscured)'
                          : 'PENETRATED'
                        : '0% (Clear)'
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">Spectral Peak:</span>
                  <span className="text-cyan-400">
                    {currentWavelength === 'optical'
                      ? 'Visible Light'
                      : currentWavelength === 'infrared'
                      ? 'Thermal IR'
                      : 'High-Energy X-Ray'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-500">AI Confidence:</span>
                  <span className="text-amber-400">
                    {selectedTarget ? 'Target Locked' : 'Awaiting Target'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CENTER PANEL: Deep Space Sky Survey Data Stream Canvas */}
          <div className="flex-1 flex flex-col gap-2 relative">
            {/* Wavelength Band Selector Bar */}
            <div className="glass-panel rounded-xl p-2 border border-slate-700 flex items-center justify-between gap-2 font-orbitron text-xs">
              <span className="text-slate-400 text-[11px] hidden sm:inline px-2">WAVELENGTH:</span>
              <div className="flex flex-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetWavelength('optical')}
                  className={`flex-1 py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                    currentWavelength === 'optical'
                      ? 'bg-cyan-950/80 border border-cyan-400 text-cyan-300 shadow-glow-cyan'
                      : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-cyan-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  OPTICAL <span className="text-[9px] opacity-60 hidden md:inline">[Key 1]</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWavelength('infrared')}
                  className={`flex-1 py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                    currentWavelength === 'infrared'
                      ? 'bg-orange-950/80 border border-orange-400 text-orange-300 shadow-glow-ir'
                      : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-orange-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  INFRARED <span className="text-[9px] opacity-60 hidden md:inline">[Key 2]</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetWavelength('xray')}
                  className={`flex-1 py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                    currentWavelength === 'xray'
                      ? 'bg-purple-950/80 border border-purple-400 text-purple-300 shadow-glow-xray'
                      : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-purple-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  X-RAY <span className="text-[9px] opacity-60 hidden md:inline">[Key 3]</span>
                </button>
              </div>
              <button
                type="button"
                onClick={pauseGame}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-bold flex items-center gap-1 transition shadow-glow-cyan cursor-pointer"
              >
                <span>⏸️</span> <span className="hidden sm:inline">MENU</span>
              </button>
            </div>

            {/* Main Interactive Survey Canvas Stream Area */}
            <div className="flex-1 glass-panel rounded-xl border border-cyan-500/30 relative overflow-hidden min-h-[360px]">
              <canvas
                ref={surveyCanvasRef}
                onClick={(e) => {
                  const canvas = surveyCanvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const clickY = e.clientY - rect.top;

                  for (const tgt of gameStateRef.current.targets) {
                    const dist = Math.hypot(clickX - tgt.x, clickY - tgt.y);
                    if (dist < tgt.size) {
                      sfx.playScan();
                      gameStateRef.current.selectedTarget = tgt;
                      setSelectedTarget(tgt);
                      break;
                    }
                  }
                }}
                className="w-full h-full absolute inset-0 cursor-crosshair"
              />

              {/* Canvas Overlay Telemetry */}
              <div className="absolute top-3 left-3 pointer-events-none font-mono text-[10px] text-cyan-400/80 bg-slate-950/60 p-1.5 rounded border border-cyan-500/20">
                <div>SURVEY STREAM // VERA RUBIN DATA PIPELINE</div>
                <div>
                  SECTOR LEVEL {difficulty === 'easy' ? '1 // NOVICE' : difficulty === 'medium' ? '2 // PRO' : '3 // ASTROPHYSICIST'}
                </div>
              </div>

              <div className="absolute top-3 right-3 pointer-events-none flex gap-2">
                {timeDilationActive && (
                  <div className="font-orbitron text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded animate-pulse">
                    ⏳ TIME DILATION ACTIVE
                  </div>
                )}
                {autoScanActive && (
                  <div className="font-orbitron text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-1 rounded animate-pulse">
                    🤖 AUTO-SCAN ACTIVE
                  </div>
                )}
              </div>
            </div>

            {/* AI Abilities Shortcut Bar */}
            <div className="grid grid-cols-2 gap-2 font-orbitron text-xs">
              <button
                type="button"
                onClick={triggerAutoScan}
                disabled={computePoints < 100 || autoScanActive}
                className="py-2.5 px-3 rounded-xl glass-panel border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <span>🤖</span> NEURAL AUTO-SCAN
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  100 CP
                </span>
              </button>

              <button
                type="button"
                onClick={triggerTimeDilation}
                disabled={computePoints < 150 || timeDilationActive}
                className="py-2.5 px-3 rounded-xl glass-panel border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-between cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <span>⏳</span> TIME DILATION
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-400">
                  150 CP
                </span>
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Categorization Classification Controls */}
          <div className="w-full lg:w-72 flex flex-col gap-2">
            <div className="glass-panel rounded-xl p-3 border border-cyan-500/30 flex-1 flex flex-col">
              <div className="text-xs font-orbitron text-cyan-400 tracking-wider mb-2">
                SELECT CLASSIFICATION [KEYS Q-T]
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Select target on stream or click category below to submit AI label.
              </p>

              {/* Category Buttons Stack */}
              <div className="flex-1 flex flex-col gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => classifyTarget('spiral_galaxy')}
                  className="w-full py-3 px-3 rounded-xl bg-slate-900 hover:bg-cyan-950/80 border border-cyan-500/30 hover:border-cyan-400 text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center font-bold text-xs">
                      🌀
                    </span>
                    <div>
                      <div className="font-orbitron text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
                        SPIRAL GALAXY
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Rotating disk, spiral arms & dust
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                    Q
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => classifyTarget('elliptical_galaxy')}
                  className="w-full py-3 px-3 rounded-xl bg-slate-900 hover:bg-amber-950/80 border border-amber-500/30 hover:border-amber-400 text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                      🟡
                    </span>
                    <div>
                      <div className="font-orbitron text-xs font-bold text-amber-300 group-hover:text-amber-200">
                        ELLIPTICAL GALAXY
                      </div>
                      <div className="text-[10px] text-slate-400">Smooth, featureless oval light</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                    W
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => classifyTarget('supernova')}
                  className="w-full py-3 px-3 rounded-xl bg-slate-900 hover:bg-orange-950/80 border border-orange-500/30 hover:border-orange-400 text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center justify-center font-bold text-xs">
                      💥
                    </span>
                    <div>
                      <div className="font-orbitron text-xs font-bold text-orange-300 group-hover:text-orange-200">
                        SUPERNOVA TRANSIENT
                      </div>
                      <div className="text-[10px] text-slate-400">Bright expanding stellar burst</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                    E
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => classifyTarget('black_hole')}
                  className="w-full py-3 px-3 rounded-xl bg-slate-900 hover:bg-purple-950/80 border border-purple-500/30 hover:border-purple-400 text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs">
                      🕳️
                    </span>
                    <div>
                      <div className="font-orbitron text-xs font-bold text-purple-300 group-hover:text-purple-200">
                        BLACK HOLE / AGNs
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Accretion disk & gravitational lensing
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                    R
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => classifyTarget('noise_artifact')}
                  className="w-full py-3 px-3 rounded-xl bg-slate-900 hover:bg-rose-950/80 border border-rose-500/30 hover:border-rose-400 text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center font-bold text-xs">
                      ⚡
                    </span>
                    <div>
                      <div className="font-orbitron text-xs font-bold text-rose-300 group-hover:text-rose-200">
                        SENSOR NOISE / ARTIFACT
                      </div>
                      <div className="text-[10px] text-slate-400">Cosmic rays & CCD sensor glints</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 border border-slate-700 px-1.5 py-0.5 rounded">
                    T
                  </span>
                </button>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 text-center">
                Tip: Match wavelength filter if target is shrouded in dust!
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Modal: AI Tech Shop */}
      {showShop && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 70 }}
        >
          <div className="max-w-2xl w-full glass-panel rounded-2xl p-6 border border-amber-500/40 shadow-glow-xray max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-2xl">⚡</span>
                <h2 className="font-orbitron text-xl font-bold text-amber-300">
                  AI NEURAL UPGRADE SHOP
                </h2>
              </div>
              <button
                onClick={() => setShowShop(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-3 flex items-center justify-between font-orbitron text-sm">
              <span className="text-slate-400">CURRENT COMPUTE BALANCE:</span>
              <span className="text-xl font-extrabold text-amber-300">{computePoints} CP</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-2">
              {/* Upgrade 1 */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-between gap-4">
                <div>
                  <div className="font-orbitron text-sm font-bold text-cyan-300">
                    Convolutional Pattern Enhancer
                  </div>
                  <p className="text-xs text-slate-400">
                    Increases base score points per correct classification by +50%.
                  </p>
                  <div className="text-[10px] text-cyan-400 font-mono mt-1">
                    Level: {upgrades.scoreEnhancer} / 5
                  </div>
                </div>
                <button
                  type="button"
                  onClick={buyUpgrade1}
                  disabled={computePoints < 100 || upgrades.scoreEnhancer >= 5}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-orbitron text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  {upgrades.scoreEnhancer >= 5 ? 'MAX LEVEL' : 'UPGRADE (100 CP)'}
                </button>
              </div>

              {/* Upgrade 2 */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-between gap-4">
                <div>
                  <div className="font-orbitron text-sm font-bold text-orange-300">
                    Quantum Infrared Scanner
                  </div>
                  <p className="text-xs text-slate-400">
                    Automatically reveals target features through dust without needing wavelength switch.
                  </p>
                  <div className="text-[10px] text-orange-400 font-mono mt-1">
                    Level: {upgrades.quantumScanner} / 1
                  </div>
                </div>
                <button
                  type="button"
                  onClick={buyUpgrade2}
                  disabled={computePoints < 250 || upgrades.quantumScanner >= 1}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-orbitron text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  {upgrades.quantumScanner >= 1 ? 'UNLOCKED' : 'UNLOCK (250 CP)'}
                </button>
              </div>

              {/* Upgrade 3 */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-between gap-4">
                <div>
                  <div className="font-orbitron text-sm font-bold text-purple-300">
                    Neural Network Redundancy Buffer
                  </div>
                  <p className="text-xs text-slate-400">
                    Reduces integrity damage penalty from misclassification errors by 20% per level (up to 60%).
                  </p>
                  <div className="text-[10px] text-purple-400 font-mono mt-1">
                    Level: {upgrades.redundancyBuffer} / 3
                  </div>
                </div>
                <button
                  type="button"
                  onClick={buyUpgrade3}
                  disabled={computePoints < 150 || upgrades.redundancyBuffer >= 3}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-orbitron text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  {upgrades.redundancyBuffer >= 3 ? 'MAX LEVEL' : 'UPGRADE (150 CP)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Astro Codex */}
      {showCodex && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 70 }}
        >
          <div className="max-w-3xl w-full glass-panel rounded-2xl p-6 border border-cyan-500/40 shadow-glow-cyan max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 text-2xl">📖</span>
                <h2 className="font-orbitron text-xl font-bold text-cyan-300">
                  ASTRO CODEX // VERA RUBIN SURVEY ENCYCLOPEDIA
                </h2>
              </div>
              <button
                onClick={() => setShowCodex(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-2 text-sm text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20">
                <h3 className="font-orbitron font-bold text-cyan-400 text-base mb-1">
                  🌌 Vera C. Rubin Observatory & LSST
                </h3>
                <p className="text-xs text-slate-400">
                  The Vera C. Rubin Observatory in Chile uses an 8.4-meter Simonyi Survey Telescope equipped with a 3.2-gigapixel camera. Its 10-year Legacy Survey of Space and Time (LSST) scans the southern sky every few nights, uncovering billions of distant galaxies and millions of transient events.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                <div>
                  <div className="font-orbitron font-bold text-cyan-300 text-sm mb-1">
                    🌀 Spiral Galaxies
                  </div>
                  <p className="text-slate-400">
                    Distinct rotating disks containing young stellar clusters and dense gas lanes. Dust clouds can obscure optical observations, making infrared spectral scans essential for accurate mapping.
                  </p>
                </div>

                <div>
                  <div className="font-orbitron font-bold text-amber-300 text-sm mb-1">
                    🟡 Elliptical Galaxies
                  </div>
                  <p className="text-slate-400">
                    Smooth, featureless light distributions comprised primarily of older stellar populations. They contain minimal interstellar dust and show symmetrical light profiles across spectrums.
                  </p>
                </div>

                <div>
                  <div className="font-orbitron font-bold text-orange-300 text-sm mb-1">
                    💥 Supernova Transients
                  </div>
                  <p className="text-slate-400">
                    Cataclysmic explosions marking stellar deaths. In survey images, they appear as sudden point-source flare-ups. X-Ray wavelengths highlight high-energy shockwaves during early expansion phases.
                  </p>
                </div>

                <div>
                  <div className="font-orbitron font-bold text-purple-300 text-sm mb-1">
                    🕳️ Active Galactic Nuclei (AGN) & Supermassive Black Holes
                  </div>
                  <p className="text-slate-400">
                    Extremely energetic galactic cores powered by supermassive black holes consuming surrounding material. Characterized by relativistic jets, gravitational lensing artifacts, and intense X-ray emissions.
                  </p>
                </div>

                <div>
                  <div className="font-orbitron font-bold text-rose-300 text-sm mb-1">
                    ⚡ Sensor Artifacts & Cosmic Rays
                  </div>
                  <p className="text-slate-400">
                    High-energy particles striking the camera CCD or electronics glitches. These non-astronomical events manifest as sharp pixel streaks or isolated hot pixels that must be filtered out by neural models.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gameplay Manual */}
      {showManual && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          style={{ zIndex: 70 }}
        >
          <div className="max-w-3xl w-full glass-panel rounded-2xl p-6 border border-emerald-500/40 shadow-glow-cyan max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-2xl">📖</span>
                <h2 className="font-orbitron text-xl font-bold text-emerald-300">
                  NEURAL TRAINING OPERATIONAL MANUAL
                </h2>
              </div>
              <button
                onClick={() => setShowManual(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 py-4 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong className="text-emerald-400">1. Select Target:</strong> Click on deep space targets as they flow down the survey stream to inspect them in the analyzer.
              </p>
              <p>
                <strong className="text-emerald-400">2. Spectrum Shift:</strong> If a target is obscured by interstellar dust, switch between{' '}
                <span className="text-cyan-300">OPTICAL [Key 1]</span>,{' '}
                <span className="text-orange-400">INFRARED [Key 2]</span>, and{' '}
                <span className="text-purple-400">X-RAY [Key 3]</span> to pierce through dust clouds.
              </p>
              <p>
                <strong className="text-emerald-400">3. Classify:</strong> Match the true cosmic form using key bindings{' '}
                <span className="text-cyan-300">Q (Spiral)</span>,{' '}
                <span className="text-amber-300">W (Elliptical)</span>,{' '}
                <span className="text-orange-300">E (Supernova)</span>,{' '}
                <span className="text-purple-300">R (Black Hole)</span>, or{' '}
                <span className="text-rose-300">T (Sensor Noise)</span>.
              </p>
              <p>
                <strong className="text-emerald-400">4. Compute Points (CP):</strong> Earn CP from correct classifications and streaks to trigger Auto-Scan or Time Dilation abilities, or buy permanent upgrades in the AI Shop.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pause Menu */}
      {showPause && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel rounded-2xl p-6 border border-cyan-500/40 shadow-glow-cyan text-center">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-2xl mx-auto mb-3">
              ⏸️
            </div>
            <h2 className="font-orbitron text-xl font-bold text-cyan-300 mb-1">SURVEY PAUSED</h2>
            <p className="text-xs text-slate-400 mb-6">Simulation suspended. Review info or resume training.</p>

            <div className="space-y-3 font-orbitron text-xs">
              <button
                type="button"
                onClick={resumeGame}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold shadow-glow-cyan transition cursor-pointer"
              >
                ▶️ RESUME SURVEY
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setShowManual(true)}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 flex flex-col items-center gap-1 transition cursor-pointer"
                >
                  <span className="text-base">📖</span>
                  <span className="text-[10px]">MANUAL</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCodex(true)}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 flex flex-col items-center gap-1 transition cursor-pointer"
                >
                  <span className="text-base">📚</span>
                  <span className="text-[10px]">CODEX</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowShop(true)}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/30 text-amber-300 flex flex-col items-center gap-1 transition cursor-pointer"
                >
                  <span className="text-base">⚡</span>
                  <span className="text-[10px]">SHOP</span>
                </button>
              </div>

              <button
                type="button"
                onClick={returnToHome}
                className="w-full py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 font-bold transition cursor-pointer"
              >
                🏠 QUIT TO MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Victory Clearance */}
      {showVictory && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel rounded-2xl p-6 sm:p-8 border border-emerald-500/40 shadow-glow-cyan text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
              🏆
            </div>

            <h2 className="font-orbitron text-2xl font-extrabold text-emerald-400 mb-1">
              SECTOR CLEARED!
            </h2>
            <p className="text-xs text-slate-300 mb-6">
              Target neural classification score reached successfully!
            </p>

            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2 text-left font-orbitron text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-slate-400">FINAL SCORE:</span>
                <span className="text-cyan-300 font-bold text-sm">{score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CLASSIFICATION ACCURACY:</span>
                <span className="text-teal-300 font-bold">{accuracyRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PEAK COMBO STREAK:</span>
                <span className="text-purple-300 font-bold">x{peakCombo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TOTAL COMPUTE EARNED:</span>
                <span className="text-amber-300 font-bold">+{computePoints} CP</span>
              </div>
            </div>

            <button
              type="button"
              onClick={returnToHome}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-orbitron font-extrabold text-sm tracking-wider transition shadow-glow-cyan cursor-pointer"
            >
              RETURN TO MAIN MENU
            </button>
          </div>
        </div>
      )}

      {/* Modal: Game Over */}
      {showGameOver && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel rounded-2xl p-6 sm:p-8 border border-red-500/40 shadow-glow-pink text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/40 text-red-400 flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
              ⚠️
            </div>

            <h2 className="font-orbitron text-2xl font-extrabold text-red-400 mb-1">
              SESSION TERMINATED
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Neural integrity reached critical limit or survey session ended.
            </p>

            <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2 text-left font-orbitron text-xs mb-6">
              <div className="flex justify-between">
                <span className="text-slate-400">FINAL SCORE:</span>
                <span className="text-cyan-300 font-bold text-sm">{score.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CLASSIFICATION ACCURACY:</span>
                <span className="text-teal-300 font-bold">{accuracyRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">PEAK COMBO STREAK:</span>
                <span className="text-purple-300 font-bold">x{peakCombo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">COMPUTE POINTS EARNED:</span>
                <span className="text-amber-300 font-bold">+{computePoints} CP</span>
              </div>
            </div>

            <button
              type="button"
              onClick={startGameSession}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-orbitron font-extrabold text-sm tracking-wider transition shadow-glow-cyan cursor-pointer"
            >
              RESTART NEURAL TRAINING
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
