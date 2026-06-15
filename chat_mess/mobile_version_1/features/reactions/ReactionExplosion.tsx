/**
 * ReactionExplosion Component
 * Burst of multiple floating emojis when a reaction is added
 */

import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { AnimatedReaction } from './AnimatedReaction';

interface Particle {
  id: string;
  emoji: string;
  startPosition: { x: number; y: number };
}

interface ReactionExplosionProps {
  children: React.ReactNode;
}

interface ExplosionConfig {
  emoji: string;
  position: { x: number; y: number };
  count?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ReactionExplosion: React.FC<ReactionExplosionProps> = ({ children }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const idCounter = useRef(0);

  const triggerExplosion = useCallback(({ emoji, position, count = 5 }: ExplosionConfig) => {
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 40;

      newParticles.push({
        id: `particle_${idCounter.current++}`,
        emoji,
        startPosition: {
          x: position.x + offsetX,
          y: position.y + offsetY,
        },
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
  }, []);

  const removeParticle = useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <View style={styles.container}>
      {children}

      {/* Particle container */}
      <View style={styles.particleContainer} pointerEvents="none">
        {particles.map((particle) => (
          <AnimatedReaction
            key={particle.id}
            emoji={particle.emoji}
            startPosition={particle.startPosition}
            onComplete={() => removeParticle(particle.id)}
            size={28 + Math.random() * 8}
            duration={1500 + Math.random() * 500}
          />
        ))}
      </View>
    </View>
  );
};

// Hook for using reaction explosion
export const useReactionExplosion = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const idCounter = useRef(0);

  const triggerExplosion = useCallback(({ emoji, position, count = 5 }: ExplosionConfig) => {
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 60;
      const offsetY = (Math.random() - 0.5) * 40;

      newParticles.push({
        id: `particle_${idCounter.current++}`,
        emoji,
        startPosition: {
          x: position.x + offsetX,
          y: position.y + offsetY,
        },
      });
    }

    setParticles((prev) => [...prev, ...newParticles]);
  }, []);

  const removeParticle = useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const ExplosionContainer = useCallback(() => (
    <View style={styles.particleContainer} pointerEvents="none">
      {particles.map((particle) => (
        <AnimatedReaction
          key={particle.id}
          emoji={particle.emoji}
          startPosition={particle.startPosition}
          onComplete={() => removeParticle(particle.id)}
          size={28 + Math.random() * 8}
          duration={1500 + Math.random() * 500}
        />
      ))}
    </View>
  ), [particles, removeParticle]);

  return {
    triggerExplosion,
    ExplosionContainer,
    activeParticles: particles.length,
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    overflow: 'visible',
  },
});

export default ReactionExplosion;
