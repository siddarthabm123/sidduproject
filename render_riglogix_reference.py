from pathlib import Path
import fitz

source = Path("attached_assets/RigLogix_Digital_Machinery_Marketplace_(1)_1789844011438.pdf")
output = Path(".agents/outputs/riglogix-reference")
output.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")
for index, page in enumerate(document):
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
    path = output / f"page-{index + 1:02d}.png"
    pixmap.save(path)
    print(path)