import json
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException, TimeoutException

# Set up the driver (assuming Chrome; install chromedriver if needed)
driver = webdriver.Chrome()

# Base URL
url = "https://www.zapimoveis.com.br/venda/?transacao=venda&viewport=-48.399371914016385%2C-27.467258833201573%7C-48.6362646142117%2C-27.74563430843269"
driver.get(url)

# Load existing links if any
links = set()
json_file = 'property_links.json'
try:
    with open(json_file, 'r') as f:
        links.update(json.load(f))
except FileNotFoundError:
    pass

# Flag for first click
is_first = True

# Loop until no more pages
page_count = 0
while True:
    try:
        # Wait for the listings to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "/html/body/section/div/div[3]/div[4]/div[1]/ul/li[1]/a"))
        )
    except TimeoutException:
        print("No listings found or page failed to load.")
        break

    # Extract hrefs from li[1] to li[36]
    new_links_found = False
    for i in range(1, 37):
        try:
            xpath = f"/html/body/section/div/div[3]/div[4]/div[1]/ul/li[{i}]/a"
            elem = driver.find_element(By.XPATH, xpath)
            href = elem.get_attribute('href')
            if href and href not in links:
                links.add(href)
                new_links_found = True
        except NoSuchElementException:
            # Less than 36 on the last page
            break

    # Save updated links to JSON
    with open(json_file, 'w') as f:
        json.dump(list(links), f, indent=4)
        print(f"Saved {len(links)} links to {json_file}")

    if not new_links_found and page_count > 0:
        print("No new links found; possibly end of pages.")
        break

    # Click the next button
    next_xpath = "/html/body/section/div/div[3]/div[4]/div[1]/section/div/a[7]"
    try:
        next_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, next_xpath))
        )
        next_btn.click()
        time.sleep(2)  # Small delay to allow page load
        page_count += 1
    except TimeoutException:
        print("No more next button found.")
        break

driver.quit()

print(f"Scraping complete. Total unique links: {len(links)}. Saved to {json_file}")