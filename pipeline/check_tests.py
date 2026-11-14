#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_tests.py - independent check of data/tests.json against the PSI tables.

It does NOT import pipeline/build_tests.py. It reads the raw CSV files under
research/raw/psi/tables/ with its own reader and its own number parser, and it
carries its own expectations (EXPECT below), written by the verifier with the
tables open: which column feeds oxygen / pressure / flow, with which factor,
and which non-blank records are not tests.

For EVERY test in tests.json it confirms
  1. table_file exists, "row" is a non-blank data record of that file (header =
     record 0) and is not one of the records the verifier lists as non-tests;
  2. every key in "raw" is a column of that file and every value is that row's
     cell, character for character (and no column is missing);
  3. every normalized number equals the raw cell times the conversion, within
     0.1 percent: o2_percent, pressure_kpa, flow_cm_s, composition.*, every
     numeric condition and outcome, and every value of a list / range;
  4. a normalized number is null only for a reason: the cell is not one clean
     number, or it fails a sanity gate, or the verifier lists it in MUST_BE_NULL;
  5. o2_raw / pressure_raw / flow_raw / fuel_raw and each entry's "raw" are the
     cell text; a fuel name is only given where the cell (or header) names it.
It also checks: the conversion each table states for a column is the one the
verifier expects; tests per table = non-blank records minus listed non-tests;
ids unique; gravity / platform agree with the PSI record; duplicate_of points
at an identical earlier row; tests.csv carries the same rows and core numbers;
every summary's n_tests and oxygen / pressure / flow ranges; every CSV on disk
is either read or listed under "excluded".

