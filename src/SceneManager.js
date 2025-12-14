import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Manages the Three.js scene, camera, renderer, model loading, and raycasting
 */
export class SceneManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.texture = null;
        this.textureCanvas = null;
        this.raycaster = null;
        this.controls = null;
        this.loader = new GLTFLoader();
        this.backgroundTexture = null;
        this.backgroundEnabled = false;
        this.originalBackground = new THREE.Color(0x1a1a1a);
        
        this.init();
    }

    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // Create camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Initialize raycaster
        this.raycaster = new THREE.Raycaster();

        // Initialize orbit controls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false; // Disable zoom - fixed distance
        this.controls.enablePan = false; // Disable panning, only allow rotation
        
        // Configure mouse buttons: only right mouse button for rotation
        this.controls.mouseButtons = {
            LEFT: null,      // Disable left button rotation (used for drawing)
            MIDDLE: null,    // Disable middle button
            RIGHT: THREE.MOUSE.ROTATE // Right button for rotation
        };

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Load the 3D model
     * @param {string} modelPath - Path to the GLB model
     * @returns {Promise} Promise that resolves when model is loaded
     */
    async loadModel(modelPath) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/184b3a7e-2aa3-442d-abe6-dad9937be2cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneManager.js:82',message:'loadModel called',data:{modelPath,baseURI:document.baseURI,locationHref:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return new Promise((resolve, reject) => {
            this.loader.load(
                modelPath,
                (gltf) => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/184b3a7e-2aa3-442d-abe6-dad9937be2cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneManager.js:86',message:'Model load success callback',data:{modelPath,hasScene:!!gltf?.scene,childrenCount:gltf?.scene?.children?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    this.model = gltf.scene;
                    
                    console.log('=== MODEL LOADED ===');
                    console.log('Model file:', modelPath);
                    console.log('Model object:', gltf.scene);
                    console.log('Model children:', gltf.scene.children);
                    console.log('Model name:', gltf.scene.name);
                    
                    // Find all meshes in the model
                    const meshes = this.findAllMeshes(gltf.scene);
                    if (meshes.length === 0) {
                        reject(new Error('No meshes found in model'));
                        return;
                    }

                    console.log(`Found ${meshes.length} meshes in model:`);
                    meshes.forEach((mesh, index) => {
                        console.log(`  Mesh ${index + 1}:`, {
                            name: mesh.name || 'unnamed',
                            type: mesh.type,
                            hasGeometry: !!mesh.geometry,
                            hasMaterial: !!mesh.material,
                            visible: mesh.visible,
                            geometryType: mesh.geometry?.type,
                            materialType: mesh.material?.type,
                            wireframe: mesh.material?.wireframe
                        });
                    });
                    console.log('==================');

                    // Create texture canvas (use first mesh for size reference)
                    this.createTextureCanvas(meshes[0]);

                    // Apply texture to ALL meshes so drawing works on all parts
                    meshes.forEach((mesh, index) => {
                        try {
                            // Store original material info for debugging
                            const originalMaterial = mesh.material;
                            const wasWireframe = originalMaterial?.wireframe;
                            
                            this.applyTextureToMesh(mesh);
                            
                            console.log(`Applied texture to mesh ${index + 1}:`, {
                                name: mesh.name || mesh.type,
                                originalWireframe: wasWireframe,
                                newWireframe: mesh.material.wireframe,
                                materialType: mesh.material.type
                            });
                        } catch (error) {
                            console.error(`Failed to apply texture to mesh ${index + 1}:`, error, mesh);
                        }
                    });

                    // Remove any wireframe helpers or edge helpers from the model
                    gltf.scene.traverse((child) => {
                        if (child instanceof THREE.Line || child instanceof THREE.LineSegments) {
                            console.warn('Removing line/edge helper:', child);
                            child.visible = false;
                        }
                        // Ensure no wireframe materials
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(mat => {
                                if (mat && mat.wireframe !== undefined) {
                                    mat.wireframe = false;
                                }
                            });
                        }
                    });

                    // Add model to scene
                    this.scene.add(gltf.scene);

                    // Center and scale model
                    this.centerModel(gltf.scene);
                    
                    console.log('=== MODEL ADDED TO SCENE ===');
                    console.log('Scene children count:', this.scene.children.length);
                    console.log('Model position:', gltf.scene.position);
                    console.log('Model rotation:', gltf.scene.rotation);
                    console.log('Model scale:', gltf.scene.scale);
                    console.log('============================');

                    resolve(gltf);
                },
                (progress) => {
                    // Loading progress can be handled here
                    console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
                    // #region agent log
                    if(progress.loaded===0||progress.loaded===progress.total){fetch('http://127.0.0.1:7242/ingest/184b3a7e-2aa3-442d-abe6-dad9937be2cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneManager.js:172',message:'Model load progress',data:{loaded:progress.loaded,total:progress.total,percent:progress.total>0?(progress.loaded/progress.total*100).toFixed(1):0,modelPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});}
                    // #endregion
                },
                (error) => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/184b3a7e-2aa3-442d-abe6-dad9937be2cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SceneManager.js:176',message:'Model load error',data:{errorMessage:error?.message||String(error),errorType:error?.type||'unknown',modelPath,url:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    reject(error);
                }
            );
        });
    }

    /**
     * Find all meshes in the scene (including SkinnedMesh and other mesh types)
     * @param {THREE.Object3D} object - Object to search
     * @param {Set} seen - Set of already seen meshes (to avoid duplicates)
     * @returns {Array<THREE.Mesh>} Array of all meshes found
     */
    findAllMeshes(object, seen = new Set()) {
        const meshes = [];
        
        // Check for any type of mesh (Mesh, SkinnedMesh, InstancedMesh, etc.)
        if ((object instanceof THREE.Mesh || object instanceof THREE.SkinnedMesh) && !seen.has(object)) {
            seen.add(object);
            meshes.push(object);
        }
        // Also check if object has geometry (might be a mesh without proper type)
        // Only add if not already added above and not seen
        else if (object.geometry && object.isObject3D && object.type !== 'Object3D' && !seen.has(object)) {
            seen.add(object);
            meshes.push(object);
        }
        
        // Recursively search children (pass the same Set to track across all calls)
        for (const child of object.children) {
            meshes.push(...this.findAllMeshes(child, seen));
        }
        
        return meshes;
    }

    /**
     * Create a texture canvas matching the model's UV size
     * @param {THREE.Mesh} mesh - Mesh to create texture for
     */
    createTextureCanvas(mesh) {
        // Determine texture size (power of 2 for better performance)
        const textureSize = 1024;

        // Create canvas for texture
        this.textureCanvas = document.createElement('canvas');
        this.textureCanvas.width = textureSize;
        this.textureCanvas.height = textureSize;

        const ctx = this.textureCanvas.getContext('2d');
        
        // Initialize with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, textureSize, textureSize);

        // Create Three.js texture from canvas
        this.texture = new THREE.CanvasTexture(this.textureCanvas);
        this.texture.flipY = false;
        this.texture.needsUpdate = true;
    }

    /**
     * Apply texture to mesh material
     * @param {THREE.Mesh} mesh - Mesh to apply texture to
     */
    applyTextureToMesh(mesh) {
        // Ensure mesh has geometry
        if (!mesh.geometry) {
            console.warn('Mesh has no geometry:', mesh);
            return;
        }
        
        // Ensure geometry has UV coordinates - generate them if missing
        this.ensureGeometryUVs(mesh.geometry);
        
        // Create or update material with our texture
        // If material exists, use it; otherwise create new one
        if (mesh.material) {
            // If material is an array, use first material
            const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            
            // Create new material with our texture (preserve existing properties if needed)
            mesh.material = new THREE.MeshStandardMaterial({
                map: this.texture,
                side: THREE.DoubleSide,
                color: material.color || 0xffffff,
                wireframe: false, // Ensure wireframe is off
                flatShading: false, // Use smooth shading
                vertexColors: false // Don't use vertex colors
            });
        } else {
            // No material exists - create one
            mesh.material = new THREE.MeshStandardMaterial({
                map: this.texture,
                side: THREE.DoubleSide,
                wireframe: false, // Ensure wireframe is off
                flatShading: false, // Use smooth shading
                vertexColors: false // Don't use vertex colors
            });
        }
        
        // Ensure mesh is visible and raycastable
        mesh.visible = true;
        mesh.matrixAutoUpdate = true; // Ensure matrix updates for proper raycasting
        
        // Ensure geometry attributes are updated
        if (mesh.geometry.attributes.uv) {
            mesh.geometry.attributes.uv.needsUpdate = true;
        }
    }
    
    /**
     * Ensure geometry has UV coordinates - generate them if missing
     * @param {THREE.BufferGeometry|THREE.Geometry} geometry - Geometry to check
     */
    ensureGeometryUVs(geometry) {
        // Check if geometry has UV coordinates
        if (!geometry.attributes || !geometry.attributes.uv) {
            console.warn('Geometry missing UV coordinates, generating...', geometry);
            
            // For BufferGeometry, generate UV coordinates
            if (geometry instanceof THREE.BufferGeometry) {
                // Compute UV coordinates from position
                const position = geometry.attributes.position;
                if (position) {
                    const uvArray = new Float32Array(position.count * 2);
                    
                    // Generate simple planar UV mapping
                    for (let i = 0; i < position.count; i++) {
                        const x = position.getX(i);
                        const y = position.getY(i);
                        const z = position.getZ(i);
                        
                        // Simple planar projection - map X,Y,Z to UV space
                        // Use bounding box to normalize
                        if (!geometry.boundingBox) {
                            geometry.computeBoundingBox();
                        }
                        
                        const box = geometry.boundingBox;
                        const sizeX = box.max.x - box.min.x;
                        const sizeY = box.max.y - box.min.y;
                        const sizeZ = box.max.z - box.min.z;
                        
                        // Map coordinates to 0-1 range based on bounding box
                        // Use the largest dimension to ensure full coverage
                        const u = sizeX > 0 ? (x - box.min.x) / sizeX : 0;
                        const v = sizeY > 0 ? (y - box.min.y) / sizeY : 0;
                        
                        uvArray[i * 2] = Math.max(0, Math.min(1, u));
                        uvArray[i * 2 + 1] = Math.max(0, Math.min(1, v));
                    }
                    
                    geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
                    geometry.attributes.uv.needsUpdate = true;
                }
            }
        }
    }

    /**
     * Center and scale the model to fit the view
     * @param {THREE.Object3D} model - Model to center
     */
    centerModel(model) {
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Center the model
        model.position.sub(center);

        // Scale to fit (adjust camera distance)
        const maxDim = Math.max(size.x, size.y, size.z);
        // Calculate distance to fit entire model in view
        // Use a multiplier that ensures the model fits comfortably
        const distance = maxDim * 3.5; // Further distance for better overview
        this.camera.position.set(0, 0, distance);
        this.camera.lookAt(0, 0, 0);
        
        // Lock zoom at this distance
        this.controls.minDistance = distance;
        this.controls.maxDistance = distance;
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Get raycaster for intersection testing
     * @returns {THREE.Raycaster} Raycaster instance
     */
    getRaycaster() {
        return this.raycaster;
    }

    /**
     * Get the scene
     * @returns {THREE.Scene} Scene instance
     */
    getScene() {
        return this.scene;
    }

    /**
     * Get the camera
     * @returns {THREE.PerspectiveCamera} Camera instance
     */
    getCamera() {
        return this.camera;
    }

    /**
     * Get the texture canvas
     * @returns {HTMLCanvasElement} Texture canvas
     */
    getTextureCanvas() {
        return this.textureCanvas;
    }

    /**
     * Get the texture
     * @returns {THREE.CanvasTexture} Texture instance
     */
    getTexture() {
        return this.texture;
    }

    /**
     * Get the model
     * @returns {THREE.Object3D} Model instance
     */
    getModel() {
        return this.model;
    }

    /**
     * Update the texture (call after drawing on canvas)
     */
    updateTexture() {
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
    }

    /**
     * Update controls (call from render loop)
     */
    update() {
        if (this.controls) {
            this.controls.update();
        }
    }

    /**
     * Load background texture
     * @param {string} imagePath - Path to background image
     * @returns {Promise} Promise that resolves when texture is loaded
     */
    async loadBackgroundTexture(imagePath) {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                imagePath,
                (texture) => {
                    // Background texture - no repeating needed
                    texture.wrapS = THREE.ClampToEdgeWrapping;
                    texture.wrapT = THREE.ClampToEdgeWrapping;
                    this.backgroundTexture = texture;
                    console.log('Background texture loaded:', imagePath);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error('Failed to load background texture:', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Ensure background texture is loaded (lazy loading)
     * @param {Function} onProgress - Optional progress callback
     * @param {Function} onComplete - Callback when texture is loaded or already exists
     */
    async ensureBackgroundTextureLoaded(onProgress, onComplete) {
        // If already loaded, call callback immediately
        if (this.backgroundTexture) {
            if (onComplete) onComplete();
            return;
        }
        
        // Show loading indicator if callback provided
        if (onProgress) {
            onProgress('Loading background image (74MB)...');
        }
        
        // Load background texture lazily
        try {
            console.log('Loading background texture (lazy load)...');
            await this.loadBackgroundTexture('/Vlindertuin_3D/byob_achtergrond.png');
            console.log('Background texture loaded successfully');
            if (onComplete) onComplete();
        } catch (error) {
            console.error('Failed to load background texture:', error);
            if (onComplete) onComplete(); // Continue even if background fails
        }
    }

    /**
     * Toggle background image on/off
     * @param {boolean} enabled - Whether to enable background
     * @param {Function} onComplete - Callback when animation completes
     */
    async toggleBackground(enabled, onComplete) {
        this.backgroundEnabled = enabled;
        
        if (enabled) {
            // Ensure background texture is loaded before using it
            await this.ensureBackgroundTextureLoaded(null, () => {
                if (this.backgroundTexture) {
                    // Set background texture
                    this.scene.background = this.backgroundTexture;
                    
                    // Animate butterfly flying onto background
                    if (this.model && onComplete) {
                        this.animateButterflyFlyIn(onComplete);
                    } else {
                        if (onComplete) onComplete();
                    }
                } else {
                    // Background failed to load, continue without it
                    if (onComplete) onComplete();
                }
            });
        } else {
            // Remove background (back to solid color)
            this.scene.background = this.originalBackground;
            
            // Reset butterfly position if needed
            if (this.model) {
                this.resetButterflyPosition();
            }
            
            if (onComplete) onComplete();
        }
    }

    /**
     * Animate butterfly flying out of the scene (reverse of fly-in)
     * @param {Function} onComplete - Callback when animation completes
     */
    animateButterflyFlyOut(onComplete) {
        if (!this.model) {
            if (onComplete) onComplete();
            return;
        }
        
        // Start position (current position - should be at center 0,0,0)
        const startPosition = this.model.position.clone();
        
        // End position (off-screen, slightly above and behind the center)
        // Use center (0,0,0) as reference to ensure consistent off-screen position
        const centerPosition = new THREE.Vector3(0, 0, 0);
        const endPosition = new THREE.Vector3(
            centerPosition.x,
            centerPosition.y + 2,
            centerPosition.z - 3
        );
        
        // Animation parameters
        const duration = 2000; // 2 seconds
        const startTime = Date.now();
        
        // Animation loop
        const animateFlyOut = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in)
            const easedProgress = Math.pow(progress, 3);
            
            // Interpolate position from current to off-screen
            this.model.position.lerpVectors(startPosition, endPosition, easedProgress);
            
            // Add slight rotation during flight
            this.model.rotation.y = Math.sin(progress * Math.PI * 2) * 0.1;
            
            if (progress < 1) {
                requestAnimationFrame(animateFlyOut);
            } else {
                // Animation complete - butterfly is now off-screen
                this.model.position.copy(endPosition);
                this.model.rotation.y = 0;
                console.log('Butterfly fly-out complete, position:', this.model.position);
                if (onComplete) onComplete();
            }
        };
        
        console.log('Starting butterfly fly-out from', startPosition, 'to', endPosition);
        animateFlyOut();
    }

    /**
     * Animate butterfly flying into the scene
     * @param {Function} onComplete - Callback when animation completes
     */
    animateButterflyFlyIn(onComplete) {
        if (!this.model) {
            if (onComplete) onComplete();
            return;
        }
        
        // Use the original centered position (0, 0, 0) as the end position
        // This ensures the butterfly always flies back to the center, regardless of current position
        const endPosition = new THREE.Vector3(0, 0, 0);
        
        // Start position (off-screen, slightly above and behind the center)
        const startPosition = new THREE.Vector3(
            endPosition.x,
            endPosition.y + 2,
            endPosition.z - 3
        );
        
        // Set starting position (butterfly should already be off-screen from fly-out)
        // But ensure it's at the start position for consistency
        this.model.position.copy(startPosition);
        
        // Reset rotation
        this.model.rotation.set(0, 0, 0);
        
        // Animation parameters
        const duration = 2000; // 2 seconds
        const startTime = Date.now();
        
        // Animation loop
        const animateFlyIn = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            // Interpolate position from start to end (center)
            this.model.position.lerpVectors(startPosition, endPosition, easedProgress);
            
            // Add slight rotation during flight
            this.model.rotation.y = Math.sin(progress * Math.PI * 2) * 0.1;
            
            if (progress < 1) {
                requestAnimationFrame(animateFlyIn);
            } else {
                // Animation complete - ensure butterfly is at center
                this.model.position.copy(endPosition);
                this.model.rotation.y = 0;
                console.log('Butterfly fly-in complete, position:', this.model.position);
                if (onComplete) onComplete();
            }
        };
        
        console.log('Starting butterfly fly-in from', startPosition, 'to', endPosition);
        animateFlyIn();
    }

    /**
     * Swoosh away the canvas and fade in background from the side
     * Creates a "swoosh" effect where the entire painting canvas disappears
     * @param {Function} onComplete - Callback when animation completes
     */
    async fadeInBackground(onComplete) {
        // Ensure background texture is loaded before swoosh animation
        await this.ensureBackgroundTextureLoaded(null, () => {
            if (!this.backgroundTexture) {
                if (onComplete) onComplete();
                return;
            }
            
            this.performSwooshAnimation(onComplete);
        });
    }

    /**
     * Perform the actual swoosh animation (called after background is loaded)
     * @param {Function} onComplete - Callback when animation completes
     */
    performSwooshAnimation(onComplete) {
        
        // Set background texture first (will be revealed by swoosh)
        this.scene.background = this.backgroundTexture;
        this.backgroundEnabled = true;
        
        // Create a swoosh plane that covers the entire view
        // This will swoosh away, revealing the background
        const swooshGeometry = new THREE.PlaneGeometry(1, 1);
        
        // Create a material that uses the original background color
        const swooshMaterial = new THREE.MeshBasicMaterial({
            color: this.originalBackground,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1
        });
        
        // Create a large plane that covers the entire view
        const swooshPlane = new THREE.Mesh(swooshGeometry, swooshMaterial);
        
        // Calculate size needed to cover the entire viewport
        // Position it between camera and scene (at center of view)
        const cameraDistance = Math.abs(this.camera.position.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const height = 2 * Math.tan(fov / 2) * cameraDistance;
        const width = height * this.camera.aspect;
        
        // Scale the plane to cover the entire viewport (with extra margin)
        swooshPlane.scale.set(width * 2, height * 2, 1);
        
        // Position it at the center of the scene (where objects are)
        // This ensures it covers everything when between camera and scene
        swooshPlane.position.set(0, 0, 0);
        
        // Make sure it faces the camera (perpendicular to camera direction)
        swooshPlane.rotation.x = 0;
        swooshPlane.rotation.y = 0;
        swooshPlane.rotation.z = 0;
        
        // Add to scene
        this.scene.add(swooshPlane);
        
        // Animation parameters
        const duration = 2000; // 2 seconds for swoosh effect
        const startTime = Date.now();
        
        // Animation loop - swoosh away
        const animateSwoosh = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out for smooth swoosh)
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            
            // Swoosh from left to right
            // Move plane to the right and fade out
            const swooshDistance = width * 2; // Distance to move off screen (enough to clear view)
            swooshPlane.position.x = easedProgress * swooshDistance;
            
            // Also rotate slightly for more dynamic swoosh effect
            swooshPlane.rotation.z = easedProgress * 0.2; // Slight rotation for swoosh effect
            
            // Fade out opacity as it swooshes away
            swooshMaterial.opacity = 1 - easedProgress;
            
            // Gradually reveal background by moving the plane away
            if (progress < 1) {
                requestAnimationFrame(animateSwoosh);
            } else {
                // Animation complete - remove swoosh plane
                this.scene.remove(swooshPlane);
                swooshGeometry.dispose();
                swooshMaterial.dispose();
                
                // Background is now fully visible
                this.scene.background = this.backgroundTexture;
                this.backgroundEnabled = true;
                
                if (onComplete) onComplete();
            }
        };
        
        animateSwoosh();
    }

    /**
     * Reset butterfly position to original
     */
    resetButterflyPosition() {
        if (!this.model) return;
        // Reset to center (should already be centered from centerModel)
        this.model.position.set(0, 0, 0);
        this.model.rotation.set(0, 0, 0);
    }

    /**
     * Check if background is enabled
     * @returns {boolean} Whether background is enabled
     */
    isBackgroundEnabled() {
        return this.backgroundEnabled;
    }

    /**
     * Render the scene
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

