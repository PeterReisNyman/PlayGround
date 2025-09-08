import json
import re

# Load the data from properties_data.json
with open('properties_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Dictionary to store results: "URL": ["phones", "name", "address", "description", complete:bool]
results = {}

# List to store incomplete URLs
incomplete_urls = []

# Function to extract information from script content
def extract_info(content):
    phones = []
    name = ""
    address = ""
    description = ""
    
    # Extract name: \\\"name\\\":\\\"Heiwa Im\u00f3veis\\\"
    name_match = re.search(r'\\\"name\\\":\\\"(.*?)\\\"', content)
    if name_match:
        name = name_match.group(1).replace('\\u00f3', 'ó').replace('\\u00e1', 'á')  # Handle unicode escapes
    
    # Extract phones: \\\"phones\\\":\[\"(.*?)\"\]
    phones_match = re.search(r'\\\"phones\\\":\[(.*?)\]', content)
    if phones_match:
        phones_str = phones_match.group(1)
        phones = [p.strip('"') for p in phones_str.split(',')]
    
    # Extract address: \\\"formattedAddress\\\":\\\"(.*?)\"
    address_match = re.search(r'\\\"formattedAddress\\\":\\\"(.*?)(?<!\\)\\\"', content)
    if address_match:
        address = address_match.group(1).replace('\\u00e3', 'ã').replace('\\u00ed', 'í')
    
    # Extract description: \\\"description\\\":\\\"(.*?)(?<!\\)\"
    desc_match = re.search(r'\\\"description\\\":\\\"(.*?)(?<!\\)\\\"', content, re.DOTALL)
    if desc_match:
        description = desc_match.group(1).replace('\\u003cbr\\u003e', '\n').replace('\\u00e1', 'á').replace('\\u00e3', 'ã').replace('\\u00ed', 'í').replace('\\u00f3', 'ó').replace('\\u00e7', 'ç').replace('\\u00e9', 'é').replace('\\u00c1', 'Á')
    
    # Check if all info is present
    complete = bool(phones and name and address and description)
    
    return phones, name, address, description, complete

# Process each URL
for url, content in data.items():
    phones, name, address, description, complete = extract_info(content)
    results[url] = [phones, name, address, description, complete]
    
    if not complete:
        incomplete_urls.append(url)

# Save the results to organized_data.json
with open('organized_data.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=4, ensure_ascii=False)

# Output the results (optional, for verification)
print(json.dumps(results, indent=4, ensure_ascii=False))

print("\nURLs with not all information (complete == false):")
for u in incomplete_urls:
    print(f"- {u}")
