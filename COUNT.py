import json

# Load organized_data.json
with open('organized_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Count unique phone numbers
unique_phones = set()

for url, info in data.items():
    phones = info[0]  # First element is the phones array
    for phone in phones:
        unique_phones.add(phone)

# Calculate statistics
total_entries = len(data)
entries_with_phones = sum(1 for info in data.values() if info[0])
entries_without_phones = total_entries - entries_with_phones
complete_entries = sum(1 for info in data.values() if info[4])

# Print results
print("=" * 50)
print("ORGANIZED_DATA.JSON STATISTICS")
print("=" * 50)
print(f"Total unique phones: {len(unique_phones)}")
print(f"Total entries: {total_entries}")
print(f"Entries with phones: {entries_with_phones} ({entries_with_phones/total_entries*100:.1f}%)")
print(f"Entries without phones: {entries_without_phones} ({entries_without_phones/total_entries*100:.1f}%)")
print(f"Complete entries (all fields): {complete_entries} ({complete_entries/total_entries*100:.1f}%)")
print("=" * 50)
