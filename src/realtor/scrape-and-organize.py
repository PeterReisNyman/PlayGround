import json
import re
import time
import concurrent.futures
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, WebDriverException

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

    # Try OLD format first (with escaped quotes: \"account\")
    name_match = re.search(r'\\"account\\":\{.*?\\"name\\":\\"(.*?)\\"', content, re.DOTALL)
    if not name_match:
        # Also try without escaped quotes: "account"
        name_match = re.search(r'"account":\{.*?"name":"(.*?)"', content, re.DOTALL)
    if name_match:
        name = decode_unicode(name_match.group(1))

    phones_match = re.search(r'\\"account\\":\{.*?\\"phones\\":\[(.*?)\]', content, re.DOTALL)
    if not phones_match:
        # Also try without escaped quotes
        phones_match = re.search(r'"account":\{.*?"phones":\[(.*?)\]', content, re.DOTALL)
    if phones_match:
        phones_str = phones_match.group(1)
        phones = [re.sub(r'[\'\"\\\\]+', '', p.strip()) for p in phones_str.split(',') if p.strip()]

    address_match = re.search(r'\\"formattedAddress\\":\\"(.*?)(?<!\\\\)\\"', content)
    if not address_match:
        address_match = re.search(r'"formattedAddress":"(.*?)"', content)
    if address_match:
        address = decode_unicode(address_match.group(1))

    desc_match = re.search(r'\\"listing\\":\{.*?\\"description\\":\\"(.*?)(?<!\\\\)\\"', content, re.DOTALL)
    if not desc_match:
        desc_match = re.search(r'"listing":\{.*?"description":"(.*?)"', content, re.DOTALL)
    if desc_match:
        description = decode_unicode(desc_match.group(1))

    # If OLD format didn't work, try NEW format (schema.org Product structure)
    if not description:
        # New format: "description":"..." (try both escaped and unescaped)
        desc_new = re.search(r'\\"description\\":\\"(.*?)\\"', content, re.DOTALL)
        if not desc_new:
            desc_new = re.search(r'"description":"(.*?)"', content, re.DOTALL)
        if desc_new:
            description = decode_unicode(desc_new.group(1))

    if not address:
        # New format: "name":"Imóvel em <neighborhood>, <city> - <state>"
        name_new = re.search(r'\\"name\\":\\"Im.vel em (.*?)\\"', content)
        if not name_new:
            name_new = re.search(r'"name":"Im.vel em (.*?)"', content)
        if name_new:
            address = decode_unicode(name_new.group(1))

    # For new format, check if there's account info in different location
    # Looking for patterns like "realEstate":{"name":"...","phones":...}
    if not name:
        re_name = re.search(r'\\"realEstate\\":\{.*?\\"name\\":\\"(.*?)\\"', content, re.DOTALL)
        if not re_name:
            re_name = re.search(r'"realEstate":\{.*?"name":"(.*?)"', content, re.DOTALL)
        if re_name:
            name = decode_unicode(re_name.group(1))

    if not phones:
        re_phones = re.search(r'\\"realEstate\\":\{.*?\\"phoneNumbers\\":\[(.*?)\]', content, re.DOTALL)
        if not re_phones:
            re_phones = re.search(r'"realEstate":\{.*?"phoneNumbers":\[(.*?)\]', content, re.DOTALL)
        if re_phones:
            phones_str = re_phones.group(1)
            phones = [re.sub(r'[\'\"\\\\]+', '', p.strip()) for p in phones_str.split(',') if p.strip()]

    # Check if all info is present
    complete = bool(phones and name and address and description)

    return phones, name, address, description, complete

# Function to scrape and extract data from a single URL
def scrape_and_extract(url):
    driver = None
    try:
        # Create a new driver instance for each thread
        driver = webdriver.Chrome()
        driver.implicitly_wait(10)  # Wait up to 10 seconds for elements to appear
        driver.get(url)

        # Wait for page to load
        time.sleep(3)  # Give the page time to fully render

        # Wait for body to be present
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )

        # Try to locate the script tag (try script[15] through script[25])
        # Combine results from all script tags
        combined_phones = []
        combined_name = ""
        combined_address = ""
        combined_description = ""

        for script_index in range(15, 30):
            try:
                script_elem = driver.find_element(By.XPATH, f"/html/body/script[{script_index}]")
                script_content = script_elem.get_attribute('innerHTML')

                # Check if we got useful content (try to extract info)
                phones, name, address, description, complete = extract_info(script_content)

                # Combine results - only overwrite if we don't have it yet or new one is better
                if phones and not combined_phones:
                    combined_phones = phones
                if name and not combined_name:
                    combined_name = name
                if address and not combined_address:
                    combined_address = address
                if description and not combined_description:
                    combined_description = description

                # If we have complete data, we can stop early
                if combined_phones and combined_name and combined_address and combined_description:
                    break

            except NoSuchElementException:
                continue

        # Check if all info is present
        complete = bool(combined_phones and combined_name and combined_address and combined_description)

        return [combined_phones, combined_name, combined_address, combined_description, complete]

    except WebDriverException as e:
        print(f"Error scraping {url}: {str(e)}")
        return [[], "", "", "", False]
    finally:
        if driver:
            driver.quit()

# Main execution
if __name__ == "__main__":
    # Load the links from JSON
    with open('property_links.json', 'r') as f:
        links = json.load(f)

    # Load existing organized results if any
    organized_data = {}
    try:
        with open('organized_data.json', 'r', encoding='utf-8') as f:
            organized_data = json.load(f)
    except FileNotFoundError:
        pass

    # Filter to only process new links
    new_links = [url for url in links if url not in organized_data]

    print(f"Total links: {len(links)}")
    print(f"Already processed: {len(organized_data)}")
    print(f"New links to process: {len(new_links)}")

    if len(new_links) == 0:
        print("No new links to process!")
    else:
        # Use ThreadPoolExecutor for parallelism
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            future_to_url = {executor.submit(scrape_and_extract, url): url for url in new_links}

            processed = 0
            for future in concurrent.futures.as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    result = future.result()
                    organized_data[url] = result
                    processed += 1

                    # Only keep entries with phone numbers
                    if result[0]:  # If has phones
                        print(f"[{processed}/{len(new_links)}] Scraped {url[:60]}... ✓ (has phone)")
                    else:
                        print(f"[{processed}/{len(new_links)}] Scraped {url[:60]}... ✗ (no phone)")

                except Exception as e:
                    organized_data[url] = [[], "", "", "", False]
                    print(f"[{processed}/{len(new_links)}] Error: {url[:60]}... - {str(e)}")

                # Save incrementally after each completion
                with open('organized_data.json', 'w', encoding='utf-8') as f:
                    json.dump(organized_data, f, indent=4, ensure_ascii=False)

        # Final save
        with open('organized_data.json', 'w', encoding='utf-8') as f:
            json.dump(organized_data, f, indent=4, ensure_ascii=False)

        entries_with_phones = sum(1 for info in organized_data.values() if info[0])

        print(f"\n✓ Processed {len(new_links)} new links")
        print(f"✓ Total entries: {len(organized_data)}")
        print(f"✓ Entries with phones: {entries_with_phones}")
