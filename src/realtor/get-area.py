import requests
import folium
import time

def get_bounding_box(neighborhood, city="São Paulo", state="SP", country="Brazil"):
    """
    Retrieves the bounding box for a neighborhood using OpenStreetMap's Nominatim API.
    
    Args:
    - neighborhood (str): The name of the neighborhood.
    - city, state, country (str): Location context to refine the search.
    
    Returns:
    - list: [min_lat, max_lat, min_lon, max_lon] if found, else None.
    """
    query = f"{neighborhood}, {city}, {state}, {country}"
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "json",
        "limit": 1,
        "addressdetails": 1  # Optional: for more details if needed
    }
    headers = {
        "User-Agent": "NeighborhoodMapper/1.0 (your.email@example.com)"  # Replace with your email to comply with usage policy
    }
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()  # Raise error for bad status
        data = response.json()
        
        if data:
            bbox = data[0].get("boundingbox")
            if bbox:
                # boundingbox: [min_lat (south), max_lat (north), min_lon (west), max_lon (east)]
                return [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
        print(f"No bounding box found for: {neighborhood}")
    except Exception as e:
        print(f"Error fetching bounding box for {neighborhood}: {e}")
    
    return None

def create_map_with_labels(neighborhoods, output_file="neighborhood_map.html"):
    """
    Creates an interactive map with labels (markers) for each neighborhood using Folium and OSM tiles.
    Markers are placed at the center of each neighborhood's bounding box with popup and tooltip.
    
    Args:
    - neighborhoods (list of str): List of neighborhood names.
    - output_file (str): Path to save the HTML map.
    
    Returns:
    - None: Saves the map to file.
    """
    # Initialize map centered on São Paulo
    center_lat, center_lon = -23.5505, -46.6333
    m = folium.Map(location=[center_lat, center_lon], zoom_start=11, tiles="OpenStreetMap")
    
    for nh in neighborhoods:
        bbox = get_bounding_box(nh)
        if bbox:
            # Calculate center
            min_lat, max_lat, min_lon, max_lon = bbox
            center_lat_nh = (min_lat + max_lat) / 2
            center_lon_nh = (min_lon + max_lon) / 2
            
            # Add marker with label
            folium.Marker(
                location=[center_lat_nh, center_lon_nh],
                popup=nh,
                tooltip=nh  # Hover tooltip for quick identification
            ).add_to(m)
            print(f"Added label for: {nh}")
        # Sleep to respect Nominatim rate limits (1 req/sec)
        time.sleep(1)
    
    # Add layer control (though all are on base layer, useful if extended)
    folium.LayerControl().add_to(m)
    
    m.save(output_file)
    print(f"Map saved to {output_file}")

# Example usage
if __name__ == "__main__":
    neighborhoods = ["Perdizes","Sumarezinho", "Vila Ida", "alto de Pinheiros"]
    create_map_with_labels(neighborhoods)