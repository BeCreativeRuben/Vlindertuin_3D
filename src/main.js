import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { SceneManager } from './SceneManager.js';
import { DrawingSystem } from './DrawingSystem.js';
import { ProgressTracker } from './ProgressTracker.js';
import { AnimationController } from './AnimationController.js';

/**
 * Main application entry point
 * Coordinates all systems and manages the application state
 */
class Application {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.sceneManager = null;
        this.drawingSystem = null;
        this.progressTracker = null;
        this.animationController = null;

        this.state = 'loading'; // loading, ready, animating
        this.clock = new THREE.Clock();

        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize SceneManager
            this.sceneManager = new SceneManager(this.canvas);

            // Load the model first (priority) - background loads lazily when needed
            const loadingIndicator = document.getElementById('loading-indicator');
            
            // Load model first (don't wait for background - it's 74MB and loads lazily)
            const gltf = await this.sceneManager.loadModel('butterflyflutt.glb');
            
            // Hide loading indicator after model is loaded (don't wait for background)
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            
            // Background will be loaded lazily when:
            // 1. User clicks "Toggle Background" button
            // 2. User starts animation (which triggers background fade-in)

            // Initialize systems
            this.drawingSystem = new DrawingSystem(this.sceneManager);
            this.progressTracker = new ProgressTracker(this.sceneManager);
            this.animationController = new AnimationController(this.sceneManager);

            // Setup history change callback to update undo/redo buttons
            this.drawingSystem.onHistoryChange = () => {
                this.updateUndoRedoButtons();
            };

            // Initialize animations
            this.animationController.initializeAnimations(loadedGltf);

            // Setup progress tracking callbacks
            this.progressTracker.setOnProgressUpdate((progress) => {
                this.updateProgressUI(progress);
                // Update animation button state based on progress
                this.updateAnimationButton(progress);
            });

            // Don't auto-trigger animation on complete - user must click button
            // this.progressTracker.setOnComplete(() => {
            //     this.onPaintingComplete();
            // });

            // Setup UI controls
            this.setupUI();
            
            // Initialize animation button state (disabled until progress > 0)
            this.updateAnimationButton(0);

            // Start drawing system
            this.drawingSystem.enable();

            // Start progress tracking
            this.progressTracker.startTracking();

