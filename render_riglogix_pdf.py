import fitz, os
pdf = fitz.open("attached_assets/RigLogix_Digital_Machinery_Marketplace_(1)_1789844011438.pdf")
print("pages", pdf.page_count)
print("metadata", pdf.metadata)
os.makedirs(".agents/outputs/riglogix_pdf", exist_ok=True)
for i, page in enumerate(pdf):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
    out = f".agents/outputs/riglogix_pdf/page-{i+1:02d}.png"
    pix.save(out)
    print(out, page.rect.width, page.rect.height, len(page.get_images(full=True)), len(page.get_text("text")))
