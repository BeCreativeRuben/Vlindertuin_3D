import * as THREE from 'three';
import { getUVFromIntersection } from './utils.js';

/**
 * Handles drawing/painting on the 3D model using mouse/touch input
 */
export class DrawingSystem {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.canvas = sceneManager.canvas;
        this.raycaster = sceneManager.getRaycaster();
        this.scene = sceneManager.getScene();
        this.camera = sceneManager.getCamera();
        this.textureCanvas = sceneManager.getTextureCanvas();
        this.texture = sceneManager.getTexture();
        
        this.isEnabled = false;
        this.isDrawing = false;
        this.brushSize = 10;
        this.brushColor = '#ff4444'; // Default to first color in palette (red)
        this.lastUV = null; // Store last UV position for continuous strokes
        this.lastMesh = null; // Store last mesh for stroke continuity
        this.debugMode = false; // Debug mode flag
        this.meshUVBounds = new Map(); // Cache UV bounds per mesh for normalization
        
        // Undo/Redo history
        this.history = []; // Array of ImageData snapshots
        this.historyIndex = -1; // Current position in history
        this.maxHistorySize = 50; // Maximum number of undo states
        this.onHistoryChange = null; // Callback when history changes
        
        this.setupEventListeners();
    }

    /**
     * Setup mouse and touch event listeners
     */
    setupEventListeners() {
        // Mouse events - only left mouse button for drawing
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Only left mouse button
                this.onPointerDown(e);
            }
        });
        this.canvas.addEventListener('mousemove', (e) => {
            this.onPointerMove(e);
            // Always update debug info on mouse move (even when not drawing)
            if (this.debugMode && !this.isDrawing) {
                this.updateDebugInfoOnMove(e);
            }
        });
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Only left mouse button
                this.onPointerUp();
            }
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.onPointerUp();
            // Clear debug info when mouse leaves canvas
            if (this.debugMode) {
                this.clearDebugInfo();
            }
        });

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.onPointerDown(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.onPointerMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.onPointerUp();
        });
        this.canvas.addEventListener('touchcancel', () => {
            this.onPointerUp();
        });
    }

    /**
     * Handle pointer down event
     * @param {MouseEvent|Touch} event - Pointer event
     */
    onPointerDown(event) {
        if (!this.isEnabled) return;
        
        // Save state before starting new stroke
        if (!this.isDrawing) {
            this.saveState();
        }
        
        this.isDrawing = true;
        this.lastUV = null; // Reset last position
        this.lastMesh = null; // Reset last mesh
        this.drawAtEvent(event);
    }

    /**
     * Handle pointer move event
     * @param {MouseEvent|Touch} event - Pointer event
     */
    onPointerMove(event) {
        if (!this.isEnabled || !this.isDrawing) return;
        
        this.drawAtEvent(event);
    }

    /**
     * Handle pointer up event
     */
    onPointerUp() {
        this.isDrawing = false;
        this.lastUV = null; // Reset last position
        this.lastMesh = null; // Reset last mesh
    }

    /**
     * Draw at the event position
     * @param {MouseEvent|Touch} event - Pointer event
     */
    drawAtEvent(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update raycaster - ensure it can hit all surfaces
        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
        this.raycaster.layers.set(0); // Ensure raycaster uses default layer
        this.raycaster.params.Points = { threshold: 0.1 }; // Don't intersect points
        this.raycaster.params.Line = { threshold: 0.1 }; // Don't intersect lines

        // Get the model from scene manager
        const model = this.sceneManager.getModel();
        
        // Collect all meshes for comprehensive raycasting
        // Include ALL object types that might have geometry
        const allMeshes = [];
        if (model) {
            model.traverse((child) => {
                // Check for any mesh type
                if (child instanceof THREE.Mesh || 
                    child instanceof THREE.SkinnedMesh ||
                    child instanceof THREE.InstancedMesh) {
                    if (child.visible && child.geometry) {
                        allMeshes.push(child);
                    }
                }
                // Also check for objects with geometry that might not be proper mesh types
                else if (child.geometry && child.isObject3D && child.visible) {
                    // Ensure it can be raycasted
                    if (typeof child.raycast === 'function') {
                        allMeshes.push(child);
                    }
                }
            });
        }
        
        // Find intersections - try all meshes first for better coverage
        let intersects = [];
        if (allMeshes.length > 0) {
            intersects = this.raycaster.intersectObjects(allMeshes, false); // false = don't recurse (already collected)
        }
        
        // Fallback: try model recursively if no intersections found
        if (intersects.length === 0 && model) {
            intersects = this.raycaster.intersectObject(model, true);
        }
        
        // Final fallback: try all scene children
        if (intersects.length === 0) {
            intersects = this.raycaster.intersectObjects(this.scene.children, true);
        }

        if (intersects.length > 0) {
            // Filter out intersections that are too far away (likely background)
            // Try to use intersections even without UV - we can generate them
            const validIntersects = intersects.filter(intersect => {
                if (intersect.distance >= 1000) return false;
                // Allow intersections without UV - we'll try to generate them
                return true;
            });
            
            if (validIntersects.length > 0) {
                const intersection = validIntersects[0];
                
                // Debug information - show all intersections
                if (this.debugMode) {
                    this.updateDebugInfo(intersection, x, y, intersects);
                }
                
                this.drawAtIntersection(intersection);
            } else if (this.debugMode) {
                console.log('All intersections too far or missing UV:', intersects);
                // Show canvas coordinates even when no valid intersection
                this.updateDebugInfoNoIntersection(x, y);
            }
        } else {
            // No intersection found - reset lastUV to prevent unwanted lines
            this.lastUV = null;
            this.lastMesh = null;
            
            if (this.debugMode) {
                // Log debug info when no intersection found
                console.log('No intersections found at:', x, y);
                console.log('Model:', model);
                console.log('All meshes found:', allMeshes.length);
                console.log('Scene children:', this.scene.children);
                // Show canvas coordinates even when no intersection
                this.updateDebugInfoNoIntersection(x, y);
            }
        }
    }

    /**
     * Generate UV coordinates from intersection when none are available
     * @param {THREE.Intersection} intersection - Raycaster intersection
     * @returns {Object|null} UV coordinates {u, v} or null
     */
    generateUVFromIntersection(intersection) {
        const geometry = intersection.object.geometry;
        if (!geometry || !geometry.attributes.position) {
            return null;
        }
        
        // Get the intersection point
        const point = intersection.point;
        
        // Transform to local space if needed
        let localPoint = point.clone();
        if (intersection.object.matrixWorld) {
            const invMatrix = new THREE.Matrix4().copy(intersection.object.matrixWorld).invert();
            localPoint.applyMatrix4(invMatrix);
        }
        
        // Compute bounding box if not available
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        
        const box = geometry.boundingBox;
        if (!box) return null;
        
        const size = box.max.clone().sub(box.min);
        
        // Generate planar UV mapping based on bounding box
        const u = size.x > 0.0001 ? (localPoint.x - box.min.x) / size.x : 0.5;
        const v = size.y > 0.0001 ? (localPoint.y - box.min.y) / size.y : 0.5;
        
        return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
    }

    /**
     * Get UV bounds for a mesh (cached for performance)
     * @param {THREE.Mesh} mesh - Mesh to get UV bounds for
     * @returns {Object|null} UV bounds {minU, maxU, minV, maxV} or null
     */
    getMeshUVBounds(mesh) {
        if (!mesh || !mesh.geometry) return null;
        
        // Check cache first
        if (this.meshUVBounds.has(mesh)) {
            return this.meshUVBounds.get(mesh);
        }
        
        const uvAttribute = mesh.geometry.attributes.uv;
        if (!uvAttribute || uvAttribute.count === 0) {
            return null;
        }
        
        // Calculate UV bounds
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        
        for (let i = 0; i < uvAttribute.count; i++) {
            const u = uvAttribute.getX(i);
            const v = uvAttribute.getY(i);
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, v);
            maxV = Math.max(maxV, v);
        }
        
        const bounds = { minU, maxU, minV, maxV };
        this.meshUVBounds.set(mesh, bounds);
        
        if (this.debugMode && (minU < 0 || maxU > 1 || minV < 0 || maxV > 1)) {
            console.log(`Mesh "${mesh.name || 'unnamed'}" has extended UV range:`, bounds);
        }
        
        return bounds;
    }

    /**
     * Normalize UV coordinates based on mesh-specific UV bounds
     * @param {Object} uv - UV coordinates {u, v}
     * @param {THREE.Mesh} mesh - Mesh to normalize for
     * @returns {Object} Normalized UV coordinates {u, v} in 0-1 range
     */
    normalizeUVForMesh(uv, mesh) {
        const bounds = this.getMeshUVBounds(mesh);
        
        if (!bounds) {
            // No bounds available - use modulo to wrap UV coordinates
            // But also allow slightly outside 0-1 range to catch edge cases
            let wrappedU = ((uv.u % 1) + 1) % 1;
            let wrappedV = ((uv.v % 1) + 1) % 1;
            
            // Allow small overflow (5% margin) to catch edge pixels
            return {
                u: Math.max(-0.05, Math.min(1.05, wrappedU)),
                v: Math.max(-0.05, Math.min(1.05, wrappedV))
            };
        }
        
        const uRange = bounds.maxU - bounds.minU;
        const vRange = bounds.maxV - bounds.minV;
        
        // Normalize to 0-1 based on this mesh's UV range
        let normalizedU = uRange > 0.0001 ? (uv.u - bounds.minU) / uRange : 0.5;
        let normalizedV = vRange > 0.0001 ? (uv.v - bounds.minV) / vRange : 0.5;
        
        // Allow small overflow (5% margin) to catch edge pixels and ensure full coverage
        normalizedU = Math.max(-0.05, Math.min(1.05, normalizedU));
        normalizedV = Math.max(-0.05, Math.min(1.05, normalizedV));
        
        return { u: normalizedU, v: normalizedV };
    }

    /**
     * Draw at the intersection point
     * @param {THREE.Intersection} intersection - Raycaster intersection
     */
    drawAtIntersection(intersection) {
        let uv = getUVFromIntersection(intersection, intersection.object.geometry);
        
        // If no UV found, try to generate it from geometry
        if (!uv && intersection.object.geometry) {
            uv = this.generateUVFromIntersection(intersection);
        }
        
        if (!uv || !this.textureCanvas) {
            if (this.debugMode) {
                console.log('⚠️ Could not get UV coordinates for intersection:', intersection);
            }
            return;
        }

        // Check if we switched meshes - if so, reset lastUV to prevent unwanted lines
        const currentMesh = intersection.object;
        if (this.lastMesh && this.lastMesh !== currentMesh) {
            // Different mesh - don't draw line between meshes, just draw at current position
            this.lastUV = null;
        }

        // Normalize UV coordinates based on mesh-specific UV bounds
        // This handles extended UV ranges and multiple UV islands correctly
        const normalizedUV = this.normalizeUVForMesh(uv, currentMesh);

        // Convert normalized UV to canvas coordinates
        // Clamp to canvas bounds to ensure we stay within texture
        let canvasX = normalizedUV.u * this.textureCanvas.width;
        let canvasY = (1 - normalizedUV.v) * this.textureCanvas.height; // Flip Y
        
        // Clamp to canvas bounds (with small margin for edge cases)
        canvasX = Math.max(0, Math.min(this.textureCanvas.width, canvasX));
        canvasY = Math.max(0, Math.min(this.textureCanvas.height, canvasY));

        // Draw on texture canvas
        const ctx = this.textureCanvas.getContext('2d');
        
        // Configure canvas for smooth, accurate drawing
        ctx.fillStyle = this.brushColor;
        ctx.strokeStyle = this.brushColor;
        ctx.lineWidth = this.brushSize * 2; // Line width matches brush diameter
        ctx.lineCap = 'round'; // Round line caps for smooth strokes
        ctx.lineJoin = 'round'; // Round line joins for smooth connections
        
        // If we have a last position on the same mesh, draw a line between them for continuous strokes
        if (this.lastUV && this.lastMesh === currentMesh) {
            // Normalize last UV as well for consistency
            const lastNormalizedUV = this.normalizeUVForMesh(this.lastUV, currentMesh);
            const lastX = lastNormalizedUV.u * this.textureCanvas.width;
            const lastY = (1 - lastNormalizedUV.v) * this.textureCanvas.height;
            
            // Calculate distance in both UV space and canvas space
            const dx = canvasX - lastX;
            const dy = canvasY - lastY;
            const canvasDistance = Math.sqrt(dx * dx + dy * dy);
            
            // Also check UV distance in normalized space (0-1 range)
            const duv = normalizedUV.u - lastNormalizedUV.u;
            const dvv = normalizedUV.v - lastNormalizedUV.v;
            const uvDistance = Math.sqrt(duv * duv + dvv * dvv);
            
            // Very restrictive thresholds to prevent huge jumps
            // Canvas distance: max 2x brush size (prevents large jumps on canvas)
            // UV distance: max 0.05 (5% of UV space) - prevents jumps between different UV areas
            const maxCanvasDistance = this.brushSize * 2;
            const maxUVDistance = 0.05;
            
            if (canvasDistance < maxCanvasDistance && uvDistance < maxUVDistance) {
                // Draw a smooth line connecting the last point to the current point
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(canvasX, canvasY);
                ctx.stroke();
            } else {
                // Large jump detected - use "backtracking" interpolation to fill the gap
                // Only interpolate if we're still on the same mesh (same UV island)
                if (this.lastMesh === currentMesh) {
                    if (this.debugMode) {
                        console.log('⚠️ Large jump detected - using backtracking interpolation:');
                        console.log(`  Canvas distance: ${canvasDistance.toFixed(1)}px (max: ${maxCanvasDistance.toFixed(1)}px)`);
                        console.log(`  UV distance: ${uvDistance.toFixed(4)} (max: ${maxUVDistance})`);
                        console.log(`  Same mesh: ${currentMesh.name || 'unnamed'}`);
                    }
                    
                    // Calculate number of interpolation steps based on distance
                    // More steps for larger distances to ensure good coverage
                    // Use smaller steps for better coverage (0.5x brush size = tighter spacing)
                    const steps = Math.max(2, Math.ceil(canvasDistance / (this.brushSize * 0.5)));
                    
                    if (this.debugMode) {
                        console.log(`  Interpolating with ${steps} steps`);
                    }
                    
                    // Interpolate between last and current point
                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps; // Interpolation factor (0 to 1)
                        
                        // Linear interpolation in canvas space
                        const interpX = lastX + (canvasX - lastX) * t;
                        const interpY = lastY + (canvasY - lastY) * t;
                        
                        // Draw circle at interpolated position
                        ctx.beginPath();
                        ctx.arc(interpX, interpY, this.brushSize, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    
                    // Also draw a line for smoother coverage
                    ctx.beginPath();
                    ctx.moveTo(lastX, lastY);
                    ctx.lineTo(canvasX, canvasY);
                    ctx.stroke();
                } else {
                    // Different mesh - don't interpolate, just reset
                    if (this.debugMode) {
                        console.log('⚠️ Large jump detected - different mesh, resetting stroke');
                    }
                    this.lastUV = null;
                    this.lastMesh = null;
                }
            }
            
            // Always draw a circle at the current position to ensure full coverage
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, this.brushSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Also fill nearby pixels with a smaller brush to ensure coverage
            // This helps catch edge cases and small gaps
            if (this.brushSize > 3) {
                const expandSize = Math.max(1, this.brushSize * 0.3);
                ctx.beginPath();
                ctx.arc(canvasX, canvasY, expandSize, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // First point or different mesh - draw a circle at exact position
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, this.brushSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Also fill nearby pixels with a smaller brush to ensure coverage
            if (this.brushSize > 3) {
                const expandSize = Math.max(1, this.brushSize * 0.3);
                ctx.beginPath();
                ctx.arc(canvasX, canvasY, expandSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Store current UV and mesh for next point
        this.lastUV = uv;
        this.lastMesh = currentMesh;

        // Update texture
        this.sceneManager.updateTexture();
    }

    /**
     * Set brush size
     * @param {number} size - Brush size in pixels
     */
    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(50, size));
    }

    /**
     * Set brush color
     * @param {string} color - Color in hex format (#RRGGBB)
     */
    setBrushColor(color) {
        this.brushColor = color;
    }

    /**
     * Enable drawing
     */
    enable() {
        this.isEnabled = true;
        this.canvas.style.cursor = 'crosshair';
    }

    /**
     * Disable drawing
     */
    disable() {
        this.isEnabled = false;
        this.canvas.style.cursor = 'default';
        this.isDrawing = false;
    }

    /**
     * Reset the texture canvas (clear all drawings)
     */
    reset() {
        if (!this.textureCanvas) return;

        // Save state before reset
        this.saveState();

        const ctx = this.textureCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
        this.sceneManager.updateTexture();
    }

    /**
     * Fill the entire texture canvas with the current brush color
     */
    fill() {
        if (!this.textureCanvas) return;

        // Save state before filling
        this.saveState();

        const ctx = this.textureCanvas.getContext('2d');
        ctx.fillStyle = this.brushColor;
        ctx.fillRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
        this.sceneManager.updateTexture();
        
        console.log('Filled texture canvas with color:', this.brushColor);
    }

    /**
     * Save current canvas state to history
     */
    saveState() {
        if (!this.textureCanvas) return;
        
        const ctx = this.textureCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, this.textureCanvas.width, this.textureCanvas.height);
        
        // Verwijder redo history als we een nieuwe actie maken
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Voeg nieuwe state toe
        this.history.push(imageData);
        this.historyIndex++;
        
        // Beperk history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.historyIndex--;
        }
        
        // Trigger callback if set
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
    }

    /**
     * Undo last drawing action
     * @returns {boolean} True if undo was successful
     */
    undo() {
        if (this.historyIndex <= 0) {
            // Geen undo mogelijk - reset naar initiële state
            if (this.textureCanvas) {
                const ctx = this.textureCanvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
                this.sceneManager.updateTexture();
            }
            this.historyIndex = -1;
            this.history = [];
            return false;
        }
        
        this.historyIndex--;
        this.restoreState(this.history[this.historyIndex]);
        
        // Trigger callback if set
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
        
        return true;
    }

    /**
     * Redo last undone action
     * @returns {boolean} True if redo was successful
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) {
            return false; // Geen redo mogelijk
        }
        
        this.historyIndex++;
        this.restoreState(this.history[this.historyIndex]);
        
        // Trigger callback if set
        if (this.onHistoryChange) {
            this.onHistoryChange();
        }
        
        return true;
    }

    /**
     * Restore canvas state from ImageData
     * @param {ImageData} imageData - ImageData to restore
     */
    restoreState(imageData) {
        if (!this.textureCanvas || !imageData) return;
        
        const ctx = this.textureCanvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        this.sceneManager.updateTexture();
        
        // Update progress
        if (this.sceneManager.progressTracker) {
            this.sceneManager.progressTracker.update();
        }
    }

    /**
     * Check if undo is available
     * @returns {boolean} True if undo is available
     */
    canUndo() {
        return this.historyIndex > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean} True if redo is available
     */
    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    /**
     * Update debug information display
     * @param {THREE.Intersection} intersection - Raycaster intersection
     * @param {number} ndcX - Normalized device X coordinate
     * @param {number} ndcY - Normalized device Y coordinate
     * @param {Array} allIntersections - All intersections found (for debugging)
     */
    updateDebugInfo(intersection, ndcX, ndcY, allIntersections = []) {
        const meshName = intersection.object.name || intersection.object.type || 'Unknown';
        const uv = intersection.uv ? {
            u: intersection.uv.x,
            v: intersection.uv.y
        } : null;
        
        const uvDisplay = uv ? `U: ${uv.u.toFixed(4)}, V: ${uv.v.toFixed(4)}` : 'No UV';
        const canvasX = uv ? (uv.u * this.textureCanvas.width).toFixed(1) : '-';
        const canvasY = uv ? ((1 - uv.v) * this.textureCanvas.height).toFixed(1) : '-';
        
        const point = intersection.point;
        const distance = intersection.distance.toFixed(3);
        
        // Update overlay
        const debugIntersectionsEl = document.getElementById('debug-intersections');
        const debugMeshEl = document.getElementById('debug-mesh');
        const debugUVEl = document.getElementById('debug-uv');
        const debugCanvasEl = document.getElementById('debug-canvas');
        const debug3DEl = document.getElementById('debug-3d');
        const debugDistanceEl = document.getElementById('debug-distance');
        const debugStatusEl = document.getElementById('debug-status-text');
        
        // Calculate jump distance if we have a last UV
        let jumpInfo = '';
        if (this.lastUV && this.lastMesh === intersection.object) {
            const duv = uv.u - this.lastUV.u;
            const dvv = uv.v - this.lastUV.v;
            const uvDistance = Math.sqrt(duv * duv + dvv * dvv);
            const maxUVDistance = 0.05;
            if (uvDistance >= maxUVDistance) {
                jumpInfo = ` (JUMP: ${uvDistance.toFixed(3)} > ${maxUVDistance})`;
            }
        }
        
        if (debugIntersectionsEl) debugIntersectionsEl.textContent = `${allIntersections.length} found`;
        if (debugMeshEl) debugMeshEl.textContent = meshName;
        if (debugUVEl) debugUVEl.textContent = uvDisplay + jumpInfo;
        if (debugCanvasEl) debugCanvasEl.textContent = `X: ${canvasX}, Y: ${canvasY}`;
        if (debug3DEl) debug3DEl.textContent = `(${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})`;
        if (debugDistanceEl) debugDistanceEl.textContent = `${distance} units`;
        if (debugStatusEl) {
            debugStatusEl.textContent = jumpInfo ? 'JUMP DETECTED' : 'OK';
            debugStatusEl.style.color = jumpInfo ? '#ff6b6b' : '#4ecdc4';
        }
        
        // Console logging
        console.log('=== Drawing Debug Info ===');
        console.log('Total intersections found:', allIntersections.length);
        if (allIntersections.length > 1) {
            console.log('All intersections:', allIntersections.map((int, i) => ({
                index: i,
                mesh: int.object.name || int.object.type,
                distance: int.distance.toFixed(3),
                hasUV: !!int.uv
            })));
        }
        console.log('Selected Mesh:', meshName);
        console.log('UV Coordinates:', uv ? `U: ${uv.u.toFixed(4)}, V: ${uv.v.toFixed(4)}` : 'No UV');
        console.log('Canvas Coordinates:', `(${canvasX}, ${canvasY})`);
        console.log('3D Position:', point);
        console.log('Distance:', distance);
        console.log('NDC Coordinates:', `(${ndcX.toFixed(4)}, ${ndcY.toFixed(4)})`);
        console.log('Intersection Object:', intersection.object);
        console.log('========================');
    }

    /**
     * Update debug info on mouse move (when not drawing)
     * @param {MouseEvent} event - Mouse event
     */
    updateDebugInfoOnMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Check if there's an intersection (but don't draw)
        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
        
        const model = this.sceneManager.getModel();
        const allMeshes = [];
        if (model) {
            model.traverse((child) => {
                if (child instanceof THREE.Mesh || 
                    child instanceof THREE.SkinnedMesh ||
                    child instanceof THREE.InstancedMesh) {
                    if (child.visible && child.geometry) {
                        allMeshes.push(child);
                    }
                } else if (child.geometry && child.isObject3D && child.visible) {
                    if (typeof child.raycast === 'function') {
                        allMeshes.push(child);
                    }
                }
            });
        }
        
        let intersects = [];
        if (allMeshes.length > 0) {
            intersects = this.raycaster.intersectObjects(allMeshes, false);
        }
        if (intersects.length === 0 && model) {
            intersects = this.raycaster.intersectObject(model, true);
        }
        
        // If intersection found, show full debug info, otherwise show canvas coords
        if (intersects.length > 0) {
            const validIntersects = intersects.filter(intersect => intersect.distance < 1000);
            if (validIntersects.length > 0) {
                this.updateDebugInfo(validIntersects[0], x, y, intersects);
            } else {
                this.updateDebugInfoNoIntersection(x, y);
            }
        } else {
            this.updateDebugInfoNoIntersection(x, y);
        }
    }

    /**
     * Update debug info when there's no intersection (show canvas coordinates)
     * @param {number} ndcX - Normalized device X coordinate
     * @param {number} ndcY - Normalized device Y coordinate
     */
    updateDebugInfoNoIntersection(ndcX, ndcY) {
        // Convert NDC coordinates to screen pixel coordinates
        const rect = this.canvas.getBoundingClientRect();
        const screenX = ((ndcX + 1) / 2) * rect.width;
        const screenY = ((1 - ndcY) / 2) * rect.height;
        
        // Try to get 3D world position from raycaster (even without intersection)
        // Create a ray and get point at a certain distance
        const raycaster = this.raycaster;
        const camera = this.camera;
        
        // Calculate 3D position at a fixed distance (e.g., where the model center is)
        const ray = new THREE.Ray();
        ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        
        // Get point at a reasonable distance (e.g., where the model is)
        const model = this.sceneManager.getModel();
        let distance = 5; // Default distance
        if (model) {
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            distance = center.length();
        }
        
        const worldPoint = ray.origin.clone().add(ray.direction.clone().multiplyScalar(distance));
        
        // Update overlay
        const debugIntersectionsEl = document.getElementById('debug-intersections');
        const debugMeshEl = document.getElementById('debug-mesh');
        const debugUVEl = document.getElementById('debug-uv');
        const debugCanvasEl = document.getElementById('debug-canvas');
        const debug3DEl = document.getElementById('debug-3d');
        const debugDistanceEl = document.getElementById('debug-distance');
        const debugStatusEl = document.getElementById('debug-status-text');
        
        if (debugIntersectionsEl) debugIntersectionsEl.textContent = '0 found';
        if (debugMeshEl) debugMeshEl.textContent = 'No intersection';
        if (debugUVEl) debugUVEl.textContent = 'N/A';
        if (debugCanvasEl) debugCanvasEl.textContent = `Screen: (${screenX.toFixed(1)}, ${screenY.toFixed(1)})`;
        if (debug3DEl) debug3DEl.textContent = `(${worldPoint.x.toFixed(2)}, ${worldPoint.y.toFixed(2)}, ${worldPoint.z.toFixed(2)})`;
        if (debugDistanceEl) debugDistanceEl.textContent = `${distance.toFixed(3)} units (estimated)`;
        if (debugStatusEl) {
            debugStatusEl.textContent = 'No intersection - showing screen coords';
            debugStatusEl.style.color = '#ff6b6b';
        }
        
        console.log('=== Debug Info (No Intersection) ===');
        console.log('Screen coordinates:', `(${screenX.toFixed(1)}, ${screenY.toFixed(1)})`);
        console.log('NDC coordinates:', `(${ndcX.toFixed(4)}, ${ndcY.toFixed(4)})`);
        console.log('Estimated 3D world position:', worldPoint);
        console.log('Ray direction:', ray.direction);
        console.log('===================================');
    }

    /**
     * Clear debug information
     */
    clearDebugInfo() {
        // Don't clear - keep showing last known info
        // This way canvas coordinates are always visible
    }

    /**
     * Toggle debug mode
     */
    toggleDebug() {
        this.debugMode = !this.debugMode;
        const overlay = document.getElementById('debug-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !this.debugMode);
        }
        
        if (!this.debugMode) {
            this.clearDebugInfo();
        }
        
        console.log('Debug mode:', this.debugMode ? 'ON' : 'OFF');
    }
}

