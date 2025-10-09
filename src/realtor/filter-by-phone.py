import json

# Load the organized data
with open('organized_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

original_count = len(data)

# Filter entries that have phone numbers
filtered_data = {
    url: info
    for url, info in data.items()
    if info[0]  # info[0] is the phones array, keep if not empty
}

filtered_count = len(filtered_data)
removed_count = original_count - filtered_count

# Overwrite the original file with filtered data
with open('organized_data.json', 'w', encoding='utf-8') as f:
    json.dump(filtered_data, f, indent=4, ensure_ascii=False)

# Print statistics
print(f"Original entries: {original_count}")
print(f"Entries with phone numbers: {filtered_count}")
print(f"Removed entries: {removed_count}")
print(f"\norganized_data.json has been updated (entries without phones removed)")
