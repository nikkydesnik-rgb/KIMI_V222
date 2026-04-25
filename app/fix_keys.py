#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clear formatting from keys in DOCX template.
"""

import io
import zipfile
from lxml import etree
import re
import sys

def clear_key_formatting(template_path, output_path):
    with open(template_path, 'rb') as f:
        template_bytes = f.read()

    zip_buffer = io.BytesIO(template_bytes)

    with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
        document_xml = zip_file.read('word/document.xml')
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        root = etree.fromstring(document_xml)

        modified = False

        for paragraph in root.xpath('.//w:p', namespaces=ns):
            text_elements = paragraph.xpath('.//w:t', namespaces=ns)

            if not text_elements:
                continue

            full_text_parts = [elem.text or '' for elem in text_elements]
            full_text = ''.join(full_text_parts)

            if '{{' not in full_text:
                continue

            key_matches = list(re.finditer(r'\{\{[^}]+\}\}', full_text))

            if not key_matches:
                continue

            for match in reversed(key_matches):
                key_full = match.group(0)
                start_pos = match.start()
                end_pos = match.end()

                current_pos = 0
                start_elem_idx = -1
                end_elem_idx = -1

                for i, part in enumerate(full_text_parts):
                    part_len = len(part)
                    elem_start = current_pos
                    elem_end = current_pos + part_len

                    if start_elem_idx == -1 and elem_start <= start_pos < elem_end:
                        start_elem_idx = i
                    if elem_start < end_pos <= elem_end:
                        end_elem_idx = i
                        break

                    current_pos += part_len

                if start_elem_idx == -1 or end_elem_idx == -1:
                    continue

                if start_elem_idx == end_elem_idx:
                    continue

                prefix_in_start = start_pos - sum(len(full_text_parts[j]) for j in range(start_elem_idx))
                suffix_in_end = end_pos - sum(len(full_text_parts[j]) for j in range(end_elem_idx))

                prefix = full_text_parts[start_elem_idx][:prefix_in_start]
                suffix = full_text_parts[end_elem_idx][suffix_in_end:]

                text_elements[start_elem_idx].text = prefix + key_full

                for i in range(start_elem_idx + 1, end_elem_idx + 1):
                    text_elements[i].text = None

                if suffix:
                    if end_elem_idx + 1 < len(text_elements):
                        existing = text_elements[end_elem_idx + 1].text or ''
                        text_elements[end_elem_idx + 1].text = suffix + existing
                    else:
                        new_elem = etree.SubElement(paragraph, '{%s}t' % ns['w'])
                        new_elem.text = suffix

                modified = True
                print(f"Fixed key: {key_full}")

        if modified:
            new_document_xml = etree.tostring(root, encoding='utf-8', xml_declaration=True)
            output_buffer = io.BytesIO()
            with zipfile.ZipFile(output_buffer, 'w', zipfile.ZIP_DEFLATED) as out_zip:
                for item in zip_file.filelist:
                    if item.filename == 'word/document.xml':
                        out_zip.writestr(item.filename, new_document_xml)
                    else:
                        out_zip.writestr(item.filename, zip_file.read(item.filename))

            with open(output_path, 'wb') as f:
                f.write(output_buffer.getvalue())
            print(f"Saved to: {output_path}")
        else:
            print("No keys to fix - file may already be clean")

if __name__ == "__main__":
    input_file = "Шаблон_титульный_лист_V2.docx"
    output_file = "Шаблон_титульный_лист_V2_clean.docx"
    
    if len(sys.argv) >= 2:
        input_file = sys.argv[1]
    if len(sys.argv) >= 3:
        output_file = sys.argv[2]
    
    clear_key_formatting(input_file, output_file)