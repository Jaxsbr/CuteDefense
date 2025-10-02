/**
 * SimpleAudioManager - Basic audio system using HTML5 Audio elements
 * Handles sound effects and background music with simple, reliable playback
 */
class SimpleAudioManager {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.muted = false;
        this.audioPath = 'assets/audio/';
        this.audioUnlocked = false;
        this.logger = null; // Logger reference

        // Initialize audio system
        this.initializeAudio();
    }

    /**
     * Initialize the audio system and load all sound effects
     */
    initializeAudio() {
        // Load all sound effects
        this.loadSound('tower_place', 'sounds/tower_place.ogg');
        this.loadSound('tower_upgrade', 'sounds/tower_upgrade.ogg');
        this.loadSound('tower_upgrade_level2', 'sounds/tower_upgrade_level2.ogg');
        this.loadSound('tower_upgrade_level3', 'sounds/tower_upgrade_level3.ogg');
        this.loadSound('coin_collect', 'sounds/coin_collect.ogg');
        this.loadSound('coin_expire', 'sounds/coin_expire.ogg');
        this.loadSound('projectile_fire', 'sounds/projectile_fire.ogg');
        this.loadSound('enemy_hit', 'sounds/enemy_hit.ogg');
        this.loadSound('enemy_death', 'sounds/enemy_death.ogg');
        this.loadSound('enemy_spawn', 'sounds/enemy_spawn.ogg');
        this.loadSound('enemy_reach_end', 'sounds/enemy_reach_end.ogg');
        this.loadSound('wave_start', 'sounds/wave_start.ogg');
        this.loadSound('wave_complete', 'sounds/wave_complete.ogg');
        this.loadSound('countdown_thud', 'sounds/countdown_thud.ogg');
        this.loadSound('button_click', 'sounds/button_click.ogg');

        // Try to unlock audio system by playing a silent sound
        this.unlockAudio();

        // Note: Logger not available in AudioManager constructor
        console.log('Audio system initialized');
    }

    /**
     * Load a sound effect file
     * @param {string} name - Name identifier for the sound
     * @param {string} file - Path to the audio file
     */
    loadSound(name, file) {
        try {
            this.sounds[name] = new Audio(this.audioPath + file);
            this.sounds[name].preload = 'auto';
            this.sounds[name].volume = 0.7; // Default volume for sound effects
        } catch (error) {
            if (this.logger) this.logger.warn(`Failed to load sound: ${name} (${file})`, error);
        }
    }

    /**
     * Play a sound effect
     * @param {string} name - Name of the sound to play
     */
    playSound(name) {
        if (this.muted) return;

        // Try to unlock audio on first sound attempt
        this.checkAndUnlockAudio();

        if (this.sounds[name]) {
            try {
                // Reset to beginning and play
                this.sounds[name].currentTime = 0;
                this.sounds[name].play().catch(error => {
                    // Ignore autoplay errors silently
                    // Audio play failed - this is expected for autoplay restrictions
                });
            } catch (error) {
                if (this.logger) this.logger.warn(`Error playing sound ${name}:`, error);
            }
        } else {
            if (this.logger) this.logger.warn(`Sound not found: ${name}`);
        }
    }

    /**
     * Play background music
     * @param {string} file - Path to the music file
     * @param {boolean} loop - Whether to loop the music
     */
    playMusic(file, loop = true) {
        if (this.muted) return;

        try {
            // Stop current music
            this.stopMusic();

            // Load and play new music
            this.music = new Audio(this.audioPath + file);
            this.music.loop = loop;
            this.music.volume = 0.5; // Lower volume for background music
            this.music.play().catch(error => {
                // Background music play failed - this is expected for autoplay restrictions
            });
        } catch (error) {
            if (this.logger) this.logger.warn('Error playing background music:', error);
        }
    }

    /**
     * Stop background music
     */
    stopMusic() {
        if (this.music) {
            this.music.pause();
            this.music.currentTime = 0;
        }
    }

    /**
     * Toggle mute state
     */
    toggleMute() {
        this.muted = !this.muted;

        if (this.muted) {
            this.stopMusic();
        } else {
            // Resume music if it was playing
            this.playMusic('music/background_music.wav');
        }

        if (this.logger) this.logger.info(`Audio ${this.muted ? 'muted' : 'unmuted'}`);
        return this.muted;
    }

    /**
     * Set mute state
     * @param {boolean} muted - Whether to mute audio
     */
    setMuted(muted) {
        this.muted = muted;

        if (muted) {
            this.stopMusic();
        }
    }

    /**
     * Check if audio is muted
     * @returns {boolean} Mute state
     */
    isMuted() {
        return this.muted;
    }

    /**
     * Play background music for preparation phase
     */
    startPreparationMusic() {
        // Background music disabled - not sounding good
        if (this.logger) this.logger.info('Background music disabled');
    }

    /**
     * Stop music during enemy waves (silent combat)
     */
    startWaveMusic() {
        this.stopMusic();
    }

    /**
     * Resume music after wave completion
     */
    endWaveMusic() {
        // Don't restart music immediately - let it fade in naturally
        // The music will resume when the next preparation phase starts
        if (this.logger) this.logger.info('Wave complete - music will resume during next preparation phase');
    }

    /**
     * Try to unlock audio system by playing a very quiet sound
     * This helps bypass browser autoplay restrictions
     */
    unlockAudio() {
        // Try to play a very quiet button click sound to unlock audio
        if (this.sounds['button_click']) {
            try {
                // Set volume very low and play
                const originalVolume = this.sounds['button_click'].volume;
                this.sounds['button_click'].volume = 0.01; // Very quiet
                this.sounds['button_click'].play().then(() => {
                    // Audio unlocked successfully
                    // Restore original volume
                    this.sounds['button_click'].volume = originalVolume;
                }).catch(error => {
                    // Audio unlock failed, will require user interaction
                    // Restore original volume
                    this.sounds['button_click'].volume = originalVolume;
                });
            } catch (error) {
                // Audio unlock attempt failed
            }
        }
    }

    /**
     * Set logger reference
     */
    setLogger(logger) {
        this.logger = logger;
    }

    /**
     * Check if audio is unlocked and try to unlock if needed
     * This should be called on first user interaction
     */
    checkAndUnlockAudio() {
        if (!this.audioUnlocked) {
            this.unlockAudio();
            this.audioUnlocked = true;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleAudioManager;
}
