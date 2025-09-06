import osmnx as ox
import geopandas as gpd
import folium
from shapely.geometry import Point

# Define the central point (latitude, longitude)
point_lat, point_lon = -23.591658, -46.606200
point = Point(point_lon, point_lat)  # Shapely Point takes (lon, lat)
central_point = gpd.GeoSeries([point], crs='EPSG:4326')

# Project to UTM for accurate distance and area calculations (EPSG:32723 for São Paulo region)
utm_crs = 'EPSG:32723'
central_point_utm = central_point.to_crs(utm_crs)

# Convert 15 miles to meters (1 mile ≈ 1609.34 meters)
miles_to_meters = 15 * 1609.34

# Create a circle (buffer) around the central point with 15-mile radius
circle = central_point_utm.iloc[0].buffer(miles_to_meters)

# Function to fetch and filter boundaries at a given admin level
def fetch_and_filter(admin_level):
    tags = {'boundary': 'administrative', 'admin_level': str(admin_level)}
    boundaries = ox.features.features_from_place("São Paulo, Brazil", tags=tags)
    boundaries = gpd.GeoDataFrame(boundaries)
    boundaries = boundaries[boundaries.geometry.notnull()]
    
    boundaries_utm = boundaries.to_crs(utm_crs)
    
    # Compute intersections with the circle for each boundary
    intersections = boundaries_utm.geometry.intersection(circle)
    
    # Calculate the area ratios (intersection area / total boundary area)
    area_ratios = intersections.area / boundaries_utm.geometry.area
    
    # Filter where at least 50% of the area is inside the circle
    filtered_utm = boundaries_utm[area_ratios >= 0.5]
    filtered = filtered_utm.to_crs('EPSG:4326')
    
    return filtered, len(filtered)

# Try admin_level 8 (municípios)
filtered_boundaries, num_results = fetch_and_filter(8)

# If no results at level 8, fallback to smaller boundaries (admin_level 9)
if num_results == 0:
    print("No level 8 boundaries meet the criteria. Falling back to level 9 (smaller administrative boundaries).")
    filtered_boundaries, num_results = fetch_and_filter(9)

# If still no results, try level 10
if num_results == 0:
    print("No level 9 boundaries meet the criteria. Falling back to level 10.")
    filtered_boundaries, num_results = fetch_and_filter(10)

# If no boundaries meet the criteria at any level, print a message
if num_results == 0:
    print("No administrative boundaries have 50% or more of their area within the 15-mile radius at levels 8, 9, or 10.")
else:
    # Create an interactive Folium map centered on the given coordinates
    m = folium.Map(location=[point_lat, point_lon], zoom_start=10, tiles='OpenStreetMap')  # Adjusted zoom for closer view

    # Add the boundaries as GeoJSON layers with tooltips for labels (hover to see name)
    folium.GeoJson(
        filtered_boundaries.to_json(),
        style_function=lambda feature: {
            'fillColor': 'none',  # No fill for clarity
            'color': 'black',     # Boundary color
            'weight': 1,          # Boundary thickness
            'dashArray': '5, 5'   # Optional dashed line
        },
        tooltip=folium.GeoJsonTooltip(
            fields=['name'],      # Display the 'name' field on hover
            aliases=['Boundary:'],
            localize=True
        )
    ).add_to(m)

    # Add a marker for the central point
    folium.Marker(
        [point_lat, point_lon],
        popup='Central Point',
        tooltip='Given Coordinates'
    ).add_to(m)

    # Project the circle back to WGS84 (EPSG:4326) for Folium and add it to the map
    circle_4326 = gpd.GeoSeries([circle], crs=utm_crs).to_crs('EPSG:4326').iloc[0]
    folium.GeoJson(
        circle_4326.__geo_interface__,
        style_function=lambda feature: {
            'color': 'red',
            'weight': 2,
            'fill': False
        }
    ).add_to(m)

    # Save the map as an HTML file (open in a web browser to view and zoom interactively)
    m.save('sp_filtered_admin_boundaries_map.html')

    print("Interactive map of administrative boundaries with >=50% area inside 15-mile radius saved to 'sp_filtered_admin_boundaries_map.html'. Open it in a web browser to zoom and explore.")