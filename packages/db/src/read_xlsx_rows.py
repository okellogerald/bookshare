#!/usr/bin/env python3

import json
import sys
import zipfile
import xml.etree.ElementTree as ET


MAIN_NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def column_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha()).upper()
    if not letters:
        return 0

    total = 0
    for ch in letters:
        total = (total * 26) + (ord(ch) - 64)
    return total - 1


def extract_text(node: ET.Element) -> str:
    parts: list[str] = []
    for text_node in node.findall(".//main:t", MAIN_NS):
        parts.append(text_node.text or "")
    return "".join(parts)


def load_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [extract_text(item) for item in root.findall("main:si", MAIN_NS)]


def resolve_first_sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))

    first_sheet = workbook.find("main:sheets/main:sheet", MAIN_NS)
    if first_sheet is None:
        raise RuntimeError("Workbook does not contain any sheets")

    rel_id = first_sheet.attrib.get(
        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    )
    if not rel_id:
        raise RuntimeError("First worksheet is missing a relationship id")

    target_by_id: dict[str, str] = {}
    for relationship in rels.findall("pkg:Relationship", REL_NS):
        identifier = relationship.attrib.get("Id")
        target = relationship.attrib.get("Target")
        if identifier and target:
            target_by_id[identifier] = target

    target = target_by_id.get(rel_id)
    if not target:
        raise RuntimeError("Could not resolve the first worksheet path")

    normalized = target.lstrip("/")
    if normalized.startswith("xl/"):
        return normalized
    return f"xl/{normalized}"


def load_rows(path: str) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings = load_shared_strings(archive)
        sheet_path = resolve_first_sheet_path(archive)
        sheet_root = ET.fromstring(archive.read(sheet_path))

        rows: list[list[str]] = []
        for row_node in sheet_root.findall(".//main:sheetData/main:row", MAIN_NS):
            indexed_cells: dict[int, str] = {}
            max_index = -1

            for cell in row_node.findall("main:c", MAIN_NS):
                ref = cell.attrib.get("r", "")
                idx = column_index(ref)
                cell_type = cell.attrib.get("t")

                value = ""
                value_node = cell.find("main:v", MAIN_NS)
                inline_node = cell.find("main:is", MAIN_NS)

                if cell_type == "s" and value_node is not None and value_node.text:
                    value = shared_strings[int(value_node.text)]
                elif cell_type == "inlineStr" and inline_node is not None:
                    value = extract_text(inline_node)
                elif value_node is not None:
                    value = value_node.text or ""

                indexed_cells[idx] = value
                max_index = max(max_index, idx)

            if max_index < 0:
                rows.append([])
                continue

            rows.append([indexed_cells.get(i, "") for i in range(max_index + 1)])

        return rows


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: read_xlsx_rows.py <path>")

    rows = load_rows(sys.argv[1])
    json.dump(rows, sys.stdout)


if __name__ == "__main__":
    main()
