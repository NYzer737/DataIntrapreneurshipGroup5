import numpy as np
import laspy
import open3d as o3d
from pyproj import Transformer

# Initialize the transformer
# Source: RD New (EPSG:28992), Target: WGS84 (EPSG:4326)
transformer = Transformer.from_crs("epsg:28992", "epsg:4326", always_xy=True)

# Load the LAZ file
file_path = "Data/427001_Prio_3_Meentstraat_Erichem_PC_RD.laz"
las = laspy.read(file_path)

# Extract point cloud coordinates
points = np.vstack((las.x, las.y, las.z)).transpose()

# Extract color information (if available)
if hasattr(las, 'red') and hasattr(las, 'green') and hasattr(las, 'blue'):
    colors = np.vstack((las.red, las.green, las.blue)).transpose()
    colors = colors / 65535  # Normalize to [0, 1] if LAS stores colors as 16-bit integers
else:
    colors = None
    print("No color information found in the LAZ file.")

# Initial Downsampling is added otherwise python crashes.
downsample_fraction = 1  # Keep 100% of points
sampled_indices = np.random.choice(points.shape[0], int(points.shape[0] * downsample_fraction), replace=False)
downsampled_points = points[sampled_indices]
downsampled_colors = colors[sampled_indices] if colors is not None else None

print(f"Initial downsampling complete. Points retained: {len(downsampled_points)}")

# Create Open3D point cloud object
pcd = o3d.geometry.PointCloud()
pcd.points = o3d.utility.Vector3dVector(downsampled_points)
if downsampled_colors is not None:
    pcd.colors = o3d.utility.Vector3dVector(downsampled_colors)

# Voxel Downsampling
voxel_size = 0.2
pcd_downsampled = pcd.voxel_down_sample(voxel_size)
print(f"Voxel downsampling complete. Points retained: {len(pcd_downsampled.points)}")

# Visualize the point cloud (optional)
o3d.visualization.draw_geometries([pcd_downsampled], window_name="Remaining After Ground Removal")

# Save the transformed and downsampled point cloud
o3d.io.write_point_cloud(f"voxel_downsampled_prio3_{voxel_size}.ply", pcd_downsampled)


