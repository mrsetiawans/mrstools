
from playwright.sync_api import sync_playwright
import os

def verify_timers():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # List of files to check
        files = [
            'ppt/boldbnw.html',
            'ppt/geometric.html',
            'ppt/glassmorph.html',
            'ppt/modernmin.html',
            'ppt/modernsaas.html',
            'ppt/neobplay.html',
            'ppt/neobrutalism.html',
            'ppt/retro.html',
            'ppt/solarizedwarm.html'
        ]

        cwd = os.getcwd()

        for file_path in files:
            full_path = f'file://{cwd}/{file_path}'
            print(f"Checking {full_path}")
            page.goto(full_path)

            # Trigger presentation mode to show timer
            try:
                play_btn = page.locator('#playBtn')
                if play_btn.is_visible():
                    play_btn.click()
                    # Wait a bit for animation
                    page.wait_for_timeout(1000)

                    screenshot_path = f'verification/{os.path.basename(file_path).replace(".html", ".png")}'
                    page.screenshot(path=screenshot_path)
                    print(f"Screenshot saved to {screenshot_path}")
                else:
                    print(f"Play button not found in {file_path}")
            except Exception as e:
                print(f"Error checking {file_path}: {e}")

        browser.close()

if __name__ == "__main__":
    verify_timers()
