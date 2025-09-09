import requests
import json
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

def get_sp_distrito_subprefeitura(neighborhood):
    """
    Simple lookup for São Paulo district and subprefeitura based on neighborhood.
    Expand this dictionary with more mappings as needed.
    """
    lookup = {
        'Vila dos Andradas': {'distrito': 'Vila Andrade', 'subprefeitura': 'Campo Limpo'},
        'Cerqueira César': {'distrito': 'Consolação', 'subprefeitura': 'Sé'},
        # Add more, e.g., 'Jardim Paulista': {'distrito': 'Jardim Paulista', 'subprefeitura': 'Pinheiros'},
    }
    return lookup.get(neighborhood, {'distrito': None, 'subprefeitura': None})

def get_coords_and_areas(address):
    """
    Retrieves the latitude, longitude, and various area levels for a given address using Google Maps Geocoding API.
    Includes São Paulo-specific district and subprefeitura lookup.
    
    Args:
    - address (str): The address to geocode.
    
    Returns:
    - tuple: (latitude, longitude, smaller_area, larger_area, all_areas, distrito, subprefeitura) if found.
    """
    api_key = os.getenv('MAPS_API_KEY')
    if not api_key:
        print("Error: MAPS_API_KEY not found in environment variables.")
        return None, None, None, None, {}, None, None
    
    # URL encode the address
    encoded_address = requests.utils.quote(address)
    url = f"https://maps.googleapis.com/maps/api/geocode/json?address={encoded_address}&key={api_key}"
    response = requests.get(url)
    
    if response.status_code != 200:
        print(f"Error: API request failed with status code {response.status_code}")
        return None, None, None, None, {}, None, None
    
    data = response.json()
    
    if data['status'] != 'OK':
        print(f"Error: API response status - {data['status']}")
        return None, None, None, None, {}, None, None
    
    if not data['results']:
        print("No results found for the given address.")
        return None, None, None, None, {}, None, None
    
    # Take the first result
    result = data['results'][0]
    
    # Get latitude and longitude
    location = result.get('geometry', {}).get('location', {})
    latitude = location.get('lat')
    longitude = location.get('lng')
    
    # Collect all area-related components by type
    all_areas = {}
    for component in result.get('address_components', []):
        types = [t for t in component['types'] if t not in ['political', 'postal_code', 'postal_code_suffix', 'street_number', 'route']]
        for t in types:
            if t not in all_areas:
                all_areas[t] = component['long_name']
            else:
                all_areas[t] += ', ' + component['long_name']
    
    # Define smaller area (most granular: neighborhood or sublocality levels)
    smaller_area = (
        all_areas.get('sublocality_level_1') or
        all_areas.get('neighborhood') or
        all_areas.get('sublocality') or
        all_areas.get('sublocality_level_2') or
        None
    )
    
    # Define larger area (city/locality or administrative_area_level_2)
    larger_area = (
        all_areas.get('locality') or
        all_areas.get('administrative_area_level_2') or
        all_areas.get('administrative_area_level_1') or
        None
    )
    
    # São Paulo-specific lookup
    distrito = None
    subprefeitura = None
    if smaller_area:
        sp_info = get_sp_distrito_subprefeitura(smaller_area)
        distrito = sp_info['distrito']
        subprefeitura = sp_info['subprefeitura']
    
    if not smaller_area and not larger_area:
        print("No area levels found in the address components.")
    
    return latitude, longitude, smaller_area, larger_area, all_areas, distrito, subprefeitura

# Example usage
if __name__ == "__main__":
    address = input("Enter the address: ").strip()
    if not address:
        address = "1600 Amphitheatre Parkway, Mountain View, CA"  # Default example
    
    lat, lng, smaller_area, larger_area, all_areas, distrito, subprefeitura = get_coords_and_areas(address)
    if lat is not None and lng is not None:
        print(f"Coordinates: ({lat}, {lng})")
        if smaller_area:
            print(f"Smaller area: {smaller_area}")
        else:
            print("Smaller area not found.")
        if distrito:
            print(f"Intermediate area (distrito): {distrito}")
        if subprefeitura:
            print(f"Subprefeitura: {subprefeitura}")
        if larger_area:
            print(f"Larger area: {larger_area}")
        else:
            print("Larger area not found.")
        if all_areas:
            print("All area types:")
            for area_type, name in all_areas.items():
                print(f"  - {area_type}: {name}")
        else:
            print("No area types found.")
    else:
        print("Failed to retrieve information.")