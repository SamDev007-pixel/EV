# Project Documentation

Documentation for the **Intelligent EV Charging & Resource Management System**.

## Contents

- `Documentation.docx` — the generated Word export of `DOCUMENTATION.md`.
- `convert_doc_to_word.py` — renders `DOCUMENTATION.md` to `.docx`.

## Source of truth

The Markdown files in the repository root are the source of truth:

| File | Contents |
| :--- | :--- |
| `../README.md` | Overview, algorithms, measured evaluation, setup |
| `../DOCUMENTATION.md` | Full technical documentation |
| `../PROJECT_FILE_STRUCTURE_AND_SYSTEM_DETAILS.md` | Codebase map and REST API surface |

`Documentation.docx` is generated from `DOCUMENTATION.md`, so regenerate it after editing that file
instead of editing the Word document directly.

## Regenerating the Word export

`python-docx` is required and is intentionally not listed in `backend/requirements.txt`, because the
application itself does not depend on it:

```bash
pip install python-docx
python docs/convert_doc_to_word.py
```

The script writes `docs/Documentation.docx` and updates
`Intelligent_EV_Charging_System_Documentation.docx` in the repository root.
