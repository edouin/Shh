import * as THREE from 'three';

// Immediate console log to verify script loading
console.log('DEBUG: Script loaded');
console.log('DEBUG: Three.js Version:', THREE.REVISION);

// Initialize the scene, camera and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
console.log('DEBUG: Renderer initialized');

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Create a pyramid (using TetrahedronGeometry)
const geometry = new THREE.TetrahedronGeometry(1);
const material = new THREE.MeshPhongMaterial({ 
    color: 0x00aaff, 
    specular: 0x111111,
    shininess: 30,
    flatShading: true
});
const pyramid = new THREE.Mesh(geometry, material);
scene.add(pyramid);

// Audio setup for drone sound
let audioContext;
let oscillator;
let gainNode;
let isAudioInitialized = false;

// Initialize audio (must be called after user interaction)
function initAudio() {
    if (isAudioInitialized) return;
    
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create oscillator (drone sound)
    oscillator = audioContext.createOscillator();
    oscillator.type = 'sine'; // 'sine', 'square', 'sawtooth', 'triangle'
    oscillator.frequency.value = 50; // Base frequency in Hz (low drone)
    
    // Create gain node for volume control
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0; // Start with no sound
    
    // Connect nodes: oscillator -> gain -> output
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start the oscillator
    oscillator.start();
    isAudioInitialized = true;
}

// Variables for rotation with inertia
let isDragging = false;
let previousMousePosition = {
    x: 0,
    y: 0
};
let rotationVelocity = {
    x: 0,
    y: 0
};
const inertiaFactor = 0.95; // Controls how quickly rotation slows down
const rotationSensitivity = 0.01;

// Add debug overlay with more visible styling
const debugDiv = document.createElement('div');
debugDiv.style.position = 'fixed';
debugDiv.style.bottom = '20px';
debugDiv.style.left = '20px';
debugDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
debugDiv.style.color = '#00ff00';
debugDiv.style.padding = '15px';
debugDiv.style.fontFamily = 'monospace';
debugDiv.style.fontSize = '14px';
debugDiv.style.zIndex = '9999';
debugDiv.style.borderRadius = '5px';
debugDiv.style.maxWidth = '80%';
debugDiv.innerHTML = 'Debug: Initializing...';
document.body.appendChild(debugDiv);
console.log('DEBUG: Debug overlay created');

function updateDebug(message) {
    console.log('DEBUG:', message);
    debugDiv.innerHTML = message;
}

// Mouse and Touch event handlers
function getEventPosition(event) {
    console.log('DEBUG: Getting event position', event.type);
    event.preventDefault();
    const touch = event.touches ? event.touches[0] : event;
    const rect = renderer.domElement.getBoundingClientRect();
    const position = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
    console.log('DEBUG: Position calculated', position);
    updateDebug(`Event: ${event.type}<br>Position - X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}`);
    return position;
}

function handleStart(event) {
    console.log('DEBUG: Touch/Mouse Start', event.type);
    event.preventDefault();
    updateDebug(`Event Start: ${event.type}`);
    
    // Initialize audio on first interaction
    initAudio();
    
    isDragging = true;
    previousMousePosition = getEventPosition(event);
}

function handleMove(event) {
    console.log('DEBUG: Touch/Mouse Move', event.type);
    event.preventDefault();
    if (!isDragging) return;

    const currentPosition = getEventPosition(event);
    const deltaMove = {
        x: currentPosition.x - previousMousePosition.x,
        y: currentPosition.y - previousMousePosition.y
    };

    // Set rotation velocity based on movement
    rotationVelocity.x = deltaMove.y * rotationSensitivity;
    rotationVelocity.y = deltaMove.x * rotationSensitivity;

    console.log('DEBUG: Movement delta', deltaMove);
    updateDebug(`
        Event: ${event.type}<br>
        Delta - X: ${deltaMove.x.toFixed(2)}, Y: ${deltaMove.y.toFixed(2)}<br>
        Velocity - X: ${rotationVelocity.x.toFixed(4)}, Y: ${rotationVelocity.y.toFixed(4)}
    `);

    previousMousePosition = currentPosition;
}

function handleEnd(event) {
    console.log('DEBUG: Touch/Mouse End', event.type);
    if (event) event.preventDefault();
    isDragging = false;
    updateDebug(`Event End: ${event.type}`);
}

// Log when adding event listeners
console.log('DEBUG: Adding event listeners to renderer.domElement');

// Remove any existing event listeners
renderer.domElement.removeEventListener('mousedown', handleStart);
renderer.domElement.removeEventListener('mousemove', handleMove);
renderer.domElement.removeEventListener('mouseup', handleEnd);
renderer.domElement.removeEventListener('touchstart', handleStart);
renderer.domElement.removeEventListener('touchmove', handleMove);
renderer.domElement.removeEventListener('touchend', handleEnd);

// Add event listeners specifically to the canvas element
renderer.domElement.addEventListener('mousedown', handleStart, { passive: false });
renderer.domElement.addEventListener('mousemove', handleMove, { passive: false });
renderer.domElement.addEventListener('mouseup', handleEnd, { passive: false });
renderer.domElement.addEventListener('mouseleave', handleEnd, { passive: false });

renderer.domElement.addEventListener('touchstart', handleStart, { passive: false });
renderer.domElement.addEventListener('touchmove', handleMove, { passive: false });
renderer.domElement.addEventListener('touchend', handleEnd, { passive: false });
renderer.domElement.addEventListener('touchcancel', handleEnd, { passive: false });

console.log('DEBUG: All event listeners added');

// Window resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Apply rotation with inertia
    if (!isDragging) {
        rotationVelocity.x *= inertiaFactor;
        rotationVelocity.y *= inertiaFactor;
    }
    
    pyramid.rotation.x += rotationVelocity.x;
    pyramid.rotation.y += rotationVelocity.y;
    
    // Update debug with current rotation
    updateDebug(`
        Rotation - X: ${pyramid.rotation.x.toFixed(2)}, Y: ${pyramid.rotation.y.toFixed(2)}<br>
        Velocity - X: ${rotationVelocity.x.toFixed(4)}, Y: ${rotationVelocity.y.toFixed(4)}<br>
        Dragging: ${isDragging}
    `);
    
    // Update sound based on rotation speed
    if (isAudioInitialized) {
        // Calculate total rotation speed
        const rotationSpeed = Math.sqrt(
            rotationVelocity.x * rotationVelocity.x + 
            rotationVelocity.y * rotationVelocity.y
        );
        
        // Only play sound if there's significant rotation
        if (rotationSpeed > 0.0001) {
            // Map rotation speed to gain (volume) between 0 and 0.2
            const volume = Math.min(rotationSpeed * 20, 0.2);
            gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.1);
            
            // Map rotation speed to frequency between 50Hz and 200Hz
            const frequency = 50 + rotationSpeed * 1500;
            oscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.1);
        } else {
            // Fade out sound when rotation is very slow
            gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
        }
    }
    
    renderer.render(scene, camera);
}

// Start the animation
animate(); 

// Add a grid helper for reference
const gridHelper = new THREE.GridHelper(10, 10);
gridHelper.visible = false;
scene.add(gridHelper); 