            // Start render loop
            this.state = 'ready';
            this.render();

        } catch (error) {
            console.error('Error initializing application:', error);
            this.showError('Failed to load model. Please check the console for details.');
        }
    }

    /**
     * Setup UI event listeners
     */
    setupUI() {
        // Brush size slider
        const brushSizeSlider = document.getElementById('brush-size');
        const brushSizeValue = document.getElementById('brush-size-value');
        
        brushSizeSlider.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            this.drawingSystem.setBrushSize(size);
            brushSizeValue.textContent = size;
        });

        // Color palette swatches
        const colorSwatches = document.querySelectorAll('.color-swatch');
        colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                const color = e.target.getAttribute('data-color');
                this.drawingSystem.setBrushColor(color);
                
                // Update color picker value
                const colorPicker = document.getElementById('color-picker');
                if (colorPicker) {
                    colorPicker.value = color;
                }
                
                // Update active state
                colorSwatches.forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Set initial active color (first swatch)
        if (colorSwatches.length > 0) {
            colorSwatches[0].classList.add('active');
            this.drawingSystem.setBrushColor(colorSwatches[0].getAttribute('data-color'));
        }

        // Color picker
        const colorPicker = document.getElementById('color-picker');
        colorPicker.addEventListener('input', (e) => {
            const color = e.target.value;
            this.drawingSystem.setBrushColor(color);
            
            // Remove active state from swatches when using custom color picker
            colorSwatches.forEach(s => s.classList.remove('active'));
        });

        // Fill button
        const fillBtn = document.getElementById('fill-btn');
        fillBtn.addEventListener('click', () => {
            this.drawingSystem.fill();
            // Update progress after filling
            if (this.progressTracker) {
                this.progressTracker.update();
            }
            // Update undo/redo button states
            this.updateUndoRedoButtons();
        });

        // Undo button
        const undoBtn = document.getElementById('undo-btn');
        undoBtn.addEventListener('click', () => {
            const success = this.drawingSystem.undo();
            this.updateUndoRedoButtons();
            if (success && this.progressTracker) {
                this.progressTracker.update();
            }
        });

        // Redo button
        const redoBtn = document.getElementById('redo-btn');
        redoBtn.addEventListener('click', () => {
            const success = this.drawingSystem.redo();
            this.updateUndoRedoButtons();
            if (success && this.progressTracker) {
                this.progressTracker.update();
            }
        });

        // Background toggle button
        const backgroundToggleBtn = document.getElementById('background-toggle');
        backgroundToggleBtn.addEventListener('click', async () => {
            const currentState = this.sceneManager.isBackgroundEnabled();
            const newState = !currentState;
            
            // Disable button during loading/animation
            backgroundToggleBtn.disabled = true;
            if (newState && !this.sceneManager.backgroundTexture) {
                backgroundToggleBtn.textContent = 'Loading...';
            }
            
            await this.sceneManager.toggleBackground(newState, () => {
                // Update button text
                backgroundToggleBtn.textContent = newState ? 'Hide Background' : 'Toggle Background';
                backgroundToggleBtn.disabled = false;
            });
        });

        // Start Animation button
        const startAnimationBtn = document.getElementById('start-animation-btn');
        startAnimationBtn.addEventListener('click', () => {
            this.startAnimation();
        });

        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        resetBtn.addEventListener('click', () => {
            this.reset();
            // Update undo/redo button states after reset
            this.updateUndoRedoButtons();
        });

        // Debug toggle button
        const debugToggleBtn = document.getElementById('debug-toggle');
        debugToggleBtn.addEventListener('click', () => {
            this.drawingSystem.toggleDebug();
        });

        // Export button
        const exportBtn = document.getElementById('export-btn');
        exportBtn.addEventListener('click', () => {
            this.exportModel();
        });

        // Update button states initially
        this.updateUndoRedoButtons();

        // Keyboard shortcuts (Ctrl+Z for undo, Ctrl+Y for redo)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (this.drawingSystem.canUndo()) {
                    this.drawingSystem.undo();
                    this.updateUndoRedoButtons();
                    if (this.progressTracker) {
                        this.progressTracker.update();
                    }
                }
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                if (this.drawingSystem.canRedo()) {
                    this.drawingSystem.redo();
                    this.updateUndoRedoButtons();
                    if (this.progressTracker) {
                        this.progressTracker.update();
                    }
                }
            }
        });
    }

    /**
     * Update progress UI
     * @param {number} progress - Progress percentage (0-100)
     */
    updateProgressUI(progress) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.textContent = `${Math.round(progress)}%`;
        }

        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }

    /**
     * Update animation button state based on progress
     * @param {number} progress - Progress percentage (0-100)
     */
    updateAnimationButton(progress) {
        const startAnimationBtn = document.getElementById('start-animation-btn');
        if (startAnimationBtn) {
            // Enable button when there's some progress (at least 1%)
            if (progress > 0) {
                startAnimationBtn.disabled = false;
                startAnimationBtn.style.opacity = '1';
            } else {
                startAnimationBtn.disabled = true;
                startAnimationBtn.style.opacity = '0.6';
            }
        }
    }

    /**
     * Update undo/redo button states
     */
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = !this.drawingSystem.canUndo();
            undoBtn.style.opacity = this.drawingSystem.canUndo() ? '1' : '0.6';
        }
        
        if (redoBtn) {
            redoBtn.disabled = !this.drawingSystem.canRedo();
            redoBtn.style.opacity = this.drawingSystem.canRedo() ? '1' : '0.6';
        }
    }

    /**
     * Start animation manually (button click)
     * Sequence: Fly out -> Fade in background -> Fly in -> Start flight path
     */
    async startAnimation() {
        if (this.state === 'animating') {
            // Already animating - reset first
            this.animationController.reset();
        }
        
        this.state = 'animating';
        
        // Show animation status
        const animationStatus = document.getElementById('animation-status');
        if (animationStatus) {
            animationStatus.classList.remove('hidden');
        }

        // Disable start animation button during animation
        const startAnimationBtn = document.getElementById('start-animation-btn');
        if (startAnimationBtn) {
            startAnimationBtn.disabled = true;
            // Show loading state if background needs to be loaded
            if (!this.sceneManager.backgroundTexture) {
                startAnimationBtn.textContent = 'Loading background...';
            } else {
                startAnimationBtn.textContent = 'Animating...';
            }
        }

        // Disable drawing during animation sequence
        if (this.drawingSystem) {
            this.drawingSystem.disable();
        }

        // Step 1: Butterfly flies out
        console.log('Step 1: Butterfly flying out...');
        this.sceneManager.animateButterflyFlyOut(() => {
            console.log('Step 1 complete: Butterfly flew out');
            
            // Update button text if background is loading
            if (startAnimationBtn && !this.sceneManager.backgroundTexture) {
                startAnimationBtn.textContent = 'Loading background...';
            }
            
            // Step 2: Background swooshes in (canvas swooshes away)
            // This will load the background lazily if not already loaded
            console.log('Step 2: Canvas swooshing away, background fading in...');
            this.sceneManager.fadeInBackground(() => {
                console.log('Step 2 complete: Background faded in');
                
                // Update button text
                if (startAnimationBtn) {
                    startAnimationBtn.textContent = 'Animating...';
                }
                
                // Step 3: Butterfly flies in (same animation as toggle background)
                console.log('Step 3: Butterfly flying in...');
                this.sceneManager.animateButterflyFlyIn(() => {
                    console.log('Step 3 complete: Butterfly flew in');
                    
                    // Step 4: Start flight path animation
                    console.log('Step 4: Starting flight path animation...');
                    this.animationController.playAnimation();
                    console.log('Animation sequence complete!');
                });
            });
        });
    }

    /**
     * Handle painting completion (no longer auto-triggers)
     */
    onPaintingComplete() {
        // This is no longer called automatically
        // Animation is now triggered manually via button
    }

    /**
     * Reset the application
     */
    reset() {
        // Reset drawing
        this.drawingSystem.reset();

        // Reset progress
        this.progressTracker.reset();
        this.progressTracker.startTracking();

        // Stop and reset animation
        this.animationController.reset();

        // Hide animation status
        const animationStatus = document.getElementById('animation-status');
        if (animationStatus) {
            animationStatus.classList.add('hidden');
        }

        // Reset animation button
        const startAnimationBtn = document.getElementById('start-animation-btn');
        if (startAnimationBtn) {
            startAnimationBtn.disabled = false;
            startAnimationBtn.textContent = 'Start Animation';
            startAnimationBtn.style.opacity = '1';
        }

        // Update undo/redo buttons
        this.updateUndoRedoButtons();

        // Update state
        this.state = 'ready';
    }

    /**
     * Render loop
     */
    render() {
        requestAnimationFrame(() => this.render());

        const deltaTime = this.clock.getDelta();

        // Update scene manager (orbit controls)
        if (this.sceneManager) {
            this.sceneManager.update();
        }

        // Update progress tracker
        if (this.progressTracker) {
            this.progressTracker.update();
        }

        // Update animation controller
        if (this.animationController) {
            this.animationController.update(deltaTime);
        }

        // Render scene
        if (this.sceneManager) {
            this.sceneManager.render();
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `<p style="color: red;">${message}</p>`;
        }
    }

    /**
     * Export the model with painted texture to GLB format
     */
    async exportModel() {
        const exportBtn = document.getElementById('export-btn');
        if (!this.sceneManager || !this.sceneManager.getModel()) {
            this.showError('No model loaded to export.');
            return;
        }

        try {
            // Disable export button during export
            if (exportBtn) {
                exportBtn.disabled = true;
                exportBtn.textContent = 'Exporting...';
            }

            console.log('Starting export...');
            
            // Get the texture canvas
            const textureCanvas = this.sceneManager.getTextureCanvas();
            if (!textureCanvas) {
                throw new Error('No texture canvas found');
            }

            // Ensure texture is updated
            this.sceneManager.updateTexture();

            // Convert canvas to Image for proper export
            const textureImage = await new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = (err) => {
                    console.error('Failed to load texture image:', err);
                    reject(new Error('Failed to convert canvas to image'));
                };
                img.src = textureCanvas.toDataURL('image/png');
            });

            console.log('Texture image created:', textureImage.width, 'x', textureImage.height);

            // Create a new texture from the image for export
            const exportTexture = new THREE.Texture(textureImage);
            exportTexture.flipY = false;
            exportTexture.needsUpdate = true;
            exportTexture.name = 'painted_texture';
            exportTexture.format = THREE.RGBAFormat;
            exportTexture.type = THREE.UnsignedByteType;

            // Get the model - don't clone deeply, just reference it
            const model = this.sceneManager.getModel();
            
            // Create a clean export scene with just the model
            const exportScene = new THREE.Scene();
            const exportModel = model.clone();
            
            // Apply the export texture to all meshes in the cloned model
            exportModel.traverse((child) => {
                if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
                    if (child.geometry) {
                        // Ensure geometry is not disposed
                        child.geometry.dispose = () => {}; // Prevent disposal during export
                        
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            const newMaterials = materials.map(mat => {
                                // Create a new material with the export texture
                                const newMat = new THREE.MeshStandardMaterial({
                                    map: exportTexture,
                                    color: mat.color || 0xffffff,
                                    side: THREE.DoubleSide,
                                    wireframe: false,
                                    flatShading: false
                                });
                                return newMat;
                            });
                            child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
                        } else {
                            // Create material if none exists
                            child.material = new THREE.MeshStandardMaterial({
                                map: exportTexture,
                                side: THREE.DoubleSide,
                                wireframe: false
                            });
                        }
                    }
                }
            });
            
            exportScene.add(exportModel);

            console.log('Export scene prepared with', exportScene.children.length, 'object(s)');

            // Create exporter
            const exporter = new GLTFExporter();
            
            // Export options - simplified for maximum compatibility
            const options = {
                binary: true, // Export as .glb (binary format)
                includeCustomExtensions: false,
                truncateDrawRange: false,
                onlyVisible: false,
                embedImages: true, // Embed textures in the GLB file
                animations: [] // Don't include animations for now
            };

            console.log('Exporting with options:', options);
            
            // Export the scene (not just the model)
            exporter.parse(
                exportScene,
                (result) => {
                    try {
                        // Create blob from result
                        const blob = new Blob([result], { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        
                        // Create download link
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `butterfly_painted_${Date.now()}.glb`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Clean up
                        setTimeout(() => {
                            URL.revokeObjectURL(url);
                            exportTexture.dispose();
                            exportScene.traverse((child) => {
                                if (child.material) {
                                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                                    materials.forEach(mat => {
                                        if (mat.map && mat.map !== exportTexture) mat.map.dispose();
                                        mat.dispose();
                                    });
                                }
                                if (child.geometry) {
                                    // Restore original dispose
                                    if (child.geometry.dispose && typeof child.geometry.dispose === 'function') {
                                        // Already has dispose
                                    }
                                }
                            });
                            exportScene.clear();
                        }, 100);
                        
                        const fileSizeMB = (blob.size / 1024 / 1024).toFixed(2);
                        console.log('Model exported successfully!');
                        console.log('File size:', fileSizeMB, 'MB');
                        console.log('Texture size:', textureImage.width, 'x', textureImage.height);
                        
                        // Re-enable export button
                        if (exportBtn) {
                            exportBtn.disabled = false;
                            exportBtn.textContent = 'Export to GLB';
                        }
                    } catch (downloadError) {
                        console.error('Download error:', downloadError);
                        throw downloadError;
                    }
                },
                (error) => {
                    console.error('Export error:', error);
                    this.showError(`Failed to export model: ${error.message || 'Unknown error'}. Check console for details.`);
                    
                    // Clean up
                    exportTexture.dispose();
                    exportScene.traverse((child) => {
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                if (mat.map && mat.map !== exportTexture) mat.map.dispose();
                                mat.dispose();
                            });
                        }
                    });
                    exportScene.clear();
                    
                    // Re-enable export button
                    if (exportBtn) {
                        exportBtn.disabled = false;
                        exportBtn.textContent = 'Export to GLB';
                    }
                },
                options
            );

        } catch (error) {
            console.error('Export error:', error);
            this.showError(`Failed to export model: ${error.message || 'Unknown error'}. Check console for details.`);
            
            // Re-enable export button
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export to GLB';
            }
        }
    }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new Application();
    });
} else {
    new Application();
}

