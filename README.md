# 3D Model Drawing and Animation System

An interactive web-based experience where users can draw/paint directly on 3D models using Three.js, with real-time progress tracking and animation triggers.

## Features

- 🎨 **Interactive 3D Painting**: Draw directly on 3D models using mouse or touch input
- 📊 **Real-time Progress Tracking**: Monitor painting completion with optimized pixel sampling
- 🎬 **Animation System**: Automatic animation triggers when model is fully painted
  - Supports GLTF animations from model files
  - Programmatic fallback animations (rotation + scale + position)
- 🖌️ **Customizable Brushes**: Adjustable brush size and color
- 📱 **Mobile Support**: Full touch interface support
- 🎯 **Performance Optimized**: Spatial partitioning and frame-based sampling for smooth performance

## Project Structure

```
Vlindertuin_3D/
├── package.json
├── vite.config.js
├── index.html
├── README.md
├── src/
│   ├── main.js                 # Main application entry point
│   ├── SceneManager.js         # Three.js scene, camera, renderer, model loading
│   ├── DrawingSystem.js        # Mouse/touch input and texture painting
│   ├── ProgressTracker.js      # Progress monitoring and completion detection
│   ├── AnimationController.js  # Animation management (GLTF + programmatic)
│   └── utils.js                # Utility functions (UV mapping, pixel detection)
├── styles/
│   └── main.css                # Modern UI styling
└── butterflyflutt.glb          # 3D model file
```

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to the URL shown in the terminal (typically `http://localhost:3000`)

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

Preview the production build:
```bash
npm run preview
```

## Usage

1. **Load the Model**: The 3D model (`butterflyflutt.glb`) will automatically load when the page opens.

2. **Paint on the Model**:
   - Click and drag on the 3D model to paint
   - Adjust brush size using the slider
   - Change brush color using the color picker

3. **Track Progress**: Watch the progress bar to see how much of the model has been painted.

4. **Trigger Animation**: When the model reaches 100% completion, animations will automatically play.

5. **Reset**: Click the "Reset" button to clear all drawings and start over.

## Technical Details

### Core Systems

#### SceneManager
- Manages Three.js scene, camera, and WebGL renderer
- Loads GLB/GLTF models using GLTFLoader
- Creates dynamic textures from HTML5 Canvas
- Handles raycasting for 3D-to-UV coordinate conversion

#### DrawingSystem
- Captures mouse/touch events
- Uses raycasting to find 3D intersections
- Converts intersection points to UV coordinates
- Updates texture canvas with brush strokes
- Real-time texture updates via `texture.needsUpdate = true`

#### ProgressTracker
- Monitors texture canvas pixel data
- Uses grid-based spatial sampling for performance
- Samples pixels every 15 frames (configurable)
- Calculates painted vs total pixels
- Emits progress events for UI updates

#### AnimationController
- Attempts to load GLTF animations from model
- Falls back to programmatic animations:
  - Rotation (Y-axis)
  - Scale (pulse effect)
  - Position (floating/bobbing)
  - X-axis rotation for dynamic effect
- Manages AnimationMixer for GLTF animations

### Performance Optimizations

- **Spatial Partitioning**: Grid-based sampling for progress tracking
- **Frame-based Sampling**: Progress tracking runs every 15 frames, not every frame
- **Efficient Texture Updates**: Only updates texture when changes occur
- **Optimized Raycasting**: Single raycaster instance reused across frames

### Browser Compatibility

- Modern browsers with WebGL support
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- **three** (^0.160.0): Three.js 3D graphics library
- **vite** (^5.0.0): Build tool and development server

## Customization

### Changing the Model

Replace `butterflyflutt.glb` with your own GLB/GLTF model. Update the path in `src/main.js`:

```javascript
const gltf = await this.sceneManager.loadModel('/your-model.glb');
```

### Adjusting Brush Settings

Default brush size range is 1-50. Modify in `index.html`:

```html
<input type="range" id="brush-size" min="1" max="50" value="10">
```

### Customizing Progress Tracking

Adjust sampling interval in `src/ProgressTracker.js`:

```javascript
this.sampleInterval = 15; // Sample every 15 frames
this.gridSize = 8; // Grid size for spatial sampling
```

### Animation Settings

Modify animation duration in `src/AnimationController.js`:

```javascript
this.animationDuration = 3000; // 3 seconds
```

## Troubleshooting

### Model Not Loading
- Ensure the GLB file path is correct
- Check browser console for errors
- Verify the model file is in the correct location

### Performance Issues
- Reduce texture size in `SceneManager.js` (currently 1024x1024)
- Increase `sampleInterval` in `ProgressTracker.js`
- Increase `gridSize` for fewer samples

### Touch Events Not Working
- Ensure touch events are properly prevented from default behavior
- Check mobile browser compatibility

## License

This project is open source and available for personal and commercial use.

## Credits

Built with:
- [Three.js](https://threejs.org/) - 3D graphics library
- [Vite](https://vitejs.dev/) - Build tool