Prints PASS or FAIL per table with counts. Exit code 0 only when all pass.
Run from the product folder:   python3 pipeline/check_tests.py
Optional: python3 pipeline/check_tests.py <tests.json> [<tests.csv>]  to check
another copy of the two files (used to prove the checker catches planted errors).
Python 3.9, standard library only.
"""

import csv
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE_DIR = os.path.join(BASE, "research", "raw", "psi", "tables")
RECORDS = os.path.join(BASE, "research", "psi-investigations.json")
TESTS_JSON = os.path.join(BASE, "data", "tests.json")
TESTS_CSV = os.path.join(BASE, "data", "tests.csv")

TOL = 1e-3  # 0.1 percent

# Physical factors, written here independently of the builder.
PCT = 100.0                 # mole fraction -> percent
ATM = 101.325               # atm -> kPa
BAR = 100.0                 # bar -> kPa
MMHG = 101.325 / 760.0      # mmHg -> kPa (0.1333224)
MM_S = 0.1                  # mm/s -> cm/s
# Targets whose source cell is a mole fraction when the factor is x 100 (bar -> kPa is x 100 too).
FRACTION_TARGETS = ("o2_percent", "o2_final_percent")

# ----------------------------------------------------------------------------
# The verifier's own reading of each table
# ----------------------------------------------------------------------------
# core: field -> (column, factor)      a field not listed must be null in every test
# comp: gas -> column                  ambient mole fractions kept as written
# entry_factor: condition / outcome name -> factor (every other entry: factor 1)
# suffix: column -> unit texts a cell may carry after its number
# need_suffix: columns whose header has no unit, so the cell has to carry it (0 excepted)
# fuel_col: column that names the fuel / sample material (None: the table has none)
# fuel_also: other columns that may name the fuel
# non_tests: record number -> why that non-blank record is not a test
EXPECT = {
    "PSI-10_Experimental table_Flame Design_Normal Flame.csv": {
        "core": {"o2_percent": ("XO2 (init)", PCT), "pressure_kpa": ("pinit (atm)", ATM)},
        "entry_factor": {"o2_final_percent": PCT, "pressure_final_kpa": ATM, "pressure_mean_kpa": ATM},
        "fuel_col": "Fuel", "n_tests": 207,
    },
    "PSI-10_Experimental table_Flame Design_Inverse Flame.csv": {
        "core": {"o2_percent": ("XO2", PCT), "pressure_kpa": ("pinit (atm)", ATM)},
        "entry_factor": {"pressure_final_kpa": ATM, "pressure_mean_kpa": ATM},
        "fuel_col": None, "fuel_header": "XC2H4", "n_tests": 120,
    },
    "PSI-20_Experimental table_ACME BRE.csv": {
        "core": {"o2_percent": ("Oxygen Conc (percent)", 1.0)},
        "suffix": {"Oxygen Conc (percent)": ("%",)},
        "fuel_col": "Fuel Bottle", "n_tests": 18,
    },
    "PSI-21_Experimental table_CLD Flame.csv": {
        "core": {}, "suffix": {"Fuel conc. Range": ("%",)},
        "fuel_col": "Fuel Bottle", "fuel_also": ("Test Type",), "n_tests": 32,
    },
    "PSI-22_Experimental table_ACME E-FIELD Flames.csv": {
        "core": {}, "suffix": {"Fuel Conc": ("%",)},
        "fuel_col": "Fuel Bottle", "n_tests": 21,
        "non_tests": {r: "continuation of the test day above (only 'Fuel Conc' filled)"
                      for r in (3, 6, 14, 18, 24, 26, 27, 28, 30, 31, 32)},
    },
    "PSI-23_Experimental table_ACME s-Flame.csv": {
        "core": {"o2_percent": ("Atmosphere*", 1.0)},
        "suffix_re": {"Atmosphere*": r"%\s*O2 with \S+"},
        "fuel_col": "Fuel Bottle", "n_tests": 18,
    },
    "PSI-159_Experimental table_CFI-G_Normal Flames.csv": {
        "core": {"o2_percent": ("XO2 before test", PCT), "pressure_kpa": ("approx p (bar)", BAR)},
        "entry_factor": {"o2_final_percent": PCT},
        "fuel_col": "Fuel", "n_tests": 179,
    },
    "PSI-159_Experimental table_CFI-G_Inverse Flames.csv": {
        "core": {"o2_percent": ("XO2", PCT), "pressure_kpa": ("approx p (bar)", BAR)},
        "fuel_col": "Fuel", "n_tests": 154,
    },
    "PSI-25_Experimental table_BASS-II.csv": {
        "core": {"o2_percent": ("Calibrated  initial O2 % by vol", 1.0)},
        "fuel_col": "Fuel Sample Material", "n_tests": 129,
    },
    "PSI-26_Experimental table_BASS.csv": {
        "core": {}, "fuel_col": "Fuel Sample Material", "n_tests": 121,
        "non_tests": {66: "'SOOT Cleaning': maintenance entry with no test number and no sample number"},
    },
    "PSI-106_Experimental table_Slice.csv": {"core": {}, "fuel_col": "Fuel Type", "n_tests": 12},
    "PSI-107_Experimental table_Spice.csv": {
        "core": {"flow_cm_s": ("Air Rate (cm/s)", 1.0)}, "fuel_col": "Fuel", "n_tests": 469,
    },
    "PSI-39_Experimental table_CFI.csv": {
        "core": {"o2_percent": ("Oxygen", PCT), "pressure_kpa": ("Pressure", ATM)},
        "comp": {"o2": "Oxygen", "n2": "Nitrogen", "he": "Helium"},
        "suffix": {"Pressure": ("atm",)}, "need_suffix": ("Pressure",),
        "fuel_col": "Fuel", "n_tests": 87,
    },
    "PSI-68_Experimental table_Flex2.csv": {
        "core": {"o2_percent": ("Oxygen Mole Fraction", PCT), "pressure_kpa": ("Ambient Pressure (atm)", ATM),
                 "flow_cm_s": ("Flow Velocity (cm/s)", 1.0)},
        "fuel_col": "Sample (Fuel Type)", "n_tests": 8,
    },
    "PSI-69_Experimental table_FLEX.csv": {
        "core": {"o2_percent": ("O initial ambient composition; mole fraction", PCT),
                 "pressure_kpa": ("Ambient pressure; mmHg", MMHG)},
        "comp": {"o2": "O initial ambient composition; mole fraction",
                 "n2": "N initial ambient composition; mole fraction",
                 "co2": "CO initial ambient composition; mole fraction",
                 "he": "He initial ambient composition; mole fraction"},
        "fuel_col": "Fuel", "n_tests": 274,
    },
    "PSI-98_Experimental table_SAFFIRE-1.csv": {
        "core": {"o2_percent": ("Percent O2", 1.0), "flow_cm_s": ("Air Flow (cm/s)", 1.0)},
        "fuel_col": "Material", "n_tests": 2,
        "non_tests": {3: "pre-test flow visualization data, not a burn sample",
                      4: "pre-test flow visualization data, not a burn sample"},
    },
    "PSI-99_Experimental table_SAFFIRE-2.csv": {
        "core": {"o2_percent": ("Percent O2 (Note 1)", 1.0), "flow_cm_s": ("Air Flow (cm/s)", 1.0)},
        "entry_factor": {"microgravity_spread_rate_cm_s": MM_S, "normal_gravity_spread_rate_cm_s": MM_S},
        "suffix": {"Air Flow (cm/s)": ("cm/s",), "Ignition Power (W)": ("W",), "Ignition Time (s)": ("s",),
                   "Burn Time (s)": ("s",), "?-g Burn Length": ("cm",), "?-g Spread Length": ("mm/s",),
                   "1-g Burn Length": ("cm",), "1-g Spread Rate": ("mm/s",)},
        "need_suffix": ("?-g Burn Length", "?-g Spread Length", "1-g Burn Length", "1-g Spread Rate"),
        "fuel_col": "Material", "n_tests": 9,
        "non_tests": {10: "pre-test flow visualization data, not a burn sample",
                      11: "pre-test flow visualization data, not a burn sample",
                      12: "table note 1", 13: "table note 2", 14: "table note 3", 15: "table note 4"},
    },
    "PSI-100_Experimental table_SAFFIRE-3.csv": {
        "core": {"flow_cm_s": ("Air Flow", 1.0)},
        "suffix": {"Air Flow": ("cm/s",)}, "need_suffix": ("Air Flow",),
        "fuel_col": "Material", "n_tests": 2,
    },
    "PSI-101_Experimental table_SAME-R.csv": {
        "core": {"flow_cm_s": ("Inlet velocity (cm/s)", 1.0)}, "fuel_col": "Sample Type", "n_tests": 109,
    },
    "PSI-102_Experimental table_SAME.csv": {
        "core": {"flow_cm_s": ("Air Flow (cm/s)", 1.0)}, "fuel_col": "Sample Material", "n_tests": 8,
    },
    "PSI-47_Experimental table_DAFT.csv": {"core": {}, "fuel_col": None, "n_tests": 2},
    "PSI-142_Experimental table_Data Summary Table.csv": {"core": {}, "fuel_col": None, "n_tests": 8},
}

# CSV files on disk that must NOT be read as tests, and why (the verifier's reading).
EXPECT_EXCLUDED = {
    "PSI-108_Experimental table_STDCE-1.csv": "thermocapillary flow runs (Fluid Physics), nothing burns",
    "PSI-108_Experimental table_STDCE-1(1).csv": "thermocapillary flow runs (Fluid Physics), nothing burns",
    "PSI-181_Experimental table_Experimental Table_PSI_181.csv": "solder samples (Materials Science), nothing burns",
}

# Cells that hold a clean number and still have to give null: (file, row, target) -> why.
MUST_BE_NULL = {
    ("PSI-159_Experimental table_CFI-G_Inverse Flames.csv", 130, "outcome.peak_burner_temp_k"):
        "'Peak burner temp (K)' is the Celsius column + 273.15 in every row; here the Celsius cell is empty, "
        "so 273.15 is a spreadsheet formula on a blank, not a measurement",
}

# Formulas / spellings that support a tidy fuel word (the verifier's own list).
FUEL_SUPPORT = {
    "methane": ("ch4", "methane"), "ethylene": ("c2h4", "ethylene"), "ethane": ("c2h6", "ethane"),
    "propane": ("c3h8", "propane"), "hydrogen": ("h2", "hydrogen"), "dodecane": ("c12h26", "dodecane"),
    "paraffin": ("paraffin", "parrafin"), "isooctane": ("isooctane",), "octane": ("octane",),
}
NOT_A_MATERIAL = ("candle", "rod", "sphere", "slab", "sheet", "film", "fabric")

# ----------------------------------------------------------------------------
# Reading and parsing (own implementation)
# ----------------------------------------------------------------------------
NUM_RE = re.compile(r'^\s*(~)?\s*([-+]?(?:\d+\.?\d*|\.\d+))(.*)$', re.S)
NOTE_RE = re.compile(r'\s*\(note \d+\)\s*$', re.I)
SPLIT_RE = re.compile(r';|\||\bor\b|\band\b|\bto\b|\s[-–]\s|(?<=[\d%])-(?=[\d~.])')


def read_table(name):
    data = open(os.path.join(TABLE_DIR, name), "rb").read()
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("cp1252")
    return list(csv.reader(io.StringIO(text, newline="")))


def leading(cell):
    """-> (number, text after it) or None."""
    m = NUM_RE.match(NOTE_RE.sub("", cell))
    if not m:
        return None
    return float(m.group(2)), m.group(3).strip()


def numbers_in(cell):
    """Numbers of a list / range cell, in order."""
    out = []
    for part in SPLIT_RE.split(NOTE_RE.sub("", cell)):
        if part.strip():
            got = leading(part)
            if got is None:
                return None
            out.append(got[0])
    return out


def close(value, expected):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    return abs(value - expected) <= TOL * abs(expected) + 1e-9


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def factor_of(conversion):
    """'x 0.133322' -> 0.133322, 'none' -> 1.0, anything else -> None."""
    if conversion is None:
        return None
    c = conversion.strip()
    if c.startswith("none"):
        return 1.0
    m = re.fullmatch(r'x\s*([0-9.]+)', c)
    return float(m.group(1)) if m else None


class Tally(object):
    def __init__(self):
        self.fails = []
        self.n = {"tests": 0, "raw_cells": 0, "numbers": 0, "list_values": 0, "nulls_justified": 0,
                  "text_values": 0, "fuel_names": 0}

    def fail(self, msg):
        self.fails.append(msg)


def suffix_ok(exp, col, rest, value):
    """May this text follow the number in a cell of this column?"""
    pat = exp.get("suffix_re", {}).get(col)
    if pat is not None:
        return re.fullmatch(pat, rest) is not None
    if rest == "":
        return not (col in exp.get("need_suffix", ()) and value != 0)
    return rest in exp.get("suffix", {}).get(col, ())


def gate_fails(target, source_value, norm_value, factor):
    if target == "o2_percent" and not (0 <= norm_value <= 100):
        return True
    if target == "pressure_kpa" and not norm_value > 0:
        return True
    is_fraction = target.startswith("composition.") or (factor == PCT and target.split(".")[-1] in FRACTION_TARGETS)
    if is_fraction and not (0 <= source_value <= 1):
        return True
    return False


def check_number(tally, tid, target, cell, col, factor, value, values, exp, key):
    """One numeric target of one test against its cell."""
    got = leading(cell)
    clean = got is not None and suffix_ok(exp, col, got[1], got[0]) \
        and not re.match(r'^\s*~?\s*[-+]?0\d', cell)
    if value is not None:
        if not clean:
            tally.fail("%s %s = %r but cell %r of %r is not one clean number" % (tid, target, value, cell, col))
        elif not close(value, got[0] * factor):
            tally.fail("%s %s = %r, cell %r x %g = %r" % (tid, target, value, cell, factor, got[0] * factor))
        elif gate_fails(target, got[0], got[0] * factor, factor):
            tally.fail("%s %s = %r is outside the sanity gate" % (tid, target, value))
        elif key in MUST_BE_NULL:
            tally.fail("%s %s = %r but it has to be null: %s" % (tid, target, value, MUST_BE_NULL[key]))
        else:
            tally.n["numbers"] += 1
        if values:
            tally.fail("%s %s has both a single value and a list" % (tid, target))
        return
    if values:
        nums = numbers_in(cell)
        if nums is None or len(nums) != len(values) or len(nums) < 2:
            tally.fail("%s %s list %r does not match cell %r" % (tid, target, values, cell))
            return
        for v, nsrc in zip(values, nums):
            if not close(v, nsrc * factor):
                tally.fail("%s %s list value %r, cell gives %r x %g" % (tid, target, v, nsrc, factor))
            else:
                tally.n["list_values"] += 1
        return
    # value is null and there is no list: the cell must not be one clean, in-gate number
    if clean and cell.strip():
        if gate_fails(target, got[0], got[0] * factor, factor) or key in MUST_BE_NULL:
            tally.n["nulls_justified"] += 1
        else:
            tally.fail("%s %s is null but cell %r of %r is a clean number" % (tid, target, cell, col))


def fuel_supported(name, texts):
    """Every part of a tidy fuel name has its first word (or formula) in one of the texts."""
    low = " ".join(texts).lower()
    for part in re.split(r'\s*/\s*|\s*\+\s*', re.sub(r'\(.*?\)', '', name)):
        words = re.findall(r'[A-Za-z]{3,}', part)
        if not words:
            return False
        w = words[0].lower() if words[0].lower() != "iso" else (words[1].lower() if len(words) > 1 else "iso")
        if w in NOT_A_MATERIAL:
            return False
        if not any(s in low for s in FUEL_SUPPORT.get(w, (w,))):
            return False
    return True


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    global TESTS_JSON, TESTS_CSV
    if len(sys.argv) > 1:
        TESTS_JSON = sys.argv[1]
    if len(sys.argv) > 2:
        TESTS_CSV = sys.argv[2]
    doc = json.load(open(TESTS_JSON, encoding="utf-8"))
    records = {r["psi_id"]: r for r in json.load(open(RECORDS, encoding="utf-8"))}
    tables_meta = {t["table_file"]: t for t in doc["tables"]}
    by_file = {}
    for t in doc["tests"]:
        by_file.setdefault(t.get("table_file"), []).append(t)

    glob = Tally()   # checks that are not about one table
    results = []     # (file, tally)

    ids = [t.get("id") for t in doc["tests"]]
    if len(ids) != len(set(ids)):
        glob.fail("test ids are not unique")
    for f in by_file:
        if f not in EXPECT:
            glob.fail("tests.json has tests from %r, a file the verifier has no reading for" % (f,))
    for f in tables_meta:
        if f not in EXPECT:
            glob.fail("tests.json lists table %r, a file the verifier has no reading for" % (f,))

    for fname, exp in EXPECT.items():
        tally = Tally()
        results.append((fname, tally))
        if not os.path.isfile(os.path.join(TABLE_DIR, fname)):
            tally.fail("file is not on disk")
            continue
        meta = tables_meta.get(fname)
        if meta is None:
            tally.fail("no entry in tests.json tables[]")
            continue
        recs = read_table(fname)
        header = [h.strip() for h in recs[0]]
        tests = by_file.get(fname, [])
        psi_id = fname.split("_", 1)[0]

        # ---- what the table entry states: column -> targets, column -> factor
        col_targets, target_col, stated = {}, {}, {}
        for c in meta["columns"]:
            if c["name"] not in header:
                tally.fail("tables[].columns names %r, not a column of the file" % c["name"])
                continue
            targets = [x.strip() for x in (c.get("mapped_to") or "").split(",") if x.strip()]
            col_targets[c["name"]] = targets
            for tg in targets:
                target_col.setdefault(tg, c["name"])
            stated[c["name"]] = (factor_of(c.get("conversion")), c.get("unit_in_source"))
        if [c["name"] for c in meta["columns"]] != header:
            tally.fail("tables[].columns is not the file header, in order")

        # ---- the stated mapping of the core fields is the verifier's
        for field in ("o2_percent", "pressure_kpa", "flow_cm_s"):
            want = exp["core"].get(field)
            have = target_col.get(field)
            if want is None:
                if have is not None:
                    tally.fail("%s is mapped from %r; the verifier finds no such column in this table" % (field, have))
                continue
            if have != want[0]:
                tally.fail("%s is mapped from %r, the verifier expects %r" % (field, have, want[0]))
                continue
            f_stated = stated[have][0]
            if f_stated is None or abs(f_stated - want[1]) > TOL * want[1]:
                tally.fail("%s: stated conversion %r of %r, the verifier expects x %g"
                           % (field, f_stated, have, want[1]))
        for gas, col in exp.get("comp", {}).items():
            if target_col.get("composition." + gas) != col:
                tally.fail("composition.%s is mapped from %r, the verifier expects %r"
                           % (gas, target_col.get("composition." + gas), col))
        for tg, col in target_col.items():
            if tg.startswith("composition.") and tg.split(".", 1)[1] not in exp.get("comp", {}):
                tally.fail("%s is mapped from %r; the verifier finds no such column" % (tg, col))
            if tg.startswith(("condition.", "outcome.")) and stated[col][1] is not None:
                want_f = exp.get("entry_factor", {}).get(tg.split(".", 1)[1], 1.0)
                # a column that also feeds a core field states that field's factor
                core_cols = [v[0] for v in exp["core"].values()]
                if col not in core_cols and (stated[col][0] is None or abs(stated[col][0] - want_f) > TOL * want_f):
                    tally.fail("%s: stated conversion %r of %r, the verifier expects x %g" % (tg, stated[col][0], col, want_f))

        # ---- which records are tests
        nonblank = set(i for i in range(1, len(recs)) if any(c.strip() for c in recs[i]))
        non_tests = exp.get("non_tests", {})
        test_rows = [t.get("row") for t in tests]
        if len(test_rows) != len(set(test_rows)):
            tally.fail("a row appears in more than one test")
        missing = sorted(nonblank - set(test_rows) - set(non_tests))
        if missing:
            tally.fail("non-blank records that are neither tests nor listed non-tests: %r" % missing[:20])
        if len(tests) != exp["n_tests"]:
            tally.fail("%d tests, the verifier counts %d" % (len(tests), exp["n_tests"]))
        if meta.get("rows") != len(tests):
            tally.fail("tables[].rows = %r, tests in tests.json = %d" % (meta.get("rows"), len(tests)))
        n_skipped = sum(s["rows"] for s in meta.get("rows_skipped", []))
        if meta.get("rows_read") != len(recs) - 1 or meta.get("rows_read") != len(tests) + n_skipped:
            tally.fail("rows_read %r / skipped %r do not add up to the %d records of the file"
                       % (meta.get("rows_read"), n_skipped, len(recs) - 1))

        rec = records.get(psi_id, {})
        want_gravity = "microgravity" if rec.get("project_type") == "Microgravity Investigation" else None
        want_platform = rec.get("platform") if rec.get("platform") not in (None, "", "Not Applicable") else None
        seen_cells = {}

        for t in sorted(tests, key=lambda x: x.get("row") if isinstance(x.get("row"), int) else -1):
            tid = t.get("id")
            tally.n["tests"] += 1
            row = t.get("row")
            # 1. the row
            if not isinstance(row, int) or isinstance(row, bool) or not (1 <= row < len(recs)):
                tally.fail("%s row %r is not a data record of the file" % (tid, row))
                continue
            if row not in nonblank:
                tally.fail("%s row %d is a blank record" % (tid, row))
                continue
            if row in non_tests:
                tally.fail("%s row %d is not a test: %s" % (tid, row, non_tests[row]))
            if t.get("psi_id") != psi_id or not re.fullmatch(re.escape(psi_id) + r'(:[a-z]+)?:%d' % row, tid or ""):
                tally.fail("%s id / psi_id do not agree with file %s row %d" % (tid, psi_id, row))
            cells = recs[row] + [""] * (len(header) - len(recs[row]))
            if len(cells) != len(header):
                tally.fail("%s row %d has more cells than the header" % (tid, row))
                continue
            rowd = dict(zip(header, cells))

            # 2. raw
            raw = t.get("raw") or {}
            if list(raw.keys()) != header:
                tally.fail("%s raw keys are not the file's columns" % tid)
            for h in header:
                if raw.get(h) != rowd[h]:
                    tally.fail("%s raw[%r] = %r, the cell reads %r" % (tid, h, raw.get(h), rowd[h]))
                else:
                    tally.n["raw_cells"] += 1

            # 3 + 4. core numbers
            multi = t.get("multi") or {}
            for field, short in (("o2_percent", "o2_raw"), ("pressure_kpa", "pressure_raw"), ("flow_cm_s", "flow_raw")):
                want = exp["core"].get(field)
                if want is None:
                    if t.get(field) is not None or t.get(short) is not None or field in multi:
                        tally.fail("%s has %s but the table has no column for it" % (tid, field))
                    continue
                col, factor = want
                cell = rowd[col]
                if t.get(short) != (cell.strip() or None):
                    tally.fail("%s %s = %r, the cell reads %r" % (tid, short, t.get(short), cell))
                check_number(tally, tid, field, cell, col, factor, t.get(field),
                             (multi.get(field) or {}).get("values"), exp, (fname, row, field))
            for field in multi:
                if field not in exp["core"]:
                    tally.fail("%s multi has %s, not a core field of this table" % (tid, field))

            # composition
            comp = t.get("composition")
            if exp.get("comp"):
                if not isinstance(comp, dict):
                    tally.fail("%s has no composition but the table lists one" % tid)
                else:
                    for gas in ("o2", "n2", "co2", "he"):
                        col = exp["comp"].get(gas)
                        if col is None:
                            if comp.get(gas) is not None:
                                tally.fail("%s composition.%s = %r but the table has no column for it" % (tid, gas, comp.get(gas)))
                            continue
                        check_number(tally, tid, "composition." + gas, rowd[col], col, 1.0, comp.get(gas), None,
                                     exp, (fname, row, "composition." + gas))
            elif comp is not None and any(v is not None for v in comp.values()):
                tally.fail("%s has a composition but the table lists none" % tid)

            # conditions and outcomes
            for group, key in (("condition", "conditions"), ("outcome", "outcomes")):
                for name, e in (t.get(key) or {}).items():
                    target = group + "." + name
                    if name in ("fuel_percent", "fuel_diluent") and group == "condition":
                        fcol = exp.get("fuel_col")
                        if fcol is None or (e.get("raw") or "").strip() != rowd[fcol].strip():
                            tally.fail("%s %s raw %r is not the fuel cell" % (tid, target, e.get("raw")))
                        elif name == "fuel_percent":
                            got = leading(rowd[fcol])
                            if got is None or not got[1].startswith("%") or not close(e.get("value"), got[0]):
                                tally.fail("%s fuel_percent = %r, fuel cell reads %r" % (tid, e.get("value"), rowd[fcol]))
                            else:
                                tally.n["numbers"] += 1
                        else:
                            if not re.search(r'\b%s\b' % re.escape(str(e.get("value"))), rowd[fcol]):
                                tally.fail("%s fuel_diluent = %r is not in the fuel cell %r" % (tid, e.get("value"), rowd[fcol]))
                            else:
                                tally.n["text_values"] += 1
                        continue
                    col = target_col.get(target)
                    if col is None:
                        tally.fail("%s %s: no column of the table is mapped to it" % (tid, target))
                        continue
                    cell = rowd[col]
                    cont = t.get("continuation_rows") or []
                    folded = [c for c in cont if isinstance(c.get("row"), int) and 1 <= c["row"] < len(recs)
                              and recs[c["row"]][header.index(col)].strip()] if " | " in (e.get("raw") or "") else []
                    if folded:
                        # a test day continued on the following records
                        cells_all = [cell] + [recs[c["row"]][header.index(col)] for c in folded]
                        if e.get("raw") != " | ".join(x.strip() for x in cells_all):
                            tally.fail("%s %s raw %r is not the cells of rows %r" % (tid, target, e.get("raw"), [row] + [c["row"] for c in folded]))
                        cell = " | ".join(cells_all)
                    elif e.get("raw") != cell.strip():
                        tally.fail("%s %s raw %r, the cell reads %r" % (tid, target, e.get("raw"), cell))
                    if not cell.strip():
                        tally.fail("%s %s exists but the cell is empty" % (tid, target))
                        continue
                    numeric_col = stated[col][1] is not None
                    v, vs = e.get("value"), e.get("values")
                    if numeric_col:
                        if v is not None and not is_num(v):
                            tally.fail("%s %s = %r is not a number" % (tid, target, v))
                            continue
                        factor = exp.get("entry_factor", {}).get(name, 1.0)
                        check_number(tally, tid, target, cell, col, factor, v, vs, exp, (fname, row, target))
                    else:
                        if v is None:
                            pass  # a text cell the builder left raw (placeholder such as '-')
                        elif v in (cell.strip(), cell.strip().lower()):
                            tally.n["text_values"] += 1
                        else:
                            tally.fail("%s %s = %r is not the cell text %r" % (tid, target, v, cell))

            # continuation rows are real, and listed by the verifier as such
            for c in t.get("continuation_rows") or []:
                r2 = c.get("row")
                if r2 not in non_tests or not isinstance(r2, int) or not (row < r2 < len(recs)):
                    tally.fail("%s continuation row %r is not one the verifier lists" % (tid, r2))
                    continue
                cells2 = recs[r2] + [""] * (len(header) - len(recs[r2]))
                if c.get("raw") != dict(zip(header, cells2)):
                    tally.fail("%s continuation row %d raw does not match the file" % (tid, r2))
                if any(r3 in nonblank and r3 not in non_tests for r3 in range(row + 1, r2)):
                    tally.fail("%s continuation row %d is not directly under its test day" % (tid, r2))

            # 5. fuel
            fcol = exp.get("fuel_col")
            if fcol is None:
                if exp.get("fuel_header"):
                    if not any(exp["fuel_header"] in h for h in header) or exp["fuel_header"] not in (t.get("fuel_raw") or ""):
                        tally.fail("%s fuel is said to come from a header %r that the file does not have" % (tid, exp["fuel_header"]))
                    elif t.get("fuel") is None or not fuel_supported(t["fuel"], [exp["fuel_header"]]):
                        tally.fail("%s fuel %r is not what header %r names" % (tid, t.get("fuel"), exp["fuel_header"]))
                    else:
                        tally.n["fuel_names"] += 1
                elif t.get("fuel") is not None or t.get("fuel_raw") is not None:
                    tally.fail("%s has a fuel but the table has no fuel column" % tid)
            else:
                cell = rowd[fcol]
                if (t.get("fuel_raw") or "").strip() != cell.strip() or (t.get("fuel_raw") is None) != (not cell.strip()):
                    tally.fail("%s fuel_raw = %r, the cell reads %r" % (tid, t.get("fuel_raw"), cell))
                if t.get("fuel") is not None:
                    texts = [cell] + [rowd[c] for c in exp.get("fuel_also", ())]
                    if not cell.strip() or not fuel_supported(t["fuel"], texts):
                        tally.fail("%s fuel %r is not named by the cell %r" % (tid, t["fuel"], texts))
                    else:
                        tally.n["fuel_names"] += 1

            # gravity / platform come from the PSI record
            if t.get("gravity") != want_gravity:
                tally.fail("%s gravity %r, the PSI record gives %r" % (tid, t.get("gravity"), want_gravity))
            if t.get("platform") != want_platform:
                tally.fail("%s platform %r, the PSI record gives %r" % (tid, t.get("platform"), want_platform))

            # duplicate_of
            key = tuple(cells)
            if key in seen_cells:
                if t.get("duplicate_of") != seen_cells[key]:
                    tally.fail("%s is identical to %s but duplicate_of = %r" % (tid, seen_cells[key], t.get("duplicate_of")))
            else:
                if "duplicate_of" in t:
                    tally.fail("%s carries duplicate_of but no earlier row is identical" % tid)
                seen_cells[key] = tid

    # ------------------------------------------------------------ tests.csv
    with open(TESTS_CSV, encoding="utf-8", newline="") as fh:
        rows = list(csv.reader(fh))
    head, body = rows[0], rows[1:]
    n_csv_ok = 0
    if len(body) != len(doc["tests"]):
        glob.fail("tests.csv has %d rows, tests.json has %d tests" % (len(body), len(doc["tests"])))
    else:
        ix = {h: i for i, h in enumerate(head)}
        for line, t in zip(body, doc["tests"]):
            ok = line[ix["id"]] == t["id"] and line[ix["row"]] == str(t["row"]) and line[ix["table_file"]] == t["table_file"]
            for field in ("o2_percent", "pressure_kpa", "flow_cm_s"):
                cell = line[ix[field]]
                v = t[field]
                ok = ok and ((cell == "" and v is None) or (cell != "" and v is not None and abs(float(cell) - v) <= 1e-9 * max(1.0, abs(v))))
            for short in ("o2_raw", "pressure_raw", "flow_raw", "fuel", "fuel_phase", "fuel_form", "gravity"):
                ok = ok and line[ix[short]] == ("" if t[short] is None else str(t[short]))
            try:
                ok = ok and json.loads(line[ix["raw"]]) == t["raw"]
            except ValueError:
                ok = False
            if ok:
                n_csv_ok += 1
            else:
                glob.fail("tests.csv line for %s does not match tests.json" % t["id"])

    # ------------------------------------------------------------ summaries
    n_sum_ok = 0
    sums = {s["psi_id"]: s for s in doc.get("summaries", [])}
    psi_ids = list(dict.fromkeys(t["psi_id"] for t in doc["tests"]))
    if sorted(sums) != sorted(psi_ids):
        glob.fail("summaries cover %r, tests cover %r" % (sorted(sums), sorted(psi_ids)))
    for pid in psi_ids:
        s = sums.get(pid)
        if s is None:
            continue
        own = [t for t in doc["tests"] if t["psi_id"] == pid]
        ok = True
        if s.get("n_tests") != len(own):
            glob.fail("summary %s n_tests %r, tests %d" % (pid, s.get("n_tests"), len(own)))
            ok = False
        kinds = {}
        for t in own:
            kinds[t["row_kind"]] = kinds.get(t["row_kind"], 0) + 1
        if s.get("row_kinds") != kinds:
            glob.fail("summary %s row_kinds %r, tests give %r" % (pid, s.get("row_kinds"), kinds))
            ok = False
        varied = {v["field"]: v for v in s.get("varied", [])}
        const = {v["field"]: v for v in s.get("constant", [])}
        multis = {v["field"]: v for v in s.get("multi_valued", [])}
        for field in ("o2_percent", "pressure_kpa", "flow_cm_s"):
            vals = [t[field] for t in own if t[field] is not None]
            distinct = set(vals)
            if not vals:
                good = field not in varied and field not in const
            elif len(distinct) == 1:
                good = field in const and field not in varied and const[field]["value"] == vals[0] and const[field]["n"] == len(vals)
            else:
                v = varied.get(field)
                good = (v is not None and field not in const and v["min"] == min(vals) and v["max"] == max(vals)
                        and v["distinct"] == len(distinct) and v["n"] == len(vals) and v["n_missing"] == len(own) - len(vals))
            flat = [x for t in own for x in ((t.get("multi") or {}).get(field) or {}).get("values", [])]
            m = multis.get(field)
            if flat:
                good = good and m is not None and m["min"] == min(flat) and m["max"] == max(flat) \
                    and m["cells"] == sum(1 for t in own if field in (t.get("multi") or {}))
            else:
                good = good and m is None
            if not good:
                glob.fail("summary %s: %s does not match the tests (values %d, distinct %d)" % (pid, field, len(vals), len(distinct)))
                ok = False
        per_basis = {}
        for t in own:
            if t["o2_percent"] is not None:
                per_basis.setdefault(t["o2_basis"], []).append(t["o2_percent"])
        stated_basis = {b.get("basis"): b for b in s.get("o2_percent_by_basis", [])}
        if None in per_basis or sorted(stated_basis) != sorted(per_basis) or any(
                stated_basis[b]["n"] != len(v) or stated_basis[b]["min"] != min(v) or stated_basis[b]["max"] != max(v)
                for b, v in per_basis.items()):
            glob.fail("summary %s: o2_percent_by_basis does not match the tests" % pid)
            ok = False
        if ok:
            n_sum_ok += 1

    # ------------------------------------------------------------ excluded / coverage
    on_disk = sorted(f for f in os.listdir(TABLE_DIR) if f.lower().endswith(".csv"))
    excluded_files = [f for e in doc.get("excluded", []) for f in e.get("tables_not_read", [])]
    for f in on_disk:
        if f in EXPECT and f in excluded_files:
            glob.fail("%s is a combustion table but tests.json excludes it" % f)
        if f in EXPECT_EXCLUDED and (f not in excluded_files or f in by_file or f in tables_meta):
            glob.fail("%s is not a combustion table (%s) but tests.json does not exclude it" % (f, EXPECT_EXCLUDED[f]))
        if f not in EXPECT and f not in EXPECT_EXCLUDED:
            glob.fail("%s is on disk and the verifier has no reading for it" % f)
    for f in excluded_files:
        if f not in on_disk:
            glob.fail("excluded file %s is not on disk" % f)
    for e in doc.get("excluded", []):
        rec = records.get(e.get("psi_id"), {})
        if rec.get("research_area") == "Combustion Science" or rec.get("in_combustion_science_area"):
            glob.fail("%s is excluded but its PSI record is in the combustion science area" % e.get("psi_id"))
    no_table = sorted(r["psi_id"] for r in records.values() if not r.get("tables"))
    listed = sorted(r["psi_id"] for r in doc.get("records_without_table", []))
    if no_table != listed:
        glob.fail("records_without_table %r, PSI records without tables %r" % (listed, no_table))
    meta = doc.get("meta", {})
    if meta.get("n_tests") != len(doc["tests"]) or meta.get("n_tables") != len(doc["tables"]):
        glob.fail("meta counts do not match the lists")

    # ------------------------------------------------------------ output
    all_ok = True
    print("check_tests.py - tests.json against research/raw/psi/tables/ (tolerance 0.1 percent)")
    print("")
    tot = {}
    for fname, tally in results:
        ok = not tally.fails
        all_ok = all_ok and ok
        for k, v in tally.n.items():
            tot[k] = tot.get(k, 0) + v
        n = tally.n
        print("%s  %s" % ("PASS" if ok else "FAIL", fname))
        print("      tests %d | raw cells matched %d | numbers matched %d | list/range values matched %d | "
              "nulls on a numeric cell, justified %d | text values %d | fuel names supported %d"
              % (n["tests"], n["raw_cells"], n["numbers"], n["list_values"], n["nulls_justified"],
                 n["text_values"], n["fuel_names"]))
        for msg in tally.fails[:25]:
            print("      - " + msg)
        if len(tally.fails) > 25:
            print("      ... and %d more" % (len(tally.fails) - 25))
    print("")
    ok = not glob.fails
    all_ok = all_ok and ok
    print("%s  whole file: ids unique, tests.csv lines matching %d of %d, summaries matching %d of %d, "
          "excluded tables %d, records without a table %d"
          % ("PASS" if ok else "FAIL", n_csv_ok, len(doc["tests"]), n_sum_ok, len(psi_ids), len(excluded_files), len(listed)))
    for msg in glob.fails[:25]:
        print("      - " + msg)
    if len(glob.fails) > 25:
        print("      ... and %d more" % (len(glob.fails) - 25))
    print("")
    print("TOTAL  tables %d | tests %d | raw cells %d | numbers %d | list/range values %d | justified nulls %d"
          % (len(results), tot.get("tests", 0), tot.get("raw_cells", 0), tot.get("numbers", 0),
             tot.get("list_values", 0), tot.get("nulls_justified", 0)))
    if tot.get("tests", 0) != len(doc["tests"]):
        all_ok = False
        print("FAIL  %d tests checked, tests.json holds %d" % (tot.get("tests", 0), len(doc["tests"])))
    print("RESULT: %s" % ("ALL PASS" if all_ok else "FAIL"))
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
