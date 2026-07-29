'use client';

import { useEffect, useRef, useState } from 'react';
import type { ExerciseMedia } from '@/lib/exercises/types';

interface ExerciseLoopProps {
  media: ExerciseMedia;
  /** Nom de l'exercice — sert de texte alternatif. */
  label: string;
  /** Durée d'affichage de la pose de départ (ms). */
  holdStart?: number;
  /** Durée d'affichage de la pose de contraction (ms). Plus longue : c'est
   *  l'instant que l'œil doit retenir. */
  holdEnd?: number;
  className?: string;
}

/**
 * Deux poses en fondu croisé = un mouvement lisible.
 *
 * Le fondu fait tout le travail : en coupe franche, deux dessins clignotent ;
 * en fondu, le cerveau interpole la trajectoire. C'est le même principe que les
 * GIFs payants, avec deux images au lieu de trente.
 */
export function ExerciseLoop({
  media,
  label,
  holdStart = 900,
  holdEnd = 1200,
  className = '',
}: ExerciseLoopProps) {
  const [frame, setFrame] = useState(0);
  const [animated, setAnimated] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const frames = media.frames;
  const isVector = frames[0]?.endsWith('.svg');

  // Une personne qui a désactivé les animations système ne doit pas subir
  // une boucle infinie dans son champ de vision.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setAnimated(!mq.matches);
      // Sans animation, on fige sur la contraction : c'est la pose qui informe.
      if (mq.matches) setFrame(frames.length - 1);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [frames.length]);

  useEffect(() => {
    if (!animated || frames.length < 2) return;

    const tick = () => {
      setFrame((f) => {
        const next = (f + 1) % frames.length;
        timer.current = setTimeout(tick, next === 0 ? holdStart : holdEnd);
        return next;
      });
    };

    timer.current = setTimeout(tick, holdStart);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [animated, frames.length, holdStart, holdEnd]);

  return (
    <div
      className={`relative aspect-square overflow-hidden ${className}`}
      role="img"
      aria-label={`Démonstration : ${label}`}
    >
      {frames.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={[
            'absolute inset-0 h-full w-full object-contain',
            'transition-opacity duration-500 ease-in-out motion-reduce:transition-none',
            // Les SVG héritent de la couleur du texte : une classe suffit à les
            // passer aux couleurs rouxperf. Les rasters, eux, restent tels quels.
            isVector ? 'text-current' : '',
          ].join(' ')}
          style={{ opacity: i === frame ? 1 : 0 }}
        />
      ))}

      {/* Deux poses sans animation : on montre la contraction, plus parlante
          qu'une position de départ neutre. */}
      {!animated && frames.length > 1 && (
        <span className="sr-only">Animation désactivée — pose finale affichée.</span>
      )}
    </div>
  );
}
