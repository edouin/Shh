# 3D Pyramid with Inertia Rotation

A simple Three.js project featuring a 3D pyramid that can be rotated with mouse interaction and continues to rotate with inertia after releasing the mouse.

## Features

- Two different types of 3D pyramids:
  - Tetrahedron (triangular pyramid)
  - Square-based pyramid (using ConeGeometry)
- Mouse-controlled rotation with inertia effect
- Responsive design adapting to window resizing
- UI controls to switch between pyramid types while preserving rotation

## How to Use

### Option 1: Open directly in browser
1. Open the `index.html` file directly in your browser (may not work in all browsers due to CORS restrictions with ES modules)

### Option 2: Using the Node.js server (recommended)
1. Make sure you have Node.js installed
2. Open a terminal in the project directory
3. Run `node server.js`
4. Open your browser and navigate to `http://localhost:3000`

### Interacting with the Pyramid
1. Click and drag your mouse to rotate the pyramid
2. Release the mouse button and watch the pyramid continue to rotate with gradually decreasing speed (inertia)
3. Use the buttons in the top-left corner to switch between different pyramid types

## Technical Details

- The inertia effect is implemented by tracking mouse movement velocity and applying a damping factor when not actively dragging
- Built with vanilla JavaScript and Three.js library
- Uses ES6 modules for clean code organization
- Preserves rotation state when switching between pyramid types

## Browser Compatibility

This project uses ES6 modules and modern JavaScript features. It works best in recent versions of Chrome, Firefox, Safari, and Edge. 