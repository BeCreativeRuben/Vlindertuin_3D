import * as THREE from 'three';

/**
 * Controls animations - supports GLTF animations and programmatic fallback
 */
export class AnimationController {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.model = sceneManager.getModel();
        this.mixer = null;
        this.actions = [];
        this.clips = [];
        this.isPlaying = false;
        this.originalPosition = null;
        this.originalRotation = null;
        this.originalScale = null;
        
        this.animationStartTime = null;
        this.animationDuration = 3000; // 3 seconds for programmatic animation
        
        // Flight path properties
        this.flightPath = null;
        this.flightPathDuration = 15000; // 15 seconds for one complete flight path
        this.isFollowingPath = false;
        this.camera = sceneManager.getCamera();
    }

    /**
     * Initialize animations from GLTF or create programmatic fallback
     * @param {Object} gltf - GLTF object with animations
     */
    initializeAnimations(gltf) {
        // Try to use GLTF animations first
        if (gltf && gltf.animations && gltf.animations.length > 0) {
            this.setupGLTFAnimations(gltf);
        } else {
            // Fallback to programmatic animations
            this.setupProgrammaticAnimations();
        }

        // Store original transforms
        if (this.model) {
            this.originalPosition = this.model.position.clone();
            this.originalRotation = this.model.rotation.clone();
            this.originalScale = this.model.scale.clone();
        }
        
        // Create flight path
        this.createFlightPath();
    }

    /**
     * Setup GLTF animations
     * @param {Object} gltf - GLTF object with animations
     */
    setupGLTFAnimations(gltf) {
        this.mixer = new THREE.AnimationMixer(this.model);
        this.clips = gltf.animations;

        // Create actions for each clip
        this.clips.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            this.actions.push(action);
        });

        console.log('GLTF animations loaded:', this.clips.length);
    }

    /**
     * Setup programmatic animations (fallback)
     * Creates a combination of rotation, scale, and position animations
     */
    setupProgrammaticAnimations() {
        console.log('Using programmatic animations (fallback)');
        // Programmatic animations will be handled in the update method
        // No need for AnimationMixer for simple transforms
    }

    /**
     * Create a flight path for the butterfly to follow
     * Creates an organic, flowing loop path like a butterfly flying around flowers
     */
    createFlightPath() {
        if (!this.model || !this.originalPosition) return;
        
        // Create an organic, flowing path similar to the red line in the image
        // This creates a natural butterfly flight pattern - looping around the scene
        const points = [];
        const numPoints = 80; // More points for smoother, more organic path
        
        // Define key waypoints for the organic path (similar to the red line pattern)
        // These create a loose, flowing loop that goes around the scene
        const waypoints = [
            { x: -2.5, y: -1.5, z: 0 },      // Start bottom-left
            { x: -1.5, y: 0, z: -1 },        // Move up-left
            { x: 0, y: 1.5, z: -1.5 },       // Top-center, behind
            { x: 1.5, y: 1, z: -1 },         // Top-right-center
            { x: 2.5, y: 0.5, z: 0 },        // Right, mid-height
            { x: 2, y: -0.5, z: 1 },         // Right, going down
            { x: 1, y: -1, z: 1.5 },         // Mid-right, bottom
            { x: -0.5, y: -1.2, z: 1 },      // Mid-left, bottom
            { x: -2, y: -0.8, z: 0.5 },      // Back to start area
        ];
        
        // Interpolate between waypoints with smooth curves
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            
            // Map t to waypoint indices (loop through all waypoints)
            const totalWaypoints = waypoints.length;
            const waypointProgress = t * totalWaypoints;
            const currentIndex = Math.floor(waypointProgress) % totalWaypoints;
            const nextIndex = (currentIndex + 1) % totalWaypoints;
            const localT = waypointProgress % 1;
            
            const wp1 = waypoints[currentIndex];
            const wp2 = waypoints[nextIndex];
            
            // Use smooth interpolation with easing (smoothstep)
            const easedT = localT * localT * (3 - 2 * localT);
            
            // Interpolate between waypoints
            const x = wp1.x + (wp2.x - wp1.x) * easedT;
            const y = wp1.y + (wp2.y - wp1.y) * easedT;
            const z = wp1.z + (wp2.z - wp1.z) * easedT;
            
            // Add organic variation with sine waves for natural butterfly movement
            const variationT = t * Math.PI * 2;
            const organicX = Math.sin(variationT * 1.3) * 0.3;
            const organicY = Math.cos(variationT * 1.7) * 0.2;
            const organicZ = Math.sin(variationT * 0.9) * 0.25;
            
            // Add to original position
            points.push(new THREE.Vector3(
                this.originalPosition.x + x + organicX,
                this.originalPosition.y + y + organicY,
                this.originalPosition.z + z + organicZ
            ));
        }
        
        // Create a CatmullRomCurve3 for smooth interpolation
        this.flightPath = new THREE.CatmullRomCurve3(points);
        this.flightPath.closed = true; // Loop the path
        
        console.log('Organic flight path created with', points.length, 'points');
    }

    /**
     * Play animations
     */
    playAnimation() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.isFollowingPath = true;
        this.animationStartTime = null;

        if (this.mixer && this.actions.length > 0) {
            // Play GLTF animations
            this.actions.forEach((action) => {
                action.reset().play();
            });
        }
    }

    /**
     * Stop animations
     */
    stopAnimation() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.isFollowingPath = false;

        if (this.mixer && this.actions.length > 0) {
            // Stop GLTF animations
            this.actions.forEach((action) => {
                action.stop();
            });
        }

        // Reset to original state for programmatic animations
        if (this.model && !this.mixer) {
            this.model.position.copy(this.originalPosition);
            this.model.rotation.copy(this.originalRotation);
            this.model.scale.copy(this.originalScale);
        }
    }

    /**
     * Update animations (call from render loop)
     * @param {number} deltaTime - Time delta in seconds
     */
    update(deltaTime) {
        // Update GLTF animations
        if (this.mixer && this.isPlaying) {
            this.mixer.update(deltaTime);
        }

        // Update programmatic animations
        if (!this.mixer && this.isPlaying && this.model) {
            this.updateProgrammaticAnimation(deltaTime);
        }
    }

    /**
     * Update programmatic animation (rotation + scale + position + flight path)
     * @param {number} deltaTime - Time delta in seconds
     */
    updateProgrammaticAnimation(deltaTime) {
        if (this.animationStartTime === null) {
            this.animationStartTime = performance.now();
        }

        const elapsed = (performance.now() - this.animationStartTime) / 1000;
        const normalizedTime = (elapsed % (this.animationDuration / 1000)) / (this.animationDuration / 1000);

        // Flight path animation - follow the path
        if (this.isFollowingPath && this.flightPath) {
            // Calculate progress along flight path (0 to 1, looping)
            const pathProgress = (elapsed % (this.flightPathDuration / 1000)) / (this.flightPathDuration / 1000);
            
            // Get position along the path
            const pathPoint = this.flightPath.getPoint(pathProgress);
            this.model.position.copy(pathPoint);
            
            // Get tangent for orientation (make butterfly face direction of travel)
            const tangent = this.flightPath.getTangent(pathProgress);
            if (tangent.length() > 0.01) {
                // Calculate rotation to face direction of travel
                const normalizedTangent = tangent.clone().normalize();
                const lookAtPoint = this.model.position.clone().add(normalizedTangent.multiplyScalar(1));
                
                // Make butterfly face direction of travel
                this.model.lookAt(lookAtPoint);
                
                // Add slight banking effect based on path curvature
                // Calculate banking by comparing previous and current tangent
                const prevProgress = (pathProgress - 0.01 + 1) % 1; // Wrap around
                const prevTangent = this.flightPath.getTangent(prevProgress);
                if (prevTangent.length() > 0.01) {
                    const currentTangent = this.flightPath.getTangent(pathProgress);
                    const crossProduct = currentTangent.clone().cross(prevTangent);
                    const turnAmount = crossProduct.length();
                    const bankAngle = Math.min(turnAmount * 2, Math.PI / 6); // Max 30 degrees
                    
                    // Apply banking rotation around forward direction (Z-axis)
                    this.model.rotateZ(bankAngle);
                }
            }
        } else {
            // Original floating animation (when not following path)
            const positionAmount = 0.2;
            const offsetY = Math.sin(normalizedTime * Math.PI * 2) * positionAmount;
            this.model.position.y = this.originalPosition.y + offsetY;
            
            // Rotation animation (full rotation every 3 seconds)
            const rotationSpeed = Math.PI * 2; // One full rotation per second
            this.model.rotation.y = this.originalRotation.y + rotationSpeed * normalizedTime;
            
            // Add slight X-axis rotation for more dynamic effect
            this.model.rotation.x = this.originalRotation.x + Math.sin(normalizedTime * Math.PI * 2) * 0.2;
        }

        // Scale animation (wing flapping / pulse effect) - works for both path and floating
        const scaleAmount = 0.1;
        const scale = 1 + Math.sin(normalizedTime * Math.PI * 4) * scaleAmount; // Faster flapping
        this.model.scale.set(
            this.originalScale.x * scale,
            this.originalScale.y * scale,
            this.originalScale.z * scale
        );
        
        // Add wing flapping rotation when following path (small adjustments)
        if (this.isFollowingPath && this.flightPath) {
            // Add subtle wing flapping effect on X-axis (wing tilt)
            const wingFlap = Math.sin(normalizedTime * Math.PI * 4) * 0.1; // Subtle flapping
            this.model.rotateX(wingFlap * deltaTime * 10); // Small adjustments
        }
    }

    /**
     * Check if animation is currently playing
     * @returns {boolean} True if playing
     */
    isAnimationPlaying() {
        return this.isPlaying;
    }

    /**
     * Reset to original state
     */
    reset() {
        this.stopAnimation();
        if (this.model) {
            this.model.position.copy(this.originalPosition);
            this.model.rotation.copy(this.originalRotation);
            this.model.scale.copy(this.originalScale);
        }
    }
}

