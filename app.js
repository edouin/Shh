import * as THREE from 'three';

console.log('DEBUG: app.js loaded');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
console.log('DEBUG: Scene created');

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
console.log('DEBUG: Camera initialized');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
console.log('DEBUG: Renderer initialized');

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
console.log('DEBUG: Ambient light added');

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);
console.log('DEBUG: Directional light added');

// Add a point light for glass highlights
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(2, 2, 3);
scene.add(pointLight);

// Create Icosahedral Sphere with glass material
const geometry = new THREE.IcosahedronGeometry(1, 1);
const material = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff,
    metalness: 0.1,
    roughness: 0.2,
    transmission: 0.85,
    transparent: true,
    opacity: 0.7,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.0,
    reflectivity: 0.5
});

// Create edges geometry with thicker lines
const edgesGeometry = new THREE.EdgesGeometry(geometry, 15); // Added angle threshold
const edgesMaterial = new THREE.LineBasicMaterial({ 
    color: 0x000000,
    linewidth: 3, // Note: linewidth only works in Firefox
    opacity: 0.5,
    transparent: true
});

// Create multiple edge lines for thicker appearance
const edgeGroup = new THREE.Group();
const edgeOffsets = [0, 0.002, 0.004, 0.006]; // Small offsets for multiple lines

edgeOffsets.forEach(offset => {
    const edgeMesh = new THREE.LineSegments(edgesGeometry, edgesMaterial.clone());
    edgeMesh.scale.setScalar(1 + offset); // Slightly larger for each line
    edgeGroup.add(edgeMesh);
});

// Create the main shape and add edges
const shape = new THREE.Mesh(geometry, material);
shape.add(edgeGroup);
shape.quaternion.copy(new THREE.Quaternion()); // Ensure quaternion is initialized
let currentQuaternion = shape.quaternion.clone();

scene.add(shape);

