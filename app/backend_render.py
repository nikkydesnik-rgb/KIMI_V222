#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backend DOCX renderer (Python/docxtpl) for stable template filling.
Run: python backend_render.py
"""

import base64
import io
import os
from flask import Flask, jsonify, request, send_from_directory
from docxtpl import DocxTemplate

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "dist")

app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")


def fix_broken_template_keys(template_bytes):
    """
    Исправляет разбитые ключи {{...}} в шаблоне DOCX.
    Word может разбивать текст внутри {{...}} на несколько XML-тегов <w:t>,
    что мешает docxtpl распознать переменные. Эта функция объединяет их.
    """
    try:
        from lxml import etree
        import zipfile
        import re
        
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
                
                # Собираем полный текст параграфа
                full_text_parts = [elem.text or '' for elem in text_elements]
                full_text = ''.join(full_text_parts)
                
                if '{{' not in full_text:
                    continue
                
                # Находим все ключи в полном тексте
                key_matches = list(re.finditer(r'\{\{[^}]+\}\}', full_text))
                
                if not key_matches:
                    continue
                
                # Обрабатываем каждый ключ с конца, чтобы индексы не смещались
                for match in reversed(key_matches):
                    key_full = match.group(0)
                    start_pos = match.start()
                    end_pos = match.end()
                    
                    # Находим элементы, содержащие начало и конец ключа
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
                        continue  # Ключ уже в одном элементе
                    
                    # Вычисляем позиции внутри элементов
                    prefix_in_start = start_pos - sum(len(full_text_parts[j]) for j in range(start_elem_idx))
                    suffix_in_end = end_pos - sum(len(full_text_parts[j]) for j in range(end_elem_idx))
                    
                    # Получаем префикс (текст перед ключом в первом элементе)
                    prefix = full_text_parts[start_elem_idx][:prefix_in_start]
                    
                    # Получаем суффикс (текст после ключа в последнем элементе)
                    suffix = full_text_parts[end_elem_idx][suffix_in_end:]
                    
                    # Устанавливаем полный ключ в первый элемент с префиксом
                    text_elements[start_elem_idx].text = prefix + key_full
                    
                    # Очищаем промежуточные элементы (включая последний)
                    for i in range(start_elem_idx + 1, end_elem_idx + 1):
                        text_elements[i].text = None
                    
                    # Если есть суффикс, добавляем его к следующему элементу
                    if suffix:
                        if end_elem_idx + 1 < len(text_elements):
                            existing = text_elements[end_elem_idx + 1].text or ''
                            text_elements[end_elem_idx + 1].text = suffix + existing
                        else:
                            # Создаём новый элемент для суффикса
                            new_elem = etree.SubElement(paragraph, '{%s}t' % ns['w'])
                            new_elem.text = suffix
                    
                    modified = True
            
            if modified:
                new_document_xml = etree.tostring(root, encoding='utf-8', xml_declaration=True)
                output_buffer = io.BytesIO()
                with zipfile.ZipFile(output_buffer, 'w', zipfile.ZIP_DEFLATED) as out_zip:
                    for item in zip_file.filelist:
                        if item.filename == 'word/document.xml':
                            out_zip.writestr(item.filename, new_document_xml)
                        else:
                            out_zip.writestr(item.filename, zip_file.read(item.filename))
                return output_buffer.getvalue()
        
        return template_bytes
        
    except Exception as e:
        print(f"Warning: Could not fix template keys: {e}")
        import traceback
        traceback.print_exc()
        return template_bytes


def fix_broken_keys_advanced(template_bytes):
    """
    Улучшенная версия исправления разбитых ключей.
    Обрабатывает случаи, когда ключи разбиты между разными элементами форматирования.
    """
    try:
        from lxml import etree
        import zipfile
        import re
        
        zip_buffer = io.BytesIO(template_bytes)
        
        with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
            document_xml = zip_file.read('word/document.xml')
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            root = etree.fromstring(document_xml)
            
            modified = False
            
            # Обрабатываем каждый параграф
            for paragraph in root.xpath('.//w:p', namespaces=ns):
                # Получаем все текстовые элементы в параграфе
                text_elements = paragraph.xpath('.//w:t', namespaces=ns)
                
                if not text_elements:
                    continue
                
                # Собираем полный текст параграфа
                full_text = ''.join(elem.text or '' for elem in text_elements)
                
                # Если нет ключей, пропускаем
                if '{{' not in full_text:
                    continue
                
                # Находим все ключи в полном тексте
                key_matches = list(re.finditer(r'\{\{[^}]+\}\}', full_text))
                
                if not key_matches:
                    continue
                
                # Для каждого ключа пытаемся объединить разбитые части
                for match in reversed(key_matches):
                    key_full = match.group(0)
                    start_pos = match.start()
                    end_pos = match.end()
                    
                    # Определяем диапазон элементов, содержащих ключ
                    elem_ranges = []
                    pos = 0
                    for i, elem in enumerate(text_elements):
                        elem_text = elem.text or ''
                        elem_len = len(elem_text)
                        elem_start = pos
                        elem_end = pos + elem_len
                        
                        # Проверяем пересечение с ключом
                        if elem_start < end_pos and elem_end > start_pos:
                            elem_ranges.append((i, elem_start, elem_end))
                        
                        pos = elem_end
                    
                    if len(elem_ranges) <= 1:
                        continue  # Ключ уже в одном элементе
                    
                    # Объединяем ключ в первый элемент диапазона
                    first_idx = elem_ranges[0][0]
                    last_idx = elem_ranges[-1][0]
                    
                    # Сохраняем префикс перед ключом в первом элементе
                    first_elem = text_elements[first_idx]
                    prefix_len = start_pos - elem_ranges[0][1]
                    prefix = (first_elem.text or '')[:prefix_len]
                    
                    # Сохраняем суффикс после ключа в последнем элементе
                    last_elem = text_elements[last_idx]
                    suffix_start = end_pos - elem_ranges[-1][1]
                    suffix = (last_elem.text or '')[suffix_start:]
                    
                    # Устанавливаем полный ключ в первый элемент
                    first_elem.text = prefix + key_full
                    
                    # Очищаем промежуточные элементы
                    for i in range(first_idx + 1, last_idx + 1):
                        text_elements[i].text = None
                    
                    # Добавляем суффикс
                    if suffix:
                        if last_idx + 1 < len(text_elements):
                            next_elem = text_elements[last_idx + 1]
                            next_elem.text = suffix + (next_elem.text or '')
                        else:
                            # Создаём новый элемент
                            new_elem = etree.SubElement(paragraph, '{%s}t' % ns['w'])
                            new_elem.text = suffix
                    
                    modified = True
            
            if modified:
                new_document_xml = etree.tostring(root, encoding='utf-8', xml_declaration=True)
                output_buffer = io.BytesIO()
                with zipfile.ZipFile(output_buffer, 'w', zipfile.ZIP_DEFLATED) as out_zip:
                    for item in zip_file.filelist:
                        if item.filename == 'word/document.xml':
                            out_zip.writestr(item.filename, new_document_xml)
                        else:
                            out_zip.writestr(item.filename, zip_file.read(item.filename))
                return output_buffer.getvalue()
        
        return template_bytes
        
    except Exception as e:
        print(f"Warning: Could not fix template keys (advanced): {e}")
        return template_bytes


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


@app.route("/api/render-docx", methods=["POST"])
def render_docx():
    try:
        payload = request.get_json(silent=True) or {}
        template_base64 = payload.get("templateBase64", "")
        data = payload.get("data", {}) or {}

        if not template_base64:
            return jsonify({"success": False, "error": "templateBase64 is required"}), 400

        template_bytes = base64.b64decode(template_base64)
        
        # Автоматически исправляем разбитые ключи перед рендерингом (сначала обычная версия, потом улучшенная)
        template_bytes = fix_broken_template_keys(template_bytes)
        template_bytes = fix_broken_keys_advanced(template_bytes)
        
        tpl = DocxTemplate(io.BytesIO(template_bytes))
        tpl.render({k: "" if v is None else str(v) for k, v in data.items()})

        out = io.BytesIO()
        tpl.save(out)
        out.seek(0)

        return jsonify(
            {
                "success": True,
                "docxBase64": base64.b64encode(out.getvalue()).decode("utf-8"),
            }
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path: str):
    # Keep API routes untouched
    if path.startswith("api/"):
        return jsonify({"success": False, "error": "Not found"}), 404

    requested = os.path.join(DIST_DIR, path)
    if path and os.path.exists(requested):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3456, debug=False)
