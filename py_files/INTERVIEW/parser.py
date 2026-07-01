"""
Resume and JD Parser Module - Uses PyMuPDF (fitz) instead of PyPDF2
"""

import fitz  # PyMuPDF - already installed
import os


class ResumeJDParser:
    def __init__(self):
        self.supported_formats = ['.pdf', '.docx', '.txt']

    def parse_file(self, file_path):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext == '.pdf':
            return self._parse_pdf(file_path)
        elif file_ext == '.docx':
            return self._parse_docx(file_path)
        elif file_ext == '.txt':
            return self._parse_txt(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

    def _parse_pdf(self, file_path):
        """Extract text from PDF using PyMuPDF (fitz)."""
        text = ""
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text()
        doc.close()
        return text.strip()

    def _parse_docx(self, file_path):
        """Extract text from DOCX - simple fallback using zipfile."""
        try:
            import docx2txt
            return docx2txt.process(file_path).strip()
        except ImportError:
            # Fallback: read raw XML text
            import zipfile
            text = ""
            try:
                with zipfile.ZipFile(file_path) as z:
                    with z.open("word/document.xml") as f:
                        content = f.read().decode("utf-8")
                        import re
                        text = re.sub(r"<[^>]+>", " ", content)
                        text = re.sub(r"\s+", " ", text).strip()
            except Exception:
                pass
            return text

    def _parse_txt(self, file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read().strip()

    def parse_resume_and_jd(self, resume_path, jd_path):
        resume_text = self.parse_file(resume_path)
        jd_text = self.parse_file(jd_path)
        return resume_text, jd_text
