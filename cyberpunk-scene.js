// This script assumes that THREE is already loaded globally,
// and THREE.DeviceOrientationControls is also available.

// --- Global Variables ---
let scene, camera, renderer;
let cameras = [];
let particles;
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
let frame = 0;
let clock = new THREE.Clock();
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let INTERSECTED;
let controls; // For mobile/orientation controls

// Bubble Variables (UPDATED)
let bubblesMesh;
let bubbleData = [];
// Base the bubble count on environment size and device type
const isMobile = window.innerWidth <= 768;
const BUBBLE_COUNT = isMobile ? 50 : 200; 
const FIELD_SIZE = 100;

// Loading UI Elements (Assumes these IDs exist in the HTML)
const progressBar = document.getElementById('progress');
const loader = document.getElementById('loader');

// --- Initialization ---

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 1, 100);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;
    camera.position.y = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('canvas'),
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(isMobile ? 1 : window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting (Slightly reduced intensity on mobile for performance)
    const ambientLight = new THREE.AmbientLight(0xff0000, isMobile ? 0.1 : 0.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xff0000, isMobile ? 1 : 2, 50);
    pointLight1.position.set(20, 20, 20);
    pointLight1.castShadow = true;
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, isMobile ? 0.5 : 1, 50);
    pointLight2.position.set(-20, 20, -20);
    scene.add(pointLight2);

    // Create 3D Objects
    createCameras(isMobile ? 3 : 5);
    createParticles(isMobile ? 1000 : 2000);
    createEnvironment();
    createGrid();
    
    // NEW: Create Bubbles
    createBubbles();

    // Setup Controls
    if (isMobile) {
        controls = new THREE.DeviceOrientationControls(camera);
        document.addEventListener('touchstart', onTouchStart, false);
        document.addEventListener('touchmove', onTouchMove, false);
    } else {
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('wheel', onWheel);
    }

    // Shared Event Listeners
    document.addEventListener('click', onClick);
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);

    // Start animation
    simulateLoading();
}

// --- Helper Functions (createCameras, createParticles, createEnvironment, createGrid, createExplosion unchanged) ---

function createCameras(count) {
    const cameraGeometry = new THREE.Group();
    // Camera body
    const bodyGeometry = new THREE.BoxGeometry(4, 3, 3);
    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        emissive: 0xff0000,
        emissiveIntensity: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    cameraGeometry.add(body);
    // Lens
    const lensGeometry = new THREE.CylinderGeometry(1.5, 1.2, 2, 32);
    const lensMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000,
        emissive: 0xff0000,
        emissiveIntensity: 0.2,
        shininess: 100
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.rotation.z = Math.PI / 2;
    lens.position.z = 2;
    cameraGeometry.add(lens);
    // Inner lens
    const innerLensGeometry = new THREE.CircleGeometry(1, 32);
    const innerLensMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        opacity: 0.5,
        transparent: true
    });
    const innerLens = new THREE.Mesh(innerLensGeometry, innerLensMaterial);
    innerLens.position.z = 3;
    cameraGeometry.add(innerLens);
    // Flash
    const flashGeometry = new THREE.BoxGeometry(1, 0.8, 0.5);
    const flashMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.3
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.set(1.8, 1.8, 0);
    cameraGeometry.add(flash);
    // Create multiple cameras
    for (let i = 0; i < count; i++) {
        const cam = cameraGeometry.clone();
        cam.position.set(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 20 + 10,
            (Math.random() - 0.5) * 40
        );
        cam.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        cam.userData = {
            floatSpeed: Math.random() * 0.5 + 0.5,
            rotationSpeed: Math.random() * 0.01 + 0.005,
            originalY: cam.position.y
        };
        cameras.push(cam);
        scene.add(cam);
    }
}

function createParticles(count) {
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = count;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 100;
        positions[i + 1] = (Math.random() - 0.5) * 100;
        positions[i + 2] = (Math.random() - 0.5) * 100;

        const isRed = Math.random() > 0.5;
        colors[i] = isRed ? 1 : 0.2;
        colors[i + 1] = 0;
        colors[i + 2] = 0;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);
}

