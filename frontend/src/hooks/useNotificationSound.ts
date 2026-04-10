import { useCallback, useEffect, useRef } from 'react';

/**
 * Proporciona `playSound()` usando Web Audio API.
 *
 * Tres escenarios que maneja:
 *  1. AudioContext suspendido por política de autoplay de Chrome → resume() antes de tocar.
 *  2. Tab en background → Chrome suspende el contexto; se resume al volver al foco.
 *  3. Sin interacción previa → el contexto se crea en estado 'suspended'; resume() lo activa
 *     si el navegador lo permite (chrome lo permite si el usuario interactuó antes).
 */
export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = (): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  // Desbloquea el contexto en el primer gesto del usuario y al recuperar el foco de la tab.
  useEffect(() => {
    const resumeCtx = () => {
      const ctx = getCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };

    document.addEventListener('click', resumeCtx);
    document.addEventListener('keydown', resumeCtx);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') resumeCtx();
    });

    return () => {
      document.removeEventListener('click', resumeCtx);
      document.removeEventListener('keydown', resumeCtx);
    };
  }, []);

  const playSound = useCallback(() => {
    try {
      const ctx = getCtx();

      // Dos "dings" ascendentes cortos — estilo IG DM.
      const playTone = (freq: number, startAt: number, duration: number) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startAt);

        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.09, startAt + 0.008); // ataque rápido
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

        osc.start(startAt);
        osc.stop(startAt + duration);
      };

      const doPlay = () => {
        const t = ctx.currentTime;
        playTone(587, t,        0.22);  // D5 — primer ding
        playTone(880, t + 0.13, 0.28);  // A5 — segundo ding, más agudo
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(doPlay).catch(() => {});
      } else {
        doPlay();
      }
    } catch {
      // Fallo silencioso — el sonido es una mejora opcional.
    }
  }, []);

  return { playSound };
}
