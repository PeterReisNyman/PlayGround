import json
import concurrent.futures
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException, WebDriverException

# Load the links from JSON
with open('property_links.json', 'r') as f:
    links = json.load(f)

# Function to extract data from a single URL
def extract_data(url):
    driver = None
    try:
        # Create a new driver instance for each thread/process
        driver = webdriver.Chrome()
        driver.get(url)
        
        # Locate the script tag
        script_elem = driver.find_element(By.XPATH, "/html/body/script[18]")
        script_content = script_elem.get_attribute('innerHTML')  # or 'textContent'
        
        # Attempt to parse as JSON (assuming it's JSON data)
        try:
            data = json.loads(script_content)
        except json.JSONDecodeError:
            data = script_content  # Fallback to raw string if not JSON
        
        return data
    except NoSuchElementException:
        return {"error": "Script tag not found"}
    except WebDriverException as e:
        return {"error": str(e)}
    finally:
        if driver:
            driver.quit()

# Dictionary to store results {url: data}
results = {}

# Use ThreadPoolExecutor for parallelism (IO-bound; adjust max_workers based on system resources)
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:  # Limit to 10 to avoid overwhelming the system
    future_to_url = {executor.submit(extract_data, url): url for url in links}
    
    for future in concurrent.futures.as_completed(future_to_url):
        url = future_to_url[future]
        try:
            results[url] = future.result()
        except Exception as e:
            results[url] = {"error": str(e)}

# Save the results to a new JSON file
with open('properties_data.json', 'w') as f:
    json.dump(results, f, indent=4)

print(f"Processed {len(links)} links. Results saved to properties_data.json")