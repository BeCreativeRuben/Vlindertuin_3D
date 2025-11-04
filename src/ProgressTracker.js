import { isPixelPainted, getGridSamples } from './utils.js';

/**
 * Tracks painting progress by monitoring texture canvas pixels
 */
export class ProgressTracker {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.textureCanvas = sceneManager.getTextureCanvas();
        
        this.isTracking = false;
        this.progress = 0;
        this.frameCount = 0;
        this.sampleInterval = 15; // Sample every 15 frames for performance
        this.gridSize = 8; // Grid size for spatial sampling
        
        this.onProgressUpdate = null;
        this.onComplete = null;
    }

    /**
     * Start tracking progress
     */
    startTracking() {
        this.isTracking = true;
        this.frameCount = 0;
    }

    /**
     * Stop tracking progress
     */
    stopTracking() {
        this.isTracking = false;
    }

    /**
     * Update progress tracking (call from render loop)
     */
    update() {
        if (!this.isTracking || !this.textureCanvas) {
            return;
        }

        this.frameCount++;

        // Sample every N frames for performance
        if (this.frameCount % this.sampleInterval !== 0) {
            return;
        }

        this.calculateProgress();
    }

    /**
     * Calculate painting progress
     */
    calculateProgress() {
        if (!this.textureCanvas) return;

        const ctx = this.textureCanvas.getContext('2d');
        const width = this.textureCanvas.width;
        const height = this.textureCanvas.height;

        // Use grid-based sampling for performance
        const samples = getGridSamples(width, height, this.gridSize);
        let paintedCount = 0;
        let totalCount = 0;

        // Get image data once
        const imageData = ctx.getImageData(0, 0, width, height);

        // Sample pixels in grid pattern
        for (const sample of samples) {
            const x = Math.floor(sample.x);
            const y = Math.floor(sample.y);

            if (x >= 0 && x < width && y >= 0 && y < height) {
                totalCount++;
                if (isPixelPainted(imageData, x, y, width)) {
                    paintedCount++;
                }
            }
        }

        // Calculate progress percentage
        const newProgress = totalCount > 0 ? (paintedCount / totalCount) * 100 : 0;
        
        // Only update if progress changed significantly (reduce event spam)
        if (Math.abs(newProgress - this.progress) > 0.5) {
            this.progress = newProgress;

            // Trigger progress update callback
            if (this.onProgressUpdate) {
                this.onProgressUpdate(this.progress);
            }

            // Check for completion
            if (this.progress >= 99.5 && this.onComplete) {
                this.onComplete();
                this.stopTracking();
            }
        }
    }

    /**
     * Get current progress percentage
     * @returns {number} Progress percentage (0-100)
     */
    getProgress() {
        return this.progress;
    }

    /**
     * Set progress update callback
     * @param {Function} callback - Callback function(progress)
     */
    setOnProgressUpdate(callback) {
        this.onProgressUpdate = callback;
    }

    /**
     * Set completion callback
     * @param {Function} callback - Callback function()
     */
    setOnComplete(callback) {
        this.onComplete = callback;
    }

    /**
     * Reset progress tracking
     */
    reset() {
        this.progress = 0;
        this.frameCount = 0;
        if (this.onProgressUpdate) {
            this.onProgressUpdate(0);
        }
    }
}

