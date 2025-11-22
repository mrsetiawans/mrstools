
from playwright.sync_api import sync_playwright
import os

def verify_changes():
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

            # Check for custom cursors or laser pointers
            # We can verify CSS properties via JS

            # Check .laser-pointer transition
            try:
                has_laser_pointer = page.locator('.laser-pointer').count() > 0
                if has_laser_pointer:
                    transition = page.eval_on_selector('.laser-pointer', 'el => getComputedStyle(el).transition')
                    print(f"  .laser-pointer transition: {transition}")
            except:
                pass

            # Check custom cursor if exists (neobrutalism, retro)
            try:
                has_cursor_outline = page.locator('.cursor-outline').count() > 0
                if has_cursor_outline:
                    # Retro had animate() in JS which we removed. Neobrutalism had transition on width/height only.
                    # We just want to ensure page loads and no obvious errors.
                    pass
            except:
                pass

            screenshot_path = f'verification/final_{os.path.basename(file_path).replace(".html", ".png")}'
            page.screenshot(path=screenshot_path)
            print(f"  Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_changes()
