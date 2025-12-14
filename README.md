<div align="center">

# 🎨 Vlindertuin 3D - Interactive Painting Experience

[![Live Demo](https://img.shields.io/badge/Live%20Demo-becreativeruben.github.io-00D9FF?style=for-the-badge)](https://becreativeruben.github.io/Vlindertuin_3D/)
[![GitHub](https://img.shields.io/badge/GitHub-BeCreativeRuben-000?style=for-the-badge&logo=github)](https://github.com/BeCreativeRuben/Vlindertuin_3D)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<img src="https://media.giphy.com/media/VgCDAzcKvsR6OM0uWM/giphy.gif" width="50" height="50">

**Transform 3D Models into Interactive Canvas | Paint, Animate, Create**

</div>

---

## 🚀 About This Project

```javascript
const vlindertuinExperience = {
    name: "Vlindertuin 3D",
    description: "An immersive WebGL experience where creativity meets technology",
    purpose: "Paint directly on 3D butterfly models and trigger stunning animations",
    
    coreFeatures: [
        "🎨 Real-time 3D painting with interactive brushes",
        "📊 Intelligent progress tracking with pixel-perfect detection",
        "🎬 Dynamic animation system with GLTF support",
        "📱 Full mobile & touch support",
        "⚡ Performance-optimized with advanced graphics techniques"
    ],
    
    techStack: {
        frontend: ["Three.js", "Canvas API", "JavaScript (ES6+)"],
        tools: ["Vite", "Node.js", "GitHub Pages"],
        advanced: ["WebGL", "UV Mapping", "Raycasting", "AnimationMixer"]
    },
    
    targetAudience: ["Art enthusiasts", "Interactive designers", "STEM educators"],
    liveDeployment: "https://becreativeruben.github.io/Vlindertuin_3D/"
};
```

---

## 🎯 What Makes Vlindertuin 3D Special

| Feature | Impact | Status |
|---------|--------|--------|
| **Interactive 3D Painting** | Unique user engagement through WebGL | ✅ Production |
| **Real-time Progress Tracking** | Intelligent pixel sampling algorithm | ✅ Optimized |
| **Animation Triggers** | GLTF + Fallback animations | ✅ Complete |
| **Mobile Responsiveness** | Touch & gesture support | ✅ Full Support |
| **Performance** | 60 FPS target with spatial partitioning | ✅ Optimized |

---

## 🛠️ Tech Arsenal

### Graphics & 3D Magic ✨

![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js)
![WebGL](https://img.shields.io/badge/WebGL-990000?style=for-the-badge&logo=webgl)
![Canvas API](https://img.shields.io/badge/Canvas%20API-FFA500?style=for-the-badge)

### Frontend Framework & Build Tools ⚡

![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)

### Deployment & Hosting 🌍

![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-121013?style=for-the-badge&logo=github&logoColor=white)

---

## 📁 Project Architecture

```
Vlindertuin_3D/
├── 📄 index.html                 # Interactive UI & controls
├── 📦 package.json               # Dependencies & scripts
├── ⚙️  vite.config.js           # Build configuration
│
├── 🎨 src/
│   ├── main.js                   # Application entry point
│   ├── SceneManager.js           # 🎬 Three.js scene orchestration
│   ├── DrawingSystem.js          # 🖌️ Brush & painting engine
│   ├── ProgressTracker.js        # 📊 Completion detection
│   ├── AnimationController.js    # 🎭 Animation orchestration
│   └── utils.js                  # 🔧 Utility functions
│
├── 🎵 styles/
│   └── main.css                  # Modern UI styling
│
├── 🦋 butterflyflutt.glb         # 3D Butterfly Model (GLTF format)
│
└── 📚 README.md                  # This file
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v16 or higher
- **npm** or **yarn** package manager

### Installation & Setup

```bash
# 1️⃣ Clone the repository
git clone https://github.com/BeCreativeRuben/Vlindertuin_3D.git
cd Vlindertuin_3D

# 2️⃣ Install dependencies
npm install

# 3️⃣ Start development server
npm run dev

# 4️⃣ Open in browser
# Visit: http://localhost:5173
```

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

---

## 🎮 How to Use

### Interactive Controls

1. **🎨 Paint on the Butterfly**
   - Click and drag to paint
   - Adjust brush size with the slider
   - Change colors using the color picker

2. **📊 Track Your Progress**
   - Watch the live progress bar
   - See real-time completion percentage
   - Visual feedback as you paint

3. **🎬 Trigger Animations**
   - Reach 100% completion
   - Watch automatic animations play
   - Smooth transitions and visual effects

4. **🔄 Reset & Start Over**
   - Clear button for new painting session
   - No page reload needed

---

## 💡 Technical Deep Dive

### Core Systems Explained

#### 🎬 SceneManager - The Foundation
- **Manages**: Three.js scene, camera, WebGL renderer
- **Handles**: Model loading (GLB/GLTF), dynamic textures
- **Implements**: 3D raycasting for mouse-to-model intersection
- **Key Technique**: Converts 3D coordinates → UV coordinates

#### 🖌️ DrawingSystem - The Brush Engine
- **Features**: Real-time mouse/touch event handling
- **Algorithm**: Raycasting + UV coordinate conversion
- **Optimization**: Texture update batching
- **Mobile**: Full touch gesture support

#### 📊 ProgressTracker - Smart Detection
- **Algorithm**: Grid-based spatial sampling (8x8 grid)
- **Performance**: Samples every 15 frames (60 FPS target)
- **Accuracy**: Pixel-perfect completion detection
- **Optimization**: Minimal CPU overhead

#### 🎭 AnimationController - Visual Magic
- **GLTF Support**: Loads animations from model files
- **Fallback System**: Programmatic animations (rotation, scale, position)
- **Smooth**: Uses AnimationMixer for frame-perfect timing
- **Customizable**: Easy to modify animation parameters

### Performance Optimizations

```javascript
// Key Optimizations Implemented:
✅ Spatial Partitioning - Grid-based sampling
✅ Frame-based Sampling - Only check every 15 frames
✅ Efficient Texture Updates - Batched updates
✅ Single Raycaster - Reused across frames
✅ Memory Management - Proper cleanup & disposal
```

---

## 🎨 Customization Guide

### Change the 3D Model

```javascript
// In src/main.js:
const gltf = await this.sceneManager.loadModel('/your-model.glb');
```

### Adjust Brush Settings

```html
<!-- In index.html -->
<input type="range" id="brush-size" min="1" max="50" value="10">
<input type="color" id="brush-color" value="#FF6B6B">
```

### Fine-tune Performance

```javascript
// In ProgressTracker.js:
this.sampleInterval = 15;    // Increase for better performance
this.gridSize = 8;           // Adjust sampling grid resolution

// In SceneManager.js:
this.textureSize = 1024;     // Texture resolution (1024 = balanced)
```

---

## 🐛 Troubleshooting

### ❌ Model Not Loading
```
✓ Check if GLB file path is correct
✓ Verify file exists in project root
✓ Check browser console (F12) for error messages
✓ Ensure file is in GLTF/GLB format
```

### ❌ Performance Issues
```
✓ Reduce texture size in SceneManager.js
✓ Increase sampleInterval in ProgressTracker.js
✓ Increase gridSize for fewer samples
✓ Check GPU/CPU usage in DevTools
```

### ❌ Touch Events Not Working
```
✓ Verify touch event listeners are active
✓ Check mobile browser compatibility
✓ Ensure viewport meta tag is present
✓ Test on actual device (not just emulator)
```

---

## 📊 Project Stats

- **Lines of Code**: 1000+
- **3D Model Size**: Optimized GLB format
- **Performance Target**: 60 FPS (60 fps achievable)
- **Browser Support**: All modern browsers with WebGL
- **Mobile Support**: iOS Safari, Chrome Mobile, Firefox Mobile
- **Deployment**: GitHub Pages (Free hosting)

---

## 🌟 Why This Project Matters

### Problem It Solves
- ❌ Traditional 2D painting is limiting
- ✅ **Solution**: Interactive 3D painting for creative expression

### Innovation Factor
- 🎨 Unique combination of WebGL + User interaction
- 🚀 Real-world application of advanced graphics techniques
- 💡 Shows deep understanding of: 3D graphics, event handling, performance optimization

### Real-World Value
- 🎓 Educational tool for teaching WebGL/Three.js
- 🎨 Base for interactive art installations
- 🏢 Portfolio showcase of technical capabilities

---

## 📚 Learning Resources Used

- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Web APIs - Raycasting](https://developer.mozilla.org/en-US/)

---

## 🤝 Contributing

Want to improve Vlindertuin 3D? Contributions welcome!

```bash
# 1. Fork the repository
# 2. Create feature branch (git checkout -b feature/AmazingFeature)
# 3. Commit changes (git commit -m 'Add some AmazingFeature')
# 4. Push to branch (git push origin feature/AmazingFeature)
# 5. Open Pull Request
```

### Potential Enhancements
- [ ] Multiple model presets
- [ ] Color palette presets
- [ ] Undo/redo functionality
- [ ] Social sharing (screenshot feature)
- [ ] Advanced brush types (splatter, gradient)
- [ ] Music/audio integration
- [ ] Multiplayer painting sessions

---

## 📜 License

MIT License - feel free to use in your projects!

---

## 🎓 About the Creator

**Ruben** - Creative Technologist & Web Developer
- 🎨 Specializing in 3D web experiences
- 🚀 MERN Stack & Creative Automation
- 💼 Building innovative digital solutions
- 🌍 Based in Belgium 🇧🇪

### Connect With Me

[![GitHub](https://img.shields.io/badge/GitHub-BeCreativeRuben-000?style=for-the-badge&logo=github)](https://github.com/BeCreativeRuben)
[![Portfolio](https://img.shields.io/badge/Portfolio-Visit%20Now-FF6B6B?style=for-the-badge)](https://becreativeruben.github.io/Vlindertuin_3D/)
[![Twitter](https://img.shields.io/badge/Twitter-Follow-1DA1F2?style=for-the-badge&logo=twitter)](https://twitter.com)
[![Email](https://img.shields.io/badge/Email-Contact-EA4335?style=for-the-badge&logo=gmail)](mailto:your-email@example.com)

---

## 💭 Closing Thought

> *"The intersection of art and technology is where true creativity lives."*

This project demonstrates that web development isn't just about functionality—it's about creating **memorable, interactive experiences** that inspire and engage users.

---

<div align="center">

⭐ **If you found this project interesting, please consider giving it a star!** ⭐

*Last Updated: December 2025*

</div>
