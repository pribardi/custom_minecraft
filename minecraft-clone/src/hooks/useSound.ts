import { useState, useCallback, useEffect } from 'react';

export type SoundType = 
  | 'blockPlace' 
  | 'blockBreak'
  | 'click'
  | 'hover'
  | 'hurt'
  | 'backgroundMusic'

const SOUND_FILES: Record<SoundType, string> = {
  blockPlace: '/sounds/dig/grass1.ogg',
  blockBreak: '/sounds/dig/grass1.ogg',
  click: '/sounds/click.ogg',
  hover: '/sounds/hover.ogg',
  hurt: '/sounds/player/hurt.ogg',
  backgroundMusic: '/sounds/menu_music.ogg'
};

export const useSound = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [sounds, setSounds] = useState<Record<SoundType, HTMLAudioElement>>();

  // Initialize sounds
  useEffect(() => {
    const loadedSounds: Record<SoundType, HTMLAudioElement> = {
      blockPlace: new Audio(SOUND_FILES.blockPlace),
      blockBreak: new Audio(SOUND_FILES.blockBreak),
      click: new Audio(SOUND_FILES.click),
      hover: new Audio(SOUND_FILES.hover),
      hurt: new Audio(SOUND_FILES.hurt),
      backgroundMusic: new Audio(SOUND_FILES.backgroundMusic)
    };

    // Configure background music
    loadedSounds.backgroundMusic.loop = true;
    loadedSounds.backgroundMusic.volume = 0.3;

    setSounds(loadedSounds);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (sounds) {
      if (!isMuted) {
        sounds.backgroundMusic.pause();
      } else {
        sounds.backgroundMusic.play().catch(console.error);
      }
    }
  }, [isMuted, sounds]);

  const playSound = useCallback((type: SoundType) => {
    if (!isMuted && sounds && sounds[type]) {
      // Clone the audio to allow multiple simultaneous plays
      const sound = sounds[type].cloneNode() as HTMLAudioElement;
      sound.volume = type === 'backgroundMusic' ? 0.3 : 0.5;
      sound.play().catch(console.error);
    }
  }, [isMuted, sounds]);

  const startBackgroundMusic = useCallback(() => {
    if (!isMuted && sounds) {
      sounds.backgroundMusic.play().catch(console.error);
    }
  }, [isMuted, sounds]);

  const stopBackgroundMusic = useCallback(() => {
    if (sounds) {
      sounds.backgroundMusic.pause();
      sounds.backgroundMusic.currentTime = 0;
    }
  }, [sounds]);

  return {
    isMuted,
    toggleMute,
    playSound,
    startBackgroundMusic,
    stopBackgroundMusic
  };
}; 