function createEnvironment() {
    const shapes = [];

    // Octahedron
    const octGeometry = new THREE.OctahedronGeometry(3, 0);
    const octMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    const octahedron = new THREE.Mesh(octGeometry, octMaterial);
    octahedron.position.set(20, 10, -20);
    scene.add(octahedron);
    shapes.push(octahedron);

    // Torus
    const torusGeometry = new THREE.TorusGeometry(5, 1, 16, 100);
    const torusMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000,
        emissive: 0xff0000,
        emissiveIntensity: 0.1,
        shininess: 100
    });
    const torus = new THREE.Mesh(torusGeometry, torusMaterial);
    torus.position.set(-20, 5, 15);
    scene.add(torus);
    shapes.push(torus);

    // Icosahedron
    const icoGeometry = new THREE.IcosahedronGeometry(2, 0);
    const icoMaterial = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        emissive: 0xff0000,
        emissiveIntensity: 0.2
    });
    const icosahedron = new THREE.Mesh(icoGeometry, icoMaterial);
    icosahedron.position.set(15, -5, 10);
    scene.add(icosahedron);
    shapes.push(icosahedron);

    window.envShapes = shapes; // Used in animate()
}

function createGrid() {
    const gridHelper = new THREE.GridHelper(FIELD_SIZE, 50, 0xff0000, 0x220000);
    gridHelper.position.y = -10; // Set the floor at y = -10
    scene.add(gridHelper);
}

// --- UPDATED BUBBLE CREATION ---
function createBubbles() {
    // 1. Geometry and Material
    const bubbleGeometry = new THREE.SphereGeometry(1, 12, 12);
    const bubbleMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000, // <--- RED
        transparent: true,
        opacity: 0.2, 
        emissive: 0xff0000, // <--- RED
        emissiveIntensity: 0.5,
        depthWrite: false,
    });

    // 2. Instanced Mesh for performance
    bubblesMesh = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, BUBBLE_COUNT);
    // Set a custom userData property to easily identify the bubbles in raycasting
    bubblesMesh.userData.isBubbleMesh = true;
    bubblesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(bubblesMesh);

    // 3. Initialize Instance Data
    const dummy = new THREE.Object3D();
    for (let i = 0; i < BUBBLE_COUNT; i++) {
        const x = (Math.random() - 0.5) * FIELD_SIZE;
        const y = Math.random() * (FIELD_SIZE * 0.6) - 10;
        const z = (Math.random() - 0.5) * FIELD_SIZE;
        const scale = Math.random() * 0.5 + 0.1;

        dummy.position.set(x, y, z);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        bubblesMesh.setMatrixAt(i, dummy.matrix);

        // Store animation data
        bubbleData.push({
            speed: Math.random() * 0.1 + 0.05, 
            scale: scale,
            originalX: x,
            originalY: y,
            originalZ: z,
            // Flag to check if the bubble is "popped" and should be hidden
            isPopped: false
        });
    }

    bubblesMesh.instanceMatrix.needsUpdate = true;
}

function createExplosion(position) {
    const particleCount = 30;
    const explosionGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
        // Explode outward slightly from the center point
        positions[i] = position.x + (Math.random() - 0.5) * 2;
        positions[i + 1] = position.y + (Math.random() - 0.5) * 2;
        positions[i + 2] = position.z + (Math.random() - 0.5) * 2;
    }
    
    explosionGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const explosionMaterial = new THREE.PointsMaterial({
        color: 0xff0000,
        size: 0.5,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
    });
    
    const explosion = new THREE.Points(explosionGeometry, explosionMaterial);
    scene.add(explosion);
    
    // Animate explosion
    let opacity = 1;
    const animateExplosion = () => {
        opacity -= 0.02; // Fade out
        explosionMaterial.opacity = opacity;
        
        const positions = explosion.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            // Give particles a slight outward movement
            positions[i] += (Math.random() - 0.5) * 0.5 * opacity;
            positions[i + 1] += (Math.random() - 0.5) * 0.5 * opacity;
            positions[i + 2] += (Math.random() - 0.5) * 0.5 * opacity;
        }
        explosion.geometry.attributes.position.needsUpdate = true;
        
        if (opacity > 0) {
            requestAnimationFrame(animateExplosion);
        } else {
            // Clean up the explosion particles when faded
            explosion.geometry.dispose();
            explosion.material.dispose();
            scene.remove(explosion);
        }
    };
    animateExplosion();
}

// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);
    frame++;
    const delta = clock.getDelta();

    // Update FPS (Desktop only UI element)
    if (!isMobile && frame % 30 === 0) {
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
             const fps = Math.round(1 / delta);
             fpsElement.textContent = `FPS: ${fps}`;
        }
    }

    if (isMobile) {
        controls.update();
    } else {
        targetX = mouseX * 0.001;
        targetY = mouseY * 0.001;

        camera.rotation.y += (targetX - camera.rotation.y) * 0.05;
        camera.rotation.x += (targetY - camera.rotation.x) * 0.05;
    }

    // Animate cameras
    cameras.forEach((cam) => {
        cam.rotation.x += cam.userData.rotationSpeed;
        cam.rotation.y += cam.userData.rotationSpeed * 1.3;
        cam.position.y = cam.userData.originalY + Math.sin(frame * 0.01 * cam.userData.floatSpeed) * 2;
    });

    // Animate particles
    if (particles) {
        particles.rotation.x += 0.0001;
        particles.rotation.y += 0.0002;
    }

    // Animate environment shapes
    if (window.envShapes) {
        window.envShapes.forEach((shape, i) => {
            shape.rotation.x += 0.01 * (i + 1) * 0.3;
            shape.rotation.y += 0.01 * (i + 1) * 0.5;
        });
    }

    // --- UPDATED BUBBLE ANIMATION ---
    if (bubblesMesh) {
        const dummy = new THREE.Object3D();
        for (let i = 0; i < BUBBLE_COUNT; i++) {
            const data = bubbleData[i];

            if (data.isPopped) {
                // If popped, render it hidden (zero scale)
                dummy.scale.set(0, 0, 0);
                dummy.position.set(data.originalX, data.originalY, data.originalZ);
            } else {
                // 1. Rise up (Y-axis)
                data.originalY += data.speed * delta * 5;
            
                // 2. Loop: If bubble rises past Y=50, reset it to Y=-10 (the floor)
                if (data.originalY > 50) {
                    data.originalY = -10;
                    data.originalX = (Math.random() - 0.5) * FIELD_SIZE;
                    data.originalZ = (Math.random() - 0.5) * FIELD_SIZE;
                }
            
                // 3. Drift slightly on X and Z for a more organic feel
                const driftX = Math.sin(frame * 0.01 + i) * 0.05;
                const driftZ = Math.cos(frame * 0.01 + i) * 0.05;
            
                dummy.position.set(
                    data.originalX + driftX,
                    data.originalY,
                    data.originalZ + driftZ
                );
                dummy.scale.set(data.scale, data.scale, data.scale);
            }


            dummy.updateMatrix();
            bubblesMesh.setMatrixAt(i, dummy.matrix);
        }
        // Tell Three.js the instance data has changed
        bubblesMesh.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);
}

// --- Raycasting (Desktop Only) ---
function raycasterUpdate() {
    raycaster.setFromCamera(mouse, camera);
    
    // Check for cameras and bubbles
    const interactiveObjects = cameras.flatMap(cam => cam.children);
    if (bubblesMesh) {
        interactiveObjects.push(bubblesMesh);
    }

    const intersects = raycaster.intersectObjects(interactiveObjects, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        
        // Handle Camera Hover (Unchanged Logic)
        if (!object.userData.isBubbleMesh) {
            if (INTERSECTED !== object) {
                if (INTERSECTED && INTERSECTED.material && INTERSECTED.material.emissiveIntensity !== undefined) {
                    INTERSECTED.material.emissiveIntensity = 0.1;
                }
                INTERSECTED = object;
                if (INTERSECTED.material && INTERSECTED.material.emissiveIntensity !== undefined) {
                    INTERSECTED.material.emissiveIntensity = 0.5;
                }
            }
        }
        // No hover effect for bubbles, just interaction on click
    } else {
        if (INTERSECTED && INTERSECTED.material && INTERSECTED.material.emissiveIntensity !== undefined) {
            INTERSECTED.material.emissiveIntensity = 0.1;
        }
        INTERSECTED = null;
    }
}