// Add glow effect
const glowGeometry = new THREE.IcosahedronGeometry(1.8, 1);
const glowMaterial = new THREE.ShaderMaterial({
    uniforms: {
        glowColor: { value: new THREE.Color(0x00aaff) },
        intensity: { value: 0.0 }
    },
    vertexShader: `
        varying vec3 vNormal;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        varying vec3 vNormal;
        void main() {
            float brightness = pow(0.9 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
            gl_FragColor = vec4(glowColor * intensity * brightness, brightness * intensity * 0.8);
        }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
});
const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
scene.add(glowMesh);

// Debug UI
const debugDiv = document.createElement('div');
debugDiv.style.position = 'fixed';
debugDiv.style.bottom = '20px';
debugDiv.style.left = '20px';
debugDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
debugDiv.style.color = '#00ff00';
debugDiv.style.padding = '15px';
debugDiv.style.fontFamily = 'monospace';
debugDiv.style.fontSize = '14px';
debugDiv.style.zIndex = '9999';
debugDiv.style.borderRadius = '5px';
debugDiv.style.pointerEvents = 'none';
document.body.appendChild(debugDiv);

function updateDebug(info) {
    debugDiv.innerHTML = `
        Volume: ${info.volume.toFixed(3)}<br>
        Normalized: ${info.normalizedValue}<br>
        Pulse Intensity: ${info.pulseIntensity}<br>
        Heartbeat: ${info.heartbeatValue}<br>
        Rotation X: ${info.rotationX.toFixed(3)}<br>
        Rotation Y: ${info.rotationY.toFixed(3)}<br>
        Velocity X: ${info.velocityX.toFixed(3)}<br>
        Velocity Y: ${info.velocityY.toFixed(3)}
    `;
}

// Audio setup
let audioContext;
let noiseNode;
let gainNode;
let isAudioInitialized = false;
const MIN_VOLUME = 0.0001;
const MAX_VOLUME = 1.0;
const INITIAL_VOLUME = 0.25; // Volume after fade-in, now 25%
const BASE_HEARTBEAT_VOLUME = 0.05; // Increased for more effect at low volume
const FADE_DURATION = 3;
// Track total rotation for volume and pulse control
let totalRotationX = 0;
let totalRotationY = 0;
let previousRotationX = 0;
let previousRotationY = 0;
const ROTATION_TO_VOLUME_FACTOR = 1 / (10 * 2 * Math.PI);
const ROTATION_TO_PULSE_FACTOR = 1 / (4 * Math.PI); // Faster accumulation for pulse intensity

// Swipe/Drag Interaction Description:
// ---------------------------------------------
// On the splash screen, you can swipe (on touch devices) or drag (with the mouse) right and left to interact with the 3D shape.
// - Swiping or dragging horizontally (left/right) rotates the shape around its vertical axis (Y-axis).
// - The amount of horizontal rotation also controls the intensity of the heartbeat pulse and the brightness of the glow.
// - The more you swipe/drag horizontally, the stronger the heartbeat effect and the brighter the glow.
// - Vertical swipes/drags (up/down) control the white noise volume.
// ---------------------------------------------

// Heartbeat Effect Description:
// ---------------------------------------------
// This visualization includes a "heartbeat" effect that modulates both the white noise volume and the glow brightness of the 3D shape.
// The heartbeat is a rhythmic pulse that makes the noise and glow "beat" in sync, simulating a heartbeat.
// To enable or disable the heartbeat effect programmatically, set the ENABLE_HEARTBEAT constant below to true or false.
// When disabled, the glow and noise remain steady and are not affected by the heartbeat pulse.
// ---------------------------------------------

// Heartbeat enable/disable
const ENABLE_HEARTBEAT = true; // Set to false to disable heartbeat modulation

// Add independent control variables
let verticalValue = 0.25; // -1 (min) to 1 (max), start at 0.25 for initial volume
let horizontalValue = 0;  // -1 (min) to 1 (max), start at 0 for heartbeat
const VALUE_STEP = 0.02; // How much each swipe moves the value

function createWhiteNoise(context) {
    const bufferSize = 2 * context.sampleRate;
    const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    
    const whiteNoise = context.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    return whiteNoise;
}

async function fadeAudioAndVisuals(fadeIn = true) {
    if (!isAudioInitialized) return;

    const startTime = audioContext.currentTime;
    const startVolume = fadeIn ? 0 : gainNode.gain.value;
    const endVolume = fadeIn ? MIN_VOLUME : 0;

    // Use exponential fade for more natural sound transition
    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(startVolume, startTime);
    
    // Prevent zero value for exponentialRampToValueAtTime
    const epsilon = 0.00001;
    if (fadeIn) {
        // Start at 0.01 and gradually fade in over 1 second (was 5 seconds)
        gainNode.gain.setValueAtTime(0.01, startTime);
        gainNode.gain.exponentialRampToValueAtTime(INITIAL_VOLUME, startTime + 1.0); // 1 second fade-in to INITIAL_VOLUME
    } else {
        gainNode.gain.exponentialRampToValueAtTime(epsilon, startTime + FADE_DURATION);
        gainNode.gain.setValueAtTime(0, startTime + FADE_DURATION);
    }

    // Fade visuals
    if (fadeIn) {
        renderer.domElement.classList.add('active');
        document.getElementById('startPrompt').classList.add('hidden');
    } else {
        renderer.domElement.classList.remove('active');
        document.getElementById('startPrompt').classList.remove('hidden');
    }
}

async function stopAudio() {
    if (!isAudioInitialized) return;
    
    await fadeAudioAndVisuals(false);
    
    // After fade out, disconnect and clean up audio nodes
    setTimeout(() => {
        if (noiseNode) {
            noiseNode.stop();
            noiseNode.disconnect();
        }
        if (gainNode) {
            gainNode.disconnect();
        }
        isAudioInitialized = false;
    }, FADE_DURATION * 1000);
}

async function initAudio() {
    if (isAudioInitialized) return;
    
    try {
        const audioContextOptions = {
            sampleRate: 44100,
            latencyHint: 'interactive'
        };

        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            // @ts-ignore
            audioContextOptions.iosLatencyHint = 'playback';
        }
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)(audioContextOptions);
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        noiseNode = createWhiteNoise(audioContext);
        gainNode = audioContext.createGain();
        gainNode.gain.value = 0;

        // Create a compressor for better sound control
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -50;
        compressor.knee.value = 40;
        compressor.ratio.value = 12;
        compressor.attack.value = 0;
        compressor.release.value = 0.25;
        
        // Add a filter to shape the white noise
        const filter = audioContext.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        filter.Q.value = 1;
        
        // Connect nodes with filter
        noiseNode.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(compressor);
        compressor.connect(audioContext.destination);
        
        noiseNode.start();
        isAudioInitialized = true;
        
        await fadeAudioAndVisuals(true);
        
        // Set initial values for decoupled controls
        verticalValue = 0.25; // Start at 25% volume
        horizontalValue = 0;  // Start at center for heartbeat
        console.log('DEBUG: Audio initialized, decoupled controls set.');

    } catch (error) {
        console.log('DEBUG: Audio initialization error:', error);
    }
}

// Touch and mouse variables
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationVelocity = { x: 0, y: 0 };
const rotationSensitivity = 0.01;
const inertiaFactor = 0.95;

// Event handlers
function getEventPosition(event) {
    console.log('DEBUG: Getting event position:', event.type);
    const touch = event.touches ? event.touches[0] : event;
    const rect = renderer.domElement.getBoundingClientRect();
    return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
}

function handleStart(event) {
    console.log('DEBUG: Touch/Mouse Start:', event.type);
    event.preventDefault();
    if (!isAudioInitialized) {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        initAudio().then(() => {
            document.getElementById('startPrompt').classList.add('hidden');
            renderer.domElement.classList.add('active');
        }).catch(error => {
            console.error('Audio initialization error:', error);
        });
    }
    isDragging = true;
    previousMousePosition = getEventPosition(event);
}

function handleMove(event) {
    if (!isDragging) return;
    event.preventDefault();
    const currentPosition = getEventPosition(event);
    const deltaMove = {
        x: currentPosition.x - previousMousePosition.x,
        y: currentPosition.y - previousMousePosition.y
    };
    // Arcball-style: rotate the ball visually
    const angleY = deltaMove.x * rotationSensitivity;
    const angleX = deltaMove.y * rotationSensitivity;
    const qx = new THREE.Quaternion();
    const qy = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
    qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);
    currentQuaternion.premultiply(qy);
    currentQuaternion.premultiply(qx);
    shape.quaternion.copy(currentQuaternion);
    // Set rotationVelocity for inertia
    rotationVelocity.x = angleX;
    rotationVelocity.y = angleY;
    previousMousePosition = currentPosition;
    // Decoupled parameter control
    // Up/down swipes: adjust verticalValue (volume)
    if (Math.abs(deltaMove.y) > Math.abs(deltaMove.x)) {
        verticalValue += -deltaMove.y * VALUE_STEP / 20; // Negative: up increases value
        verticalValue = Math.max(-1, Math.min(1, verticalValue));
    }
    // Left/right swipes: adjust horizontalValue (heartbeat)
    if (Math.abs(deltaMove.x) > Math.abs(deltaMove.y)) {
        horizontalValue += deltaMove.x * VALUE_STEP / 20;
        horizontalValue = Math.max(-1, Math.min(1, horizontalValue));
    }
}

function handleEnd(event) {
    if (event) event.preventDefault();
    isDragging = false;
}

// Add touch event listeners to the entire document for better mobile interaction
document.addEventListener('touchstart', handleStart, { passive: false });
document.addEventListener('touchmove', handleMove, { passive: false });
document.addEventListener('touchend', handleEnd, { passive: false });
document.addEventListener('touchcancel', handleEnd, { passive: false });

// Keep mouse event listeners on the canvas
renderer.domElement.addEventListener('mousedown', handleStart, { passive: false });
renderer.domElement.addEventListener('mousemove', handleMove, { passive: false });
renderer.domElement.addEventListener('mouseup', handleEnd, { passive: false });
renderer.domElement.addEventListener('mouseleave', handleEnd, { passive: false });

console.log('DEBUG: Event listeners added');

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    if (!isDragging) {
        // Inertia: apply a small rotation each frame
        if (Math.abs(rotationVelocity.x) > 0.00001 || Math.abs(rotationVelocity.y) > 0.00001) {
            const qx = new THREE.Quaternion();
            const qy = new THREE.Quaternion();
            qx.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotationVelocity.x);
            qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationVelocity.y);
            currentQuaternion.premultiply(qy);
            currentQuaternion.premultiply(qx);
            shape.quaternion.copy(currentQuaternion);
            rotationVelocity.x *= inertiaFactor;
            rotationVelocity.y *= inertiaFactor;
        }
    }
    glowMesh.quaternion.copy(shape.quaternion);
    
    // Rotate point light slowly around the shape for nice glass effect
    const time = Date.now() * 0.001;
    pointLight.position.x = Math.sin(time * 0.3) * 3;
    pointLight.position.y = Math.cos(time * 0.2) * 2;
    pointLight.position.z = Math.cos(time * 0.3) * 3 + 3;
    
    if (isAudioInitialized) {
        // Use decoupled values for volume and heartbeat
        let normalizedProgress = (verticalValue + 1) / 2; // Map -1..1 to 0..1
        const linearVolume = MAX_VOLUME * normalizedProgress;
        let pulseIntensity = Math.min(1, Math.max(0.25, Math.abs(horizontalValue))); // 0.25 min, 1 max
        // Heartbeat pulse
        const heartbeatPulse = ENABLE_HEARTBEAT ? getHeartbeatPulse(time) * pulseIntensity : 0;
        // Always use base color
        const baseColor = new THREE.Color(0x88ccff);
        material.color.copy(baseColor);
        // At pulseIntensity=1, modulatedVolume goes from 0 to linearVolume; at 0, always linearVolume
        let modulatedVolume = linearVolume * (1 - pulseIntensity * heartbeatPulse);
        // Update volume (main volume is modulated by heartbeat)
        let heartbeatBase = (linearVolume > 0) ? BASE_HEARTBEAT_VOLUME * heartbeatPulse : 0;
        gainNode.gain.setTargetAtTime(modulatedVolume + heartbeatBase, audioContext.currentTime, 0.1);
        // Apply linear scaling to glow intensity
        const MAX_GLOW = 3.0;
        let glowIntensity = MAX_GLOW * Math.pow(normalizedProgress, 0.5); // Gentler ramp
        if (normalizedProgress <= 0) {
             glowIntensity = 0; // Ensure glow is 0 when volume is 0
        }
        // Update glow with linear intensity and add heartbeat pulsing if enabled
        glowMaterial.uniforms.intensity.value = glowIntensity * (1 + heartbeatPulse);
        glowMaterial.uniforms.glowColor.value.copy(material.color);
        material.emissiveIntensity = glowIntensity * 0.3 * (1 + heartbeatPulse);
        material.emissive.copy(material.color);
        // Update debug info
        updateDebug({
            volume: modulatedVolume,
            normalizedValue: normalizedProgress.toFixed(3),
            pulseIntensity: pulseIntensity.toFixed(3),
            heartbeatValue: heartbeatPulse.toFixed(3),
            rotationX: verticalValue,
            rotationY: horizontalValue,
            velocityX: rotationVelocity.x,
            velocityY: rotationVelocity.y
        });
    }
    
    renderer.render(scene, camera);
}

// Window resize handler
window.addEventListener('resize', () => {
    console.log('DEBUG: Window resized');
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();
console.log('DEBUG: Animation started');

// Heartbeat pulse function: returns a value between 0 and 1
function getHeartbeatPulse(time) {
    // 1.2 Hz heartbeat, sharp pulse
    return Math.max(0, Math.sin(2 * Math.PI * 1.2 * time)) ** 2;
} 