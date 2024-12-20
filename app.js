import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GUI } from "dat.gui";
import proj4 from "proj4";

// Define coordinate transformation
// Source: RD New (EPSG:28992)
// Target: WGS84 (EPSG:4326)
const rdNew =
  "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.2369,50.0087,465.658,-0.406857330322398,0.350732676542563,-1.8703473836068,4.0812 +units=m +no_defs";
const wgs84 = "+proj=longlat +datum=WGS84 +no_defs";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

new OrbitControls(camera, renderer.domElement);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Add axes helper
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// GUI for point size
const gui = new GUI();
const params = {
  pointSize: 0.2,
};
const pointCloudMaterial = new THREE.PointsMaterial({
  size: params.pointSize,
  vertexColors: true,
});
gui.add(params, "pointSize", 0.01, 1.0).onChange((value) => {
  pointCloudMaterial.size = value;
});

// Add raycaster and mouse coordinates
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Create a div for height and coordinates display
const infoDisplay = document.createElement("div");
infoDisplay.style.position = "absolute";
infoDisplay.style.top = "10px";

infoDisplay.style.padding = "10px";
infoDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
infoDisplay.style.color = "white";
infoDisplay.style.fontFamily = "Arial, sans-serif";
infoDisplay.style.fontSize = "14px";
infoDisplay.innerHTML = "Height: N/A<br>Coordinates: N/A, N/A, N/A";
document.body.appendChild(infoDisplay);

let pointCloud; // Store reference to point cloud
let pointCloudaxesHelper;
let groundLevel = 0; // Minimum z-value for height calculation
let previousSelectedPointIndex = null; // Store the previously selected point index
let originalColors; // To store the original colors of all points

const loader = new PLYLoader();
loader.load(
  "voxel_downsampled.ply", // Replace with the correct path to your .ply file
  function (geometry) {
    geometry.computeBoundingBox();
    console.log("Loaded geometry:", geometry);

    // Center the geometry at the origin
    const center = new THREE.Vector3();
    geometry.boundingBox.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);

    // Store original colors
    originalColors = new Float32Array(geometry.attributes.color.array);

    // Create point cloud from geometry
    pointCloud = new THREE.Points(geometry, pointCloudMaterial);

    // Rotate to align the Z-axis to the Y-axis
    pointCloud.rotation.x = -Math.PI / 2; // Rotate -90 degrees around X-axis to align z-axis to y-axis

    // Recalculate the bounding box after rotation
    geometry.computeBoundingBox();
    groundLevel = geometry.boundingBox.min.z;

    // Translate to align the new ground level with z = 0
    pointCloud.position.z = -groundLevel;

    // Add the point cloud to the scene
    scene.add(pointCloud);

    // Create and move axes helper to the new ground level
    const axesHelper = new THREE.AxesHelper(5);
    pointCloudaxesHelper = axesHelper;
    pointCloudaxesHelper.position.set(0, -groundLevel - 6.6, 0); // Adjust axes helper to align with the point cloud's ground level
    scene.add(pointCloudaxesHelper);

    // Adjust the camera to properly view the model
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(0, maxDim * 2, 0); // Move the camera up to fit the model in view
    camera.lookAt(0, 0, 0);

    console.log("Bounding box min X:", geometry.boundingBox.min.x);
  },
  undefined,
  function (error) {
    console.error("Error loading .ply file:", error);
  }
);

// Handle mouse clicks for selection
window.addEventListener("click", (event) => {
  if (!pointCloud) return; // Ensure the point cloud is loaded

  // Get the bounding rectangle of the canvas
  const rect = renderer.domElement.getBoundingClientRect();

  console.log("y", ((event.clientX - rect.left) / rect.width) * 2 - 1);

  // Adjust mouse coordinates to account for the canvas offset
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; // Flip the sign if it is misaligned

  // Set the raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check for intersections
  const intersects = raycaster.intersectObject(pointCloud);

  if (intersects.length > 0) {
    const selectedPointIndex = intersects[0].index;

    // Reset the color of the previously selected point
    if (previousSelectedPointIndex !== null) {
      const colors = pointCloud.geometry.attributes.color.array;
      colors[previousSelectedPointIndex * 3] =
        originalColors[previousSelectedPointIndex * 3];
      colors[previousSelectedPointIndex * 3 + 1] =
        originalColors[previousSelectedPointIndex * 3 + 1];
      colors[previousSelectedPointIndex * 3 + 2] =
        originalColors[previousSelectedPointIndex * 3 + 2];
      pointCloud.geometry.attributes.color.needsUpdate = true;
    }

    // Highlight the new selected point
    const selectedPoint = intersects[0].point;
    const colors = pointCloud.geometry.attributes.color.array;
    colors[selectedPointIndex * 3] = 1.0; // Red
    colors[selectedPointIndex * 3 + 1] = 0.0; // Green
    colors[selectedPointIndex * 3 + 2] = 0.0; // Blue
    pointCloud.geometry.attributes.color.needsUpdate = true;

    // Update the previous selected point index
    previousSelectedPointIndex = selectedPointIndex;

    selectedPoint.y += 2.5;

    console.log(
      "X:",
      selectedPoint.x,
      "Y:",
      selectedPoint.y,
      "Z:",
      selectedPoint.z
    );

    // Convert to real-world coordinates
    const realWorldCoords = proj4(rdNew, wgs84, [
      selectedPoint.x,
      selectedPoint.y,
    ]);
    const height = selectedPoint.y;
    infoDisplay.innerHTML = `Height: ${height.toFixed(
      2
    )} meters<br>Coordinates: ${realWorldCoords[0].toFixed(
      6
    )}, ${realWorldCoords[1].toFixed(6)}`;
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