// --- UPDATED CLICK HANDLER (Contains the explosion fix) ---
function onClick(event) {
    // Disable click interaction on mobile if not on canvas (for UI buttons)
    if (isMobile && event.target.tagName !== 'CANVAS') return;

    // 1. Update mouse coordinates for raycasting (Crucial for touch/mobile)
    if (isMobile && event.touches && event.touches.length > 0) {
        mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
    // Desktop coordinates are updated by onMouseMove

    raycaster.setFromCamera(mouse, camera);
    
    const interactiveObjects = cameras.flatMap(cam => cam.children);
    if (bubblesMesh) {
        interactiveObjects.push(bubblesMesh);
    }
    
    const intersects = raycaster.intersectObjects(interactiveObjects, true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const object = intersection.object;

        if (object.userData.isBubbleMesh) {
            // --- BUBBLE POP LOGIC ---
            const instanceId = intersection.instanceId;
            
            // InstancedMesh intersection returns instanceId (index in the array)
            if (instanceId !== undefined && instanceId !== null) { 
                const data = bubbleData[instanceId];
                
                if (data && !data.isPopped) {
                    data.isPopped = true; // Mark as popped, which hides it in the animate loop
                    
                    // 1. TRIGGER THE EXPLOSION EFFECT
                    createExplosion(intersection.point); // <--- **This is the one-click pop effect!**
                    
                    // 2. Reset bubble position to the floor
                    data.originalY = -10; 
                    
                    // 3. After a short delay (0.5s), make it "un-pop" and reappear at the bottom
                    setTimeout(() => {
                        data.isPopped = false;
                        data.originalX = (Math.random() - 0.5) * FIELD_SIZE;
                        data.originalZ = (Math.random() - 0.5) * FIELD_SIZE;
                    }, 500); 
                }
            }
        } else {
            // --- CAMERA EXPLOSION LOGIC (Same explosion function used here) ---
            let cameraGroup = object.parent;
            if (cameraGroup && cameras.includes(cameraGroup)) {
                createExplosion(cameraGroup.position);
            }
        }
    }
}


// --- Event Handlers (onTouchStart, onTouchMove, onMouseMove, onWheel, onWindowResize, onKeyDown, simulateLoading, showInfoCard remain unchanged) ---

function onMouseMove(event) {
    mouseX = event.clientX - window.innerWidth / 2;
    mouseY = event.clientY - window.innerHeight / 2;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update custom cursor
    const cursor = document.querySelector('.cursor');
    const follower = document.querySelector('.cursor-follower');
    
    if (cursor) cursor.style.left = event.clientX - 10 + 'px';
    if (cursor) cursor.style.top = event.clientY - 10 + 'px';
    
    if (follower) follower.style.left = event.clientX - 20 + 'px';
    if (follower) follower.style.top = event.clientY - 20 + 'px';
}

function onTouchStart(event) {
    mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
}

let initialDistance = null;
let initialZ = null;

function onTouchMove(event) {
    if (event.touches.length === 2) {
        event.preventDefault();

        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

        if (initialDistance === null) {
            initialDistance = distance;
            initialZ = camera.position.z;
        }

        const zoomDelta = distance - initialDistance;
        camera.position.z = initialZ - zoomDelta * 0.05;
        camera.position.z = Math.max(10, Math.min(50, camera.position.z));
    } else {
        initialDistance = null;
        initialZ = null;
    }
}

function onWheel(event) {
    camera.position.z += event.deltaY * 0.01;
    camera.position.z = Math.max(10, Math.min(50, camera.position.z));
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    if (event.code === 'Space') {
        camera.position.set(0, 5, 30);
        camera.rotation.set(0, 0, 0);
    }
}

function simulateLoading() {
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
            setTimeout(() => {
                if (loader) loader.classList.add('hidden');
                animate();
                showInfoCard();
            }, 500);
        }
        if (progressBar) progressBar.style.width = progress + '%';
    }, 200);
}

function showInfoCard() {
    if (isMobile) return; 

    const infoCard = document.getElementById('infoCard');
    if (!infoCard) return;

    setTimeout(() => {
        infoCard.classList.add('active');
    }, 1000);

    setTimeout(() => {
        infoCard.classList.remove('active');
    }, 5000);
}


// Start the application after the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE !== 'undefined') {
        init();
    } else {
        console.error('THREE.js library is not loaded. Ensure three.min.js is included first.');
    }
});