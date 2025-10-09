import json
import re

# Load the data from properties_data.json
with open('properties_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Dictionary to store results: "URL": ["phones", "name", "address", "description", complete:bool]
results = {}

# List to store incomplete URLs
incomplete_urls = []

# Function to decode unicode escapes
def decode_unicode(text):
    """Decode common Portuguese unicode escapes"""
    replacements = {
        '\\u00e1': 'á', '\\u00e3': 'ã', '\\u00e9': 'é', '\\u00ed': 'í',
        '\\u00f3': 'ó', '\\u00f4': 'ô', '\\u00e7': 'ç', '\\u00c1': 'Á',
        '\\u003cbr\\u003e': '\n', '\\n': '\n', '\\\\n': '\n', '\\\\': ''
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text

# Function to extract information from script content
def extract_info(content):
    # Guard: ensure we only try regexes on strings/bytes
    if not isinstance(content, (str, bytes)):
        return [], "", "", "", False

    phones = []
    name = ""
    address = ""
    description = ""

    # Try OLD format first (\"account\" structure)
    name_match = re.search(r'\\\"account\\\":\{.*?\\\"name\\\":\\\"(.*?)\\\"', content, re.DOTALL)
    if name_match:
        name = decode_unicode(name_match.group(1))

    phones_match = re.search(r'\\\"account\\\":\{.*?\\\"phones\\\":\[(.*?)\]', content, re.DOTALL)
    if phones_match:
        phones_str = phones_match.group(1)
        phones = [re.sub(r'[\'\"\\]+', '', p.strip()) for p in phones_str.split(',') if p.strip()]

    address_match = re.search(r'\\\"formattedAddress\\\":\\\"(.*?)(?<!\\)\\\"', content)
    if address_match:
        address = decode_unicode(address_match.group(1))

    desc_match = re.search(r'\\\"listing\\\":\{.*?\\\"description\\\":\\\"(.*?)(?<!\\)\\\"', content, re.DOTALL)
    if desc_match:
        description = decode_unicode(desc_match.group(1))

    # If OLD format didn't work, try NEW format (schema.org Product structure)
    if not description:
        # New format: "description":"..."
        desc_new = re.search(r'\\\"description\\\":\\\"(.*?)\\\"', content, re.DOTALL)
        if desc_new:
            description = decode_unicode(desc_new.group(1))

    if not address:
        # New format: "name":"Imóvel em <neighborhood>, <city> - <state>"
        name_new = re.search(r'\\\"name\\\":\\\"Im.vel em (.*?)\\\"', content)
        if name_new:
            address = decode_unicode(name_new.group(1))

    # For new format, check if there's account info in different location
    # Looking for patterns like "realEstate":{"name":"...","phones":...}
    if not name:
        re_name = re.search(r'\\\"realEstate\\\":\{.*?\\\"name\\\":\\\"(.*?)\\\"', content, re.DOTALL)
        if re_name:
            name = decode_unicode(re_name.group(1))

    if not phones:
        re_phones = re.search(r'\\\"realEstate\\\":\{.*?\\\"phoneNumbers\\\":\[(.*?)\]', content, re.DOTALL)
        if re_phones:
            phones_str = re_phones.group(1)
            phones = [re.sub(r'[\'\"\\]+', '', p.strip()) for p in phones_str.split(',') if p.strip()]

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
