/**
 * Utility functions for UV mapping, pixel detection, and spatial optimization
 */

import * as THREE from 'three';

/**
 * Convert 3D intersection point to UV coordinates using barycentric interpolation
 * @param {THREE.Intersection} intersection - Raycaster intersection result
 * @param {THREE.Geometry} geometry - Geometry object
 * @returns {Object|null} UV coordinates {u, v} or null if not found
 */
export function getUVFromIntersection(intersection, geometry) {
    // First try to get UV from intersection (most common case - already interpolated by Three.js)
    if (intersection.uv) {
        let u = intersection.uv.x;
        let v = intersection.uv.y;
        
        // DO NOT CLAMP - preserve original UV coordinates
        // The model's UV layout might use multiple islands or extended ranges
        // Clamping causes overlapping and inaccurate mapping for wings
        // UV coordinates will be normalized per mesh in DrawingSystem if needed
        
        return { u, v };
    }
    
    // Fallback: compute UV from geometry attributes using barycentric interpolation
    if (geometry && geometry.attributes && geometry.attributes.uv && intersection.faceIndex !== undefined) {
        const uvAttribute = geometry.attributes.uv;
        const posAttribute = geometry.attributes.position;
        const faceIndex = intersection.faceIndex;
        
        if (uvAttribute && posAttribute && faceIndex >= 0) {
            // For triangular faces, each face has 3 vertices
            const v0 = faceIndex * 3;
            const v1 = v0 + 1;
            const v2 = v0 + 2;
            
            if (v2 < uvAttribute.count && v2 < posAttribute.count) {
                // Get UV coordinates for all 3 vertices
                const uv0 = new THREE.Vector2(uvAttribute.getX(v0), uvAttribute.getY(v0));
                const uv1 = new THREE.Vector2(uvAttribute.getX(v1), uvAttribute.getY(v1));
                const uv2 = new THREE.Vector2(uvAttribute.getX(v2), uvAttribute.getY(v2));
                
                // Get vertex positions for barycentric coordinate calculation
                const p0 = new THREE.Vector3(
                    posAttribute.getX(v0),
                    posAttribute.getY(v0),
                    posAttribute.getZ(v0)
                );
                const p1 = new THREE.Vector3(
                    posAttribute.getX(v1),
                    posAttribute.getY(v1),
                    posAttribute.getZ(v1)
                );
                const p2 = new THREE.Vector3(
                    posAttribute.getX(v2),
                    posAttribute.getY(v2),
                    posAttribute.getZ(v2)
                );
                
                // Get intersection point - it's in world space
                const point = intersection.point;
                
                // Transform vertex positions to world space to match intersection point
                if (intersection.object && intersection.object.matrixWorld) {
                    p0.applyMatrix4(intersection.object.matrixWorld);
                    p1.applyMatrix4(intersection.object.matrixWorld);
                    p2.applyMatrix4(intersection.object.matrixWorld);
                }
                
                // Compute barycentric coordinates
                // Based on the intersection point's position relative to the triangle
                const v0v1 = new THREE.Vector3().subVectors(p1, p0);
                const v0v2 = new THREE.Vector3().subVectors(p2, p0);
                const v0p = new THREE.Vector3().subVectors(point, p0);
                
                const dot00 = v0v2.dot(v0v2);
                const dot01 = v0v2.dot(v0v1);
                const dot02 = v0v2.dot(v0p);
                const dot11 = v0v1.dot(v0v1);
                const dot12 = v0v1.dot(v0p);
                
                const invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
                const baryU = (dot11 * dot02 - dot01 * dot12) * invDenom;
                const baryV = (dot00 * dot12 - dot01 * dot02) * invDenom;
                const baryW = 1 - baryU - baryV;
                
                // Interpolate UV coordinates using barycentric coordinates
                const finalUV = new THREE.Vector2()
                    .addScaledVector(uv0, baryW)
                    .addScaledVector(uv1, baryU)
                    .addScaledVector(uv2, baryV);
                
                // Return interpolated UV (no clamping to preserve original UV layout)
                return { u: finalUV.x, v: finalUV.y };
            }
        }
    }
    
    // No UV coordinates available
    return null;
}

/**
 * Check if a pixel is painted (not white/transparent)
 * @param {ImageData} imageData - Image data from canvas
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Canvas width
 * @returns {boolean} True if pixel is painted
 */
export function isPixelPainted(imageData, x, y, width) {
    const index = (y * width + x) * 4;
    const r = imageData.data[index];
    const g = imageData.data[index + 1];
    const b = imageData.data[index + 2];
    const a = imageData.data[index + 3];

    // Consider white (255,255,255) or transparent (alpha < 10) as unpainted
    const isWhite = r > 250 && g > 250 && b > 250;
    const isTransparent = a < 10;
    
    return !isWhite && !isTransparent;
}

/**
 * Check if two colors are similar (within threshold)
 * @param {Object} color1 - RGB object {r, g, b}
 * @param {Object} color2 - RGB object {r, g, b}
 * @param {number} threshold - Color difference threshold (default: 10)
 * @returns {boolean} True if colors are similar
 */
export function colorsSimilar(color1, color2, threshold = 10) {
    const dr = Math.abs(color1.r - color2.r);
    const dg = Math.abs(color1.g - color2.g);
    const db = Math.abs(color1.b - color2.b);
    return dr < threshold && dg < threshold && db < threshold;
}

/**
 * Spatial hash function for grid-based sampling optimization
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} gridSize - Size of grid cells
 * @returns {string} Hash key
 */
export function spatialHash(x, y, gridSize) {
    const gx = Math.floor(x / gridSize);
    const gy = Math.floor(y / gridSize);
    return `${gx},${gy}`;
}

/**
 * Get grid coordinates from pixel coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} gridSize - Size of grid cells
 * @returns {Object} Grid coordinates {gx, gy}
 */
export function getGridCoords(x, y, gridSize) {
    return {
        gx: Math.floor(x / gridSize),
        gy: Math.floor(y / gridSize)
    };
}

/**
 * Sample pixels in a grid pattern for performance optimization
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} gridSize - Size of grid cells (larger = fewer samples)
 * @returns {Array} Array of sample points {x, y}
 */
export function getGridSamples(width, height, gridSize) {
    const samples = [];
    for (let y = 0; y < height; y += gridSize) {
        for (let x = 0; x < width; x += gridSize) {
            samples.push({ x, y });
        }
    }
    return samples;
}

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color string (#RRGGBB)
 * @returns {Object} RGB object {r, g, b}
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Convert RGB to hex
 * @param {number} r - Red component
 * @param {number} g - Green component
 * @param {number} b - Blue component
 * @returns {string} Hex color string
 */
export function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

