/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Trophy, 
  Play, 
  Sparkles, 
  Info,
  Activity,
  Zap,
  Smartphone
} from 'lucide-react';

// --- SOUND SYNTHESIZER ---
class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  // C major pentatonic scale for harmonic, therapeutic feedback
  private scale = [
    130.81, // C3
    146.83, // D3
    164.81, // E3
    196.00, // G3
    220.00, // A3
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50, // C6
    1174.66, // D6
    1318.51, // E6
    1567.98, // G6
    1760.00  // A6
  ];

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playPop(index: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    // Scale index wraps around but pitches can also slowly ascend
    const scaleIndex = index % this.scale.length;
    const freq = this.scale[scaleIndex];

    // Main pure oscillator (sine) for the core tone
    const oscSine = this.ctx.createOscillator();
    // Soft secondary oscillator (triangle) for organic texture
    const oscTri = this.ctx.createOscillator();
    
    const gainNode = this.ctx.createGain();
    const filterNode = this.ctx.createBiquadFilter();

    oscSine.type = 'sine';
    oscSine.frequency.setValueAtTime(freq, now);

    oscTri.type = 'triangle';
    oscTri.frequency.setValueAtTime(freq, now);

    // Warm, calming lowpass filter sweep
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(2000, now);
    filterNode.frequency.exponentialRampToValueAtTime(350, now + 0.25);

    // Quick attack, smooth logarithmic decay envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    oscSine.connect(filterNode);
    oscTri.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    oscSine.start(now);
    oscTri.start(now);
    oscSine.stop(now + 0.65);
    oscTri.stop(now + 0.65);
  }

  playTrigger() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    // Ambient, swelling low-frequency note for initiating the chain
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(98.0, now); // G2
    osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.5); // G2 -> D3

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  }

  playCompletion(hasHighPop: boolean) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Harmonic, ambient chords (C major 9 or similar peaceful sounds)
    const notes = hasHighPop ? [261.63, 329.63, 392.00, 493.88, 523.25] : [196.00, 246.94, 293.66, 392.00];
    
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.06, now + i * 0.06 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.7);
    });
  }
}

