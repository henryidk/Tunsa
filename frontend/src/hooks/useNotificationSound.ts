import { useCallback, useEffect, useRef } from 'react';

/**
 * Proporciona `playSound()` usando Web Audio API.
 *
 * Problema de fondo: Chrome suspende el AudioContext tras inactividad y exige
 * un gesto del usuario para reactivarlo. Si `playSound()` se llama mientras el
 * contexto está suspendido, el sonido quedaría en cola hasta el próximo gesto.
 *
 * Solución: `pendingSoundRef` — si el contexto no puede reproducir de inmediato,
 * se marca el intento. En el siguiente gesto del usuario (click / keydown /
 * visibilitychange) el contexto se activa y el sonido pendiente se ejecuta.
 */
export function useNotificationSound() {
  const ctxRef          = useRef<AudioContext | null>(null);
  const pendingSoundRef = useRef(false);

  const getCtx = (): AudioContext => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  };

  const doPlay = useCallback((ctx: AudioContext) => {
    pendingSoundRef.current = false;

    const playTone = (freq: number, startAt: number, duration: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.09, startAt + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.start(startAt);
      osc.stop(startAt + duration);
    };

    const t = ctx.currentTime;
    playTone(587, t,        0.22);
    playTone(880, t + 0.13, 0.28);
  }, []);

  // Reactiva el contexto ante cualquier gesto del usuario.
  // Si hay un sonido pendiente (llegó mientras estaba suspendido), lo reproduce.
  useEffect(() => {
    const resumeAndFlush = () => {
      const ctx = getCtx();
      if (ctx.state === 'suspended') {
        ctx.resume()
          .then(() => {
            if (pendingSoundRef.current) doPlay(ctx);
          })
          .catch(() => {});
      } else if (ctx.state === 'running' && pendingSoundRef.current) {
        doPlay(ctx);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resumeAndFlush();
    };

    document.addEventListener('mousedown',        resumeAndFlush);
    document.addEventListener('keydown',          resumeAndFlush);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('mousedown',        resumeAndFlush);
      document.removeEventListener('keydown',          resumeAndFlush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [doPlay]);

  const playSound = useCallback(() => {
    try {
      const ctx = getCtx();

      if (ctx.state === 'running') {
        doPlay(ctx);
      } else {
        // Contexto suspendido: marcar intento y tratar de reactivar.
        // Si resume() no puede completarse sin gesto, doPlay se ejecutará
        // en el próximo resumeAndFlush (mousedown / keydown / visibility).
        pendingSoundRef.current = true;
        ctx.resume()
          .then(() => {
            if (pendingSoundRef.current) doPlay(ctx);
          })
          .catch(() => {});
      }
    } catch {
      // Fallo silencioso — el sonido es mejora opcional.
    }
  }, [doPlay]);

  return { playSound };
}
