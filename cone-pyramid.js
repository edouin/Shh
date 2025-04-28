import * as THREE from 'three';

// Initialize the scene, camera and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Create a pyramid (using ConeGeometry with 4 segments for a square base)
const geometry = new THREE.ConeGeometry(1, 2, 4);
const material = new THREE.MeshPhongMaterial({ 
    color: 0xff6600, 
    specular: 0x111111,
    shininess: 30,
    flatShading: true
});
const pyramid = new THREE.Mesh(geometry, material);
scene.add(pyramid);

// Add a grid helper for reference
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

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

// Mouse event handlers
document.addEventListener('mousedown', (event) => {
    isDragging = true;
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
});

document.addEventListener('mousemove', (event) => {
    if (isDragging) {
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };

        // Set rotation velocity based on mouse movement
        rotationVelocity.x = deltaMove.y * rotationSensitivity;
        rotationVelocity.y = deltaMove.x * rotationSensitivity;

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

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
    
    renderer.render(scene, camera);
}

// Start the animation
animate(); 