// --- GAME TYPES ---
interface Bubble {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseColor: string;
  glowColor: string;
  state: 'floating' | 'expanding' | 'expanded' | 'shrinking' | 'dead';
  ringRadius: number;
  ringMaxRadius: number;
  timer: number;
  opacity: number;
  popIndex?: number;
  trail?: { x: number; y: number }[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
  decay: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  opacity: number;
  vy: number;
  timer: number;
}

interface TriggerRing {
  x: number;
  y: number;
  ringRadius: number;
  ringMaxRadius: number;
  state: 'expanding' | 'expanded' | 'shrinking' | 'dead';
  timer: number;
  opacity: number;
}

// Neon color assets
const NEON_COLORS = [
  { base: '#00f0ff', glow: 'rgba(0, 240, 255, 0.4)' }, // Cyan
  { base: '#ff00a0', glow: 'rgba(255, 0, 160, 0.4)' }, // Magenta
  { base: '#fffb00', glow: 'rgba(255, 251, 0, 0.4)' }, // Yellow
  { base: '#00ff66', glow: 'rgba(0, 255, 102, 0.4)' }  // Green
];

const TOTAL_BUBBLES_COUNT = 38;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game state representation in React for UI controls and triggers
  const [gameState, setGameState] = useState<'waiting_for_tap' | 'reaction_active' | 'round_ended'>('waiting_for_tap');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem('chain_reactor_highscore') || '0');
  });
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [isHapticEnabled, setIsHapticEnabled] = useState<boolean>(true);
  const [showHapticTip, setShowHapticTip] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  // Haptic feedback ref to prevent stale closures inside animation loop
  const isHapticEnabledRef = useRef<boolean>(isHapticEnabled);
  useEffect(() => {
    isHapticEnabledRef.current = isHapticEnabled;
  }, [isHapticEnabled]);

  // Sound Synth reference
  const soundEngineRef = useRef<SoundEngine | null>(null);
  if (!soundEngineRef.current) {
    soundEngineRef.current = new SoundEngine();
  }

  // Sync sound setting to engine
  useEffect(() => {
    if (soundEngineRef.current) {
      soundEngineRef.current.enabled = isSoundEnabled;
    }
  }, [isSoundEnabled]);

  // Dimensions of canvas container
  const widthRef = useRef<number>(window.innerWidth);
  const heightRef = useRef<number>(window.innerHeight);

  // Core game objects stored in refs to run flawlessly at 60fps
  const bubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const triggerRingRef = useRef<TriggerRing | null>(null);
  const currentPopCountRef = useRef<number>(0);

  // Initialize bubbles on load or reset
  const initGameObjects = () => {
    const width = widthRef.current || window.innerWidth;
    const height = heightRef.current || window.innerHeight;
    const bubbles: Bubble[] = [];

    for (let i = 0; i < TOTAL_BUBBLES_COUNT; i++) {
      const radius = 9 + Math.random() * 3; // small elegant bubbles
      // Spawn at a safe margin from boundaries
      const x = radius + 20 + Math.random() * (width - radius * 2 - 40);
      const y = radius + 20 + Math.random() * (height - radius * 2 - 40);

      // Gentle, screensaver float speed
      const speed = 0.4 + Math.random() * 0.6;
      const angle = Math.random() * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const colorScheme = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];

      bubbles.push({
        id: i,
        x,
        y,
        vx,
        vy,
        radius,
        baseColor: colorScheme.base,
        glowColor: colorScheme.glow,
        state: 'floating',
        ringRadius: 0,
        ringMaxRadius: 55, // maximum beautiful spread radius for domino chains
        timer: 0,
        opacity: 1.0,
        trail: []
      });
    }

    bubblesRef.current = bubbles;
    particlesRef.current = [];
    floatingTextsRef.current = [];
    triggerRingRef.current = null;
    currentPopCountRef.current = 0;
    setScore(0);
  };

  // Run initializer on mount
  useEffect(() => {
    initGameObjects();
  }, []);

  // Update canvas sizing and High DPI scaling on screen resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();

      widthRef.current = rect.width;
      heightRef.current = rect.height;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle single touch/click trigger
  const handleScreenInteraction = (clientX: number, clientY: number, target: HTMLElement) => {
    // Avoid triggering if clicked on UI buttons or overlays
    if (target.closest('.hud-interactive')) {
      return;
    }

    if (gameState !== 'waiting_for_tap') {
      return;
    }

    // Get position relative to canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Start sound context (requires interaction)
    if (soundEngineRef.current) {
      soundEngineRef.current.init();
      soundEngineRef.current.playTrigger();
    }

    // Spawn player expanding ring
    triggerRingRef.current = {
      x,
      y,
      ringRadius: 0,
      ringMaxRadius: 75, // Player's ring is slightly larger to maximize strategy
      state: 'expanding',
      timer: 0,
      opacity: 1.0
    };

    setGameState('reaction_active');
    setShowInstructions(false);
  };

  // Trigger bubble pop
  const popBubble = (bubble: Bubble) => {
    bubble.state = 'expanding';
    bubble.vx = 0;
    bubble.vy = 0;
    bubble.timer = 0;
    bubble.opacity = 1.0;
    
    // Increment reaction count
    currentPopCountRef.current += 1;
    const popIdx = currentPopCountRef.current;
    bubble.popIndex = popIdx;

    // Push state update to React (decoupled from loop, fully efficient)
    setScore(popIdx);

    // Play therapeutic synth chime rising in pitch
    if (soundEngineRef.current) {
      soundEngineRef.current.playPop(popIdx);
    }

    // Satisfying scaled Haptic Feedback based on the size of the reaction
    if (isHapticEnabledRef.current && typeof navigator !== 'undefined' && navigator.vibrate) {
      if (popIdx >= 35) {
        // Absolute maximum crescendo, double long rumble
        navigator.vibrate([45, 50, 45]);
      } else if (popIdx >= 25) {
        // Large crescendo, double heavy tactile pulse
        navigator.vibrate([35, 40, 20]);
      } else if (popIdx >= 15) {
        // Medium high, dual light pulse
        navigator.vibrate([18, 25, 12]);
      } else if (popIdx >= 8) {
        // Solid medium pop
        navigator.vibrate(22);
      } else if (popIdx >= 3) {
        // Light tactile feedback
        navigator.vibrate(12);
      } else {
        // Super quick crisp tap/click
        navigator.vibrate(6);
      }
    }

    // Add glowing floating text at pop center
    floatingTextsRef.current.push({
      x: bubble.x,
      y: bubble.y - 12,
      text: `+${popIdx}`,
      color: bubble.baseColor,
      opacity: 1.0,
      vy: -0.6,
      timer: 0
    });

    // Spawn rich particle sparks
    // As pop index increases, explosions grow larger and more vibrant!
    const baseParticleCount = 12;
    const levelJuiceFactor = Math.min(2.2, 1 + popIdx * 0.05);
    const particleCount = Math.floor(baseParticleCount * levelJuiceFactor);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.8 + Math.random() * 2.8) * levelJuiceFactor;
      
      particlesRef.current.push({
        x: bubble.x,
        y: bubble.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: (0.8 + Math.random() * 1.8) * levelJuiceFactor,
        color: bubble.baseColor,
        opacity: 1.0,
        decay: 0.015 + Math.random() * 0.015
      });
    }
  };

  // The central high-performance physics & drawing loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const width = widthRef.current;
      const height = heightRef.current;

      // 1. Draw Background Grid and Cosmic Stars
      ctx.fillStyle = '#080808'; // solid black/zinc-950/Elegant Dark bg
      ctx.fillRect(0, 0, width, height);

      // Draw elegant background mesh grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.012)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Update and Draw Particles (Popped Sparks)
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        
        // Gentle air friction deceleration and soft gravity fall
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.vy += 0.03; // microgravity

        p.opacity -= p.decay;

        if (p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // Render double-layer glowing particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // 3. Update & Draw Player's Single Trigger Ring
      const tr = triggerRingRef.current;
      if (tr && tr.state !== 'dead') {
        tr.timer += 1;

        if (tr.state === 'expanding') {
          tr.ringRadius += 2.8; // expanding velocity
          if (tr.ringRadius >= tr.ringMaxRadius) {
            tr.ringRadius = tr.ringMaxRadius;
            tr.state = 'expanded';
            tr.timer = 0;
          }
        } else if (tr.state === 'expanded') {
          // Pause for 90 frames (~1.5s)
          if (tr.timer >= 90) {
            tr.state = 'shrinking';
          }
        } else if (tr.state === 'shrinking') {
          tr.opacity -= 0.015; // Smooth fade away
          if (tr.opacity <= 0) {
            tr.opacity = 0;
            tr.state = 'dead';
          }
        }

        // Draw Player Ring entirely out of beautiful sparkling particles
        if (tr.opacity > 0) {
          ctx.save();
          
          // Gentle center soft radial fill
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, tr.ringRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = tr.opacity * 0.03;
          ctx.fill();

          // Sparkle particle boundary
          const numParticlesInRing = 32;
          for (let pIdx = 0; pIdx < numParticlesInRing; pIdx++) {
            const angle = (pIdx / numParticlesInRing) * Math.PI * 2;
            const shimmerRadius = tr.ringRadius + (Math.sin(angle * 10 + tr.timer * 0.2) * 1.8);
            const px = tr.x + Math.cos(angle) * shimmerRadius;
            const py = tr.y + Math.sin(angle) * shimmerRadius;
            
            ctx.beginPath();
            ctx.arc(px, py, 1.4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = tr.opacity * (0.6 + Math.sin(angle * 16 + tr.timer * 0.1) * 0.4);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // 4. Update and Draw Bubbles (The Screensaver + Reaction State Machine)
      const bubbles = bubblesRef.current;
      let activeReactionRingsCount = 0;

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];

        if (b.state === 'floating') {
          // Normal bouncing physical movement
          b.x += b.vx;
          b.y += b.vy;

          // Wall bounce logic (screensaver style)
          if (b.x - b.radius < 0) {
            b.x = b.radius;
            b.vx = -b.vx;
          } else if (b.x + b.radius > width) {
            b.x = width - b.radius;
            b.vx = -b.vx;
          }

          if (b.y - b.radius < 0) {
            b.y = b.radius;
            b.vy = -b.vy;
          } else if (b.y + b.radius > height) {
            b.y = height - b.radius;
            b.vy = -b.vy;
          }

          // Update trail history
          if (!b.trail) b.trail = [];
          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > 12) {
            b.trail.shift();
          }

          // Draw subtle movement trail
          if (b.trail && b.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(b.trail[0].x, b.trail[0].y);
            for (let t = 1; t < b.trail.length; t++) {
              ctx.lineTo(b.trail[t].x, b.trail[t].y);
            }
            ctx.strokeStyle = b.baseColor;
            ctx.lineWidth = 1.0;
            ctx.globalAlpha = 0.12;
            ctx.stroke();
            ctx.restore();
          }

          // Render Floating Bubbles with clean semi-transparent pastel aesthetic
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fillStyle = b.baseColor;
          ctx.globalAlpha = 0.35;
          ctx.fill();

          // Delicate outer highlight stroke
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.strokeStyle = b.baseColor;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.95;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
        } 
        else if (b.state !== 'dead') {
          // Bubble is in a popped expansion ring state
          activeReactionRingsCount += 1;
          b.timer += 1;

          if (b.state === 'expanding') {
            b.ringRadius += 2.2;
            if (b.ringRadius >= b.ringMaxRadius) {
              b.ringRadius = b.ringMaxRadius;
              b.state = 'expanded';
              b.timer = 0;
            }
          } else if (b.state === 'expanded') {
            // Stay fully expanded for 75 frames (1.25s)
            if (b.timer >= 75) {
              b.state = 'shrinking';
            }
          } else if (b.state === 'shrinking') {
            b.opacity -= 0.02; // Fades out
            if (b.opacity <= 0) {
              b.opacity = 0;
              b.state = 'dead';
            }
          }

          // Draw the Reaction Ring as an elegant ring of glowing, shimmering particles
          if (b.opacity > 0) {
            ctx.save();

            // Gentle center soft radial fill (provides visual depth)
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.ringRadius, 0, Math.PI * 2);
            ctx.fillStyle = b.glowColor;
            ctx.globalAlpha = b.opacity * 0.04;
            ctx.fill();

            // Render 24 shimmering boundary particles on the perimeter of the reaction ring
            const numParticlesInRing = 24;
            for (let pIdx = 0; pIdx < numParticlesInRing; pIdx++) {
              const angle = (pIdx / numParticlesInRing) * Math.PI * 2;
              
              // Shimmer factor adds slight organic movement to the ring particles
              const shimmerRadius = b.ringRadius + (Math.sin(angle * 8 + b.timer * 0.15) * 1.5);
              const px = b.x + Math.cos(angle) * shimmerRadius;
              const py = b.y + Math.sin(angle) * shimmerRadius;

              // Outer glow particle
              ctx.beginPath();
              ctx.arc(px, py, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = b.glowColor;
              ctx.globalAlpha = b.opacity * (0.35 + Math.sin(angle * 12 + b.timer * 0.1) * 0.15);
              ctx.fill();

              // Sharp inner core particle
              ctx.beginPath();
              ctx.arc(px, py, 1.0, 0, Math.PI * 2);
              ctx.fillStyle = b.baseColor;
              ctx.globalAlpha = b.opacity * (0.8 + Math.sin(angle * 12 + b.timer * 0.1) * 0.2);
              ctx.fill();
            }

            ctx.restore();
          }
        }
      }

      // 5. Collision Check (Floating bubbles entering any active trigger or reaction rings)
      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (b.state !== 'floating') continue;

        // Check collision against Player's trigger ring
        if (tr && tr.state !== 'dead') {
          const dx = b.x - tr.x;
          const dy = b.y - tr.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Collision triggers if bubble overlaps with outer boundary of the ring
          if (dist <= b.radius + tr.ringRadius) {
            popBubble(b);
            continue;
          }
        }

        // Check collision against other popped bubble rings
        for (let j = 0; j < bubbles.length; j++) {
          const targetRing = bubbles[j];
          if (targetRing.state === 'floating' || targetRing.state === 'dead') continue;
          if (i === j) continue; // skip checking self

          const dx = b.x - targetRing.x;
          const dy = b.y - targetRing.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= b.radius + targetRing.ringRadius) {
            popBubble(b);
            break; // No need to check multiple rings for this single bubble in one frame
          }
        }
      }

      // 6. Update and Draw Floating Multiplier Numbers
      const floatingTexts = floatingTextsRef.current;
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy;
        ft.timer += 1;
        ft.opacity = Math.max(0, 1 - ft.timer / 55);

        if (ft.timer >= 55) {
          floatingTexts.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = ft.opacity;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 15px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        // Add a clean shadow for text legibility
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      // 7. Check Round Termination
      // If we are active, and no rings are left, and the player trigger has finished, the round ends.
      if (
        gameState === 'reaction_active' && 
        activeReactionRingsCount === 0 && 
        (!tr || tr.state === 'dead')
      ) {
        const finalScore = currentPopCountRef.current;
        setGameState('round_ended');
        
        // Save and handle new High Score
        if (finalScore > highScore) {
          setHighScore(finalScore);
          localStorage.setItem('chain_reactor_highscore', String(finalScore));
        }

        // Play relaxing harmonic ending chords
        if (soundEngineRef.current) {
          soundEngineRef.current.playCompletion(finalScore >= 15);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, highScore]);

  // Restart round
  const resetGame = () => {
    initGameObjects();
    setGameState('waiting_for_tap');
  };

  // Score satisfaction phrases based on percent cleared
  const getSatisfactionPhrase = () => {
    const percentage = Math.round((score / TOTAL_BUBBLES_COUNT) * 100);
    if (percentage === 0) return { phrase: "Zero Resonance 🍃", rating: "Ready for another attempt." };
    if (percentage < 20) return { phrase: "A Gentle Ripple 🌊", rating: "A calm, minimal resonance wave." };
    if (percentage < 50) return { phrase: "Cascading Reaction! 🔥", rating: "A beautifully progressive resonance." };
    if (percentage < 80) return { phrase: "Brilliant Resonance! ⚡", rating: "Extremely high cosmic alignment." };
    if (percentage < 100) return { phrase: "Sublime Masterpiece! 🌟", rating: "A near-perfect cascade of light and frequency." };
    return { phrase: "Total Singularity! 🏆", rating: "A perfect 100% cascade. Mindful harmony achieved." };
  };

  const satisfaction = getSatisfactionPhrase();

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-[#080808] font-sans select-none touch-none text-white flex flex-col"
      onTouchStart={(e) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }}
    >
      {/* 1. Fully-responsive game canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 block w-full h-full z-0 cursor-crosshair"
        onPointerDown={(e) => handleScreenInteraction(e.clientX, e.clientY, e.target as HTMLElement)}
      />

      {/* 2. Sleek HUD matching the Elegant Dark theme perfectly */}
      <header className="hud-interactive relative z-10 p-6 md:p-8 flex justify-between items-start pointer-events-none select-none">
        {/* Left Side: Energy Output */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold mb-1">Energy Output</span>
          <span className="text-6xl md:text-7xl font-extralight tracking-tighter tabular-nums text-white">
            {score.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Right Side: System Status & Controls */}
        <div className="text-right flex flex-col items-end pointer-events-auto">
          <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold mb-2">System Status</span>
          
          <div className="flex items-center gap-4">
            {/* Audio Toggle Controller */}
            <button
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className="p-1.5 bg-transparent border border-zinc-800/80 hover:border-zinc-500 rounded-full text-zinc-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
              title={isSoundEnabled ? "Mute sounds" : "Unmute sounds"}
            >
              {isSoundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </button>

            {/* Haptic Toggle Controller */}
            <button
              onClick={() => {
                const nextState = !isHapticEnabled;
                setIsHapticEnabled(nextState);
                if (nextState) {
                  setShowHapticTip(true);
                  setTimeout(() => setShowHapticTip(false), 5500);
                }
              }}
              className="p-1.5 bg-transparent border border-zinc-800/80 hover:border-zinc-500 rounded-full text-zinc-400 hover:text-white transition-all flex items-center justify-center cursor-pointer"
              title={isHapticEnabled ? "Disable vibrations" : "Enable vibrations"}
            >
              <Smartphone className={`w-3.5 h-3.5 ${isHapticEnabled ? 'text-cyan-400 animate-pulse' : 'text-zinc-500'}`} />
            </button>

            {/* Glowing Status Dot */}
            <div className="flex items-center gap-2 bg-zinc-900/40 border border-zinc-800/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className={`w-2 h-2 rounded-full transition-all duration-300 ${
                gameState === 'waiting_for_tap' 
                  ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' 
                  : gameState === 'reaction_active'
                  ? 'bg-magenta-500 animate-pulse shadow-[0_0_8px_rgba(217,70,239,0.8)]'
                  : 'bg-yellow-500 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`} />
              <span className="text-[10px] font-semibold tracking-widest text-zinc-300 uppercase">
                {gameState === 'waiting_for_tap' ? 'Ready' : gameState === 'reaction_active' ? 'Active' : 'Stable'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 3. Initial/Instructions Overlay (Elegant Dark "INITIATE" Menu) */}
      <AnimatePresence>
        {showInstructions && gameState === 'waiting_for_tap' && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="hud-interactive absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-md"
          >
            <div className="text-center max-w-sm px-6">
              <div className="w-16 h-[1px] bg-zinc-700 mx-auto mb-6"></div>
              <h1 className="text-3xl font-light tracking-[0.3em] uppercase mb-2 text-white font-display">
                Chain Reactor
              </h1>
              <p className="text-zinc-500 text-xs tracking-widest uppercase mb-10 leading-relaxed font-sans">
                Single point of failure creates universal harmony.
              </p>
              
              <button 
                onClick={() => {
                  if (soundEngineRef.current) soundEngineRef.current.init();
                  setShowInstructions(false);
                }}
                className="group relative px-12 py-4 bg-transparent border border-zinc-800 rounded-full overflow-hidden transition-all hover:border-zinc-400 cursor-pointer"
              >
                <span className="relative z-10 text-xs tracking-[0.5em] font-light text-zinc-400 group-hover:text-white transition-colors uppercase font-display">
                  INITIATE
                </span>
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Round Ended Scorecard Overlay (Elegant Dark "REBOOT SYSTEM") */}
      <AnimatePresence>
        {gameState === 'round_ended' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="hud-interactive absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md select-none"
          >
            <div className="text-center max-w-md px-6 flex flex-col items-center">
              <div className="w-16 h-[1px] bg-zinc-700 mx-auto mb-6"></div>
              
              <span className="text-[9px] tracking-[0.4em] font-mono text-zinc-500 uppercase mb-2">RESONANCE RESULT</span>
              <h2 className="font-display text-2xl md:text-3xl font-light tracking-[0.15em] uppercase mb-2 text-white">
                {satisfaction.phrase}
              </h2>
              <p className="text-zinc-400 text-xs tracking-widest uppercase mb-6 max-w-[85%] leading-relaxed font-sans">
                {satisfaction.rating}
              </p>

              {/* Progress and Stats Visualizer Grid */}
              <div className="grid grid-cols-2 gap-6 w-full max-w-xs mb-10 border-t border-b border-zinc-800/80 py-4">
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Pops Cleared</span>
                  <div className="flex items-baseline mt-1 gap-0.5">
                    <span className="text-2xl font-light tracking-tighter text-cyan-400">
                      {score}
                    </span>
                    <span className="text-zinc-600 font-sans text-[10px]">
                      /{TOTAL_BUBBLES_COUNT}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center border-l border-zinc-800/80">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">High Record</span>
                  <div className="flex items-center mt-1 text-yellow-400/90 gap-1">
                    <span className="text-2xl font-light tracking-tighter">
                      {highScore}
                    </span>
                  </div>
                </div>
              </div>

              {/* New Record Banner if applicable */}
              {score >= highScore && score > 0 && (
                <div className="mb-6 animate-bounce">
                  <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full uppercase tracking-widest font-mono">
                    New High Resonance Achieved
                  </span>
                </div>
              )}

              {/* Reboot Action Button */}
              <button 
                onClick={resetGame}
                className="group relative px-12 py-4 bg-transparent border border-zinc-800 rounded-full overflow-hidden transition-all hover:border-zinc-400 cursor-pointer"
              >
                <span className="relative z-10 text-xs tracking-[0.5em] font-light text-zinc-400 group-hover:text-white transition-colors uppercase font-display">
                  REBOOT SYSTEM
                </span>
                <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Subtle strategic hint bar at the bottom */}
      {!showInstructions && gameState === 'waiting_for_tap' && (
        <div className="absolute bottom-6 left-0 right-0 text-center font-mono text-[9px] tracking-[0.4em] text-zinc-600 select-none pointer-events-none uppercase">
          CHAIN REACTOR &bull; TOUCH ONCE TO START
        </div>
      )}

      {/* 6. Haptic Explanation Toast (Dismisses automatically) */}
      <AnimatePresence>
        {showHapticTip && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="hud-interactive absolute bottom-20 left-1/2 -translate-x-1/2 z-30 px-5 py-3 rounded-full bg-zinc-900/95 border border-zinc-800/80 backdrop-blur-md shadow-2xl max-w-[90%] w-max text-center pointer-events-none flex items-center gap-2"
          >
            <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-[10px] text-zinc-300 font-mono tracking-wider uppercase">
              Tip: Open the Shared App link on your physical phone to feel haptics!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
