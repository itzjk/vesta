#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_tests.py - VESTA unified test table.

Reads the PSI "Experimental table" CSVs saved under research/raw/psi/tables/
and the PSI records in research/psi-investigations.json, and writes

    data/tests.json         tables + tests + summaries + excluded (the contract in DESIGN-BRIEF.md)
    data/tests.csv          the same tests, one line per test
    data/tests.report.txt   what was read, kept, skipped and converted

Run from the product folder:   python3 pipeline/build_tests.py
Python 3.9, standard library only, one process, no network.

RULES (they hold for every table)
---------------------------------
* Real data only. A normalized value exists because a cell holds it. Nothing is
  filled in from general knowledge. A cell that is not a clean number for its
  field gives null; the cell text always stays in "raw" (and in o2_raw,
  pressure_raw, flow_raw for the three core numbers).
* A clean number is: digits with an optional decimal point, optionally followed
  by the unit the mapping allows for that column ("20 cm/s", "1 atm", "40%").
  "037" (leading zero), "#DIV/0!", "RAMP", "none", ">500" are not clean numbers.
* "~ 21.5" is read as 21.5 and the field is listed in the test's "approx".
* A cell that holds several values ("21; 26.5; 40") or a range ("21.5 - 21.7",
  "30%-40%") gives null for the single-value field; the values go to the test's
  "multi" (core fields) or to "values" inside the condition / outcome entry.
* Sanity gates: o2_percent must be within 0..100, a mole fraction within 0..1,
  pressure_kpa above 0. A cell outside the gate gives null and stays raw
  (this is what happens to "3400%" in ACME BRE and to "0" mmHg in FLEX).
* Conversions allowed (CONVERSIONS below) and nothing else:
  mole fraction -> percent (x100), mmHg -> kPa (x0.133322), atm -> kPa
  (x101.325), bar -> kPa (x100), psi -> kPa (x6.89476), mm/s -> cm/s (x0.1).
* gravity comes from the PSI record field "project_type"
  ("Microgravity Investigation" -> "microgravity"; any other value -> null,
  because the record then does not state the gravity level).
  platform comes from the PSI record field "platform" (PSI "flightProgram").
  hardware is the PSI record field "hardware", verbatim.
* "row" is the record number inside the CSV file with the header as record 0,
  so row 1 is the first data row (spreadsheet line = row + 1).
* id is "<psi_id>:<row>"; investigations with two tables use
  "<psi_id>:<table key>:<row>" (PSI-10 and PSI-159: "normal" / "inverse").
* A row whose cells are identical to an earlier row of the same table is kept
  (the source holds it) and carries "duplicate_of" with the earlier id.
* Column names are used as written in the file, minus leading / trailing blanks.

The per-table decisions are the TABLES list right below. Columns that are not
listed there are not interpreted; their cells are still in every test's "raw".
"""

import csv
import datetime
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE_DIR = os.path.join(BASE, "research", "raw", "psi", "tables")
RECORDS_FILE = os.path.join(BASE, "research", "psi-investigations.json")
OUT_DIR = os.path.join(BASE, "data")
OUT_JSON = os.path.join(OUT_DIR, "tests.json")
OUT_CSV = os.path.join(OUT_DIR, "tests.csv")
OUT_REPORT = os.path.join(OUT_DIR, "tests.report.txt")

# ----------------------------------------------------------------------------
# Conversions (the only ones allowed)
# ----------------------------------------------------------------------------
CONVERSIONS = {
    "fraction_to_percent": (100.0, "x 100"),
    "mmhg_to_kpa": (0.133322, "x 0.133322"),
    "atm_to_kpa": (101.325, "x 101.325"),
    "bar_to_kpa": (100.0, "x 100"),
    "psi_to_kpa": (6.89476, "x 6.89476"),
    "mm_s_to_cm_s": (0.1, "x 0.1"),
}

# ----------------------------------------------------------------------------
# Excluded investigations (their tables are not combustion tests)
# ----------------------------------------------------------------------------
EXCLUDED = {
    "PSI-108": "Surface Tension Driven Convection Experiment (PSI research area: Fluid Physics). "
               "Not combustion; it only matched the search word.",
    "PSI-181": "Pb-Sn and Sn-Ag-Cu solders (PSI research area: Materials Science). "
               "Not combustion; it only matched the search word.",
}

# ----------------------------------------------------------------------------
# Fuel names
# ----------------------------------------------------------------------------
# Chemical formulas and plain names as the tables write them -> tidy name.
SPECIES_FORMULA = {
    "CH4": "Methane", "C2H4": "Ethylene", "C2H6": "Ethane", "C3H8": "Propane",
    "H2": "Hydrogen", "C12H26": "Dodecane",
}
SPECIES_NAME = {
    "methane": "Methane", "ethylene": "Ethylene", "ethane": "Ethane",
    "propane": "Propane", "propylene": "Propylene", "butane": "Butane",
    "methanol": "Methanol", "heptane": "Heptane",
}
# BASS / BASS-II write material, shape and size in one free-text cell.
# First keyword found wins (order matters). No keyword -> fuel is null.
BASS_MATERIAL_KEYWORDS = [
    ("pmma", "PMMA"), ("sibal", "SIBAL"), ("nomex", "Nomex"), ("ultem", "Ultem"),
    ("japan wax", "Japan wax"), ("paraffin", "Paraffin wax"), ("parrafin", "Paraffin wax"),
    ("wax", "Wax"),
]  # 'candle' alone is a shape, not a material: it is a fuel_form keyword only (verifier, 14 Nov)
BASS_FORM_KEYWORDS = [
    ("film", "film"), ("sheet", "sheet"), ("slab", "slab"), ("rod", "rod"),
    ("spherical section", "spherical section"), ("sphere", "sphere"), ("candle", "candle"),
]
BASS_SIZE_RE = re.compile(r'(\d+/\d+|\d*\.?\d+)\s*(micron|mm|cm|")(\s*(?:wide|thick))?', re.I)


# ----------------------------------------------------------------------------
# Mapping helpers (only build small dicts, so the table list reads like a table)
# ----------------------------------------------------------------------------
def N(col, to, unit, conv=None, out_unit=None, **opt):
    """A numeric column. to: o2_percent | pressure_kpa | flow_cm_s |
    composition.<gas> | condition.<name> | outcome.<name>.
    opt: cell_units=(...) units that may follow the number inside the cell,
         unit_required=True the cell has to carry the unit (the header has none),
         note_ok=True a trailing "(note N)" is allowed, approx=True the header
         itself says "approx", also=("composition.o2",) second target that keeps
         the source number unconverted, gravity="..." tag for an outcome,
         needs="<column>" this column is computed from that one in the spreadsheet:
         it gives a value only when that column's cell is a clean number."""
    d = {"kind": "num", "col": col, "to": to, "unit": unit, "conv": conv, "out_unit": out_unit}
    d.update(opt)
    return d


def X(col, to, **opt):
    """A text column. to: flow_direction | diluent | condition.<name> |
    outcome.<name> | table_notes.
    opt: lower=True store lower-case, placeholders=("-",) cells that mean "no value",
         alias={cell: value} exact replacements."""
    d = {"kind": "text", "col": col, "to": to}
    d.update(opt)
    return d


def S(col, to, parser, **opt):
    """A column with its own parser (named in SPECIAL_PARSERS)."""
    d = {"kind": "special", "col": col, "to": to, "parser": parser}
    d.update(opt)
    return d


GAS = ("gas", "PSI record, sub_research_area names flames of gaseous fuels")

# ----------------------------------------------------------------------------
# THE MAPPING: one entry per table file
# ----------------------------------------------------------------------------
# Keys:
#   file, psi_id, key (only when the investigation has two tables), header_row,
#   row_kind      what one row of this table is: test | test_day | test_series |
#                 session | dataset_index (a table that is not one-row-per-test
#                 says so here instead of pretending)
#   label         column(s) that give test_label
#   date          (format, column...) -> ISO date when the cell parses, else null;
#                 date_raw always keeps the cell text
#   fuel          how the fuel name is read
#   fuel_phase / fuel_form   (value, where the table or the PSI record states it)
#   fuel_size     parts written as the source writes them
#   o2_basis      what the oxygen number describes
#   columns       the mapped columns
#   skip / fold   rows that are not tests
#   decisions     the judgment calls, in words
TABLES = [
    # ------------------------------------------------------------------ ACME
    {
        "file": "PSI-10_Experimental table_Flame Design_Normal Flame.csv",
        "psi_id": "PSI-10", "key": "normal", "header_row": 0, "row_kind": "test",
        "label": ["Test"], "date": None,
        "fuel": {"method": "pct_species", "col": "Fuel"},
        "fuel_phase": GAS, "fuel_form": None, "fuel_size": None,
        "o2_basis": ("ambient", "columns 'XO2 (init)' and 'XO2 (final)': the chamber gas before and after the test"),
        "columns": [
            X("Flame Type", "condition.flame_type", lower=True),
            N("Day", "condition.test_day_index", "day index"),
            N("Xfuel", "condition.xfuel", "mole fraction"),
            N("mfuel (mg/s)", "condition.mfuel_mg_s", "mg/s"),
            N("mN2 (mg/s)", "condition.mn2_mg_s", "mg/s"),
            N("mtot (mg/s)", "condition.mtot_mg_s", "mg/s"),
            N("XO2 (init)", "o2_percent", "mole fraction", "fraction_to_percent"),
            N("XO2 (final)", "outcome.o2_final_percent", "mole fraction", "fraction_to_percent", "%"),
            N("pinit (atm)", "pressure_kpa", "atm", "atm_to_kpa"),
            N("pfinal (atm)", "outcome.pressure_final_kpa", "atm", "atm_to_kpa", "kPa"),
            N("pmean (atm)", "condition.pressure_mean_kpa", "atm", "atm_to_kpa", "kPa"),
            N("mean Zst", "condition.zst_mean", "dimensionless"),
            N("Tad (K)", "condition.tad_k", "K"),
        ],
        "decisions": [
            "Cells 'RAMP' / 'RAMPED' (flow ramped during the test) are not numbers: null, raw kept.",
            "No date column; the test code (for example 19115A1) is kept as the label and not decoded.",
        ],
    },
    {
        "file": "PSI-10_Experimental table_Flame Design_Inverse Flame.csv",
        "psi_id": "PSI-10", "key": "inverse", "header_row": 0, "row_kind": "test",
        "label": ["Test"], "date": None,
        "fuel": {"method": "header", "name": "Ethylene", "raw": "XC2H4 (column header)"},
        "fuel_phase": GAS, "fuel_form": None, "fuel_size": None,
        "o2_basis": ("burner_stream", "inverse flame: the table gives O2 and N2 as mass flows (mO2, mN2) and the fuel as a "
                                      "chamber mole fraction (XC2H4 initial / final), so XO2 describes the supplied "
                                      "oxidizer stream, not a cabin-like atmosphere"),
        "columns": [
            X("Flame Type", "condition.flame_type", lower=True),
            N("Day", "condition.test_day_index", "day index"),
            N("XO2", "o2_percent", "mole fraction", "fraction_to_percent"),
            N("mO2 (mg/s)", "condition.mo2_mg_s", "mg/s"),
            N("mN2 (mg/s)", "condition.mn2_mg_s", "mg/s"),
            N("mtot (mg/s)", "condition.mtot_mg_s", "mg/s"),
            N("XC2H4 initial", "condition.xc2h4_initial", "mole fraction"),
            N("XC2H4 final", "outcome.xc2h4_final", "mole fraction", None, "mole fraction"),
            N("pinit (atm)", "pressure_kpa", "atm", "atm_to_kpa"),
            N("pfinal (atm)", "outcome.pressure_final_kpa", "atm", "atm_to_kpa", "kPa"),
            N("pmean (atm)", "condition.pressure_mean_kpa", "atm", "atm_to_kpa", "kPa"),
            N("mean Zst", "condition.zst_mean", "dimensionless"),
            N("Tad (K)", "condition.tad_k", "K"),
        ],
        "decisions": [
            "The table has no Fuel column; the fuel is read from the column header 'XC2H4'.",
            "Cells 'RAMP' and 'LOW O2' are not numbers: null, raw kept.",
        ],
    },
    {
        "file": "PSI-20_Experimental table_ACME BRE.csv",
        "psi_id": "PSI-20", "key": None, "header_row": 0, "row_kind": "test_day",
        "label": ["Year", "Month", "Date"], "date": ("ymd_cols", "Year", "Month", "Date"),
        "fuel": {"method": "pct_species", "col": "Fuel Bottle"},
        "fuel_phase": GAS,
        "fuel_form": ("porous circular burner", "PSI record, objectives: 'porous circular burners of 25 and 50 mm diameter'; table column 'Burner Size (mm)'"),
        "fuel_size": [("Burner Size (mm)", "{} mm burner")],
        "o2_basis": ("ambient", "table note: 'Oxygen Conc. (as diluted with nitrogen on a volume basis)'; PSI record objectives: 'O2/N2 ambients'"),
        "columns": [
            N("Burner Size (mm)", "condition.burner_size_mm", "mm"),
            N("Oxygen Conc (percent)", "o2_percent", "percent", cell_units=("%",)),
            N("Flames Ignited", "outcome.flames_ignited", "count", None, "count"),
            X("Notes", "table_notes"),
        ],
        "decisions": [
            "One row is one test day with several flames, not one test (row_kind test_day).",
            "The oxygen cell lists the concentrations used that day ('21; 26.5; 40'): o2_percent is null and the list is in multi.",
            "Two oxygen cells read '3400%' and '2100%' (a spreadsheet percent format on 34 and 21): outside 0..100, so null, raw kept, not corrected.",
            "The table note says chamber pressure was varied but is not in this table: pressure_kpa is null.",
        ],
    },
    {
        "file": "PSI-21_Experimental table_CLD Flame.csv",
        "psi_id": "PSI-21", "key": None, "header_row": 0, "row_kind": "test_day",
        "label": ["Test Day"], "date": ("yyddd", "Test Day"),
        "fuel": {"method": "cld", "col": "Fuel Bottle", "type_col": "Test Type",
                 "type_alias": {"Methane based test": "Methane", "Ethylene based test": "Ethylene"}},
        "fuel_phase": GAS, "fuel_form": None, "fuel_size": None, "o2_basis": None,
        "columns": [
            X("Test Type", "condition.test_type"),
            N("Fuel MFC", "condition.fuel_mfc_max_slpm", "slpm, nitrogen basis (table note)"),
            N("N2 MFC", "condition.n2_mfc_max_slpm", "slpm, nitrogen basis (table note)"),
            N("Fuel conc. Range", "condition.fuel_conc_percent", "percent", None, "%", cell_units=("%",)),
            N("Flames ignited", "outcome.flames_ignited", "count", None, "count"),
            X("Notes", "table_notes"),
        ],
        "decisions": [
            "One row is one test day (row_kind test_day).",
            "The 'Fuel Bottle' column carries a spreadsheet fill series (40% CH4, 40% CH5, ... 40% CH14; 100% C2H4 ... 100% C2H11): "
            "the formula in that cell is not trusted. The fuel is taken from 'Test Type' when it names one "
            "('Methane based test', 'Ethylene based test'); for 'Improved coflow tests' it is taken from the bottle cell only "
            "when the formula is CH4 or C2H4, else null. fuel_raw keeps the bottle cell as written.",
            "'Test Day' is YYDDD (table note): turned into a date.",
            "No oxygen, pressure or flow-speed column: those fields are null.",
        ],
    },
    {
        "file": "PSI-22_Experimental table_ACME E-FIELD Flames.csv",
        "psi_id": "PSI-22", "key": None, "header_row": 0, "row_kind": "test_day",
        "label": ["Test Day"], "date": ("ymd_cols", "Year", "Month", "Date"),
        "fuel": {"method": "pct_species", "col": "Fuel Bottle"},
        "fuel_phase": ("gas", "PSI record, description: 'conducted with gas-fueled flames'"),
        "fuel_form": ("from 'Test Type' cell", "table column 'Test Type' names the burner: coflow burner / gas-jet burner"),
        "fuel_form_keywords": ("Test Type", [("coflow burner", "coflow burner"), ("gas-jet burner", "gas-jet burner")]),
        "fuel_size": None, "o2_basis": None,
        "columns": [
            X("Test Type", "condition.test_type"),
            X("Mesh Polarity", "condition.mesh_polarity", lower=True),
            N("Fuel Conc", "condition.fuel_conc_percent", "percent", None, "%", cell_units=("%",)),
            N("Flames Ignited", "outcome.flames_ignited", "count", None, "count"),
            X("Notes", "table_notes"),
        ],
        "fold": {"only_filled": ["Fuel Conc"], "ignore": ["Notes"], "into": "condition.fuel_conc_percent"},
        "decisions": [
            "One row is one test day (row_kind test_day).",
            "Rows where only 'Fuel Conc' is filled continue the test day above (a second fuel concentration of the same day): "
            "they are folded into that row, whose fuel_conc_percent becomes a list. They are counted as skipped, not as tests.",
            "The last test day (18319) appears twice with identical cells: both rows are kept and the second carries duplicate_of.",
            "No oxygen, pressure or flow-speed column: those fields are null.",
        ],
    },
    {
        "file": "PSI-23_Experimental table_ACME s-Flame.csv",
        "psi_id": "PSI-23", "key": None, "header_row": 0, "row_kind": "test_day",
        "label": ["Test Day*"], "date": ("ymd_cols", "Year", "Month", "Date"),
        "fuel": {"method": "sflame", "col": "Fuel Bottle"},
        "fuel_phase": GAS,
        "fuel_form": ("spherical porous burner", "PSI record, description: 'through a spherical porous burner'"),
        "fuel_size": None,
        "o2_basis": ("ambient", "table column 'Atmosphere*'"),
        "columns": [
            X("Test Type", "condition.test_type"),
            S("Atmosphere*", "o2_percent", "o2_with_diluent"),
            N("Flames Ignited*", "outcome.flames_ignited", "count", None, "count"),
            X("Notes", "table_notes"),
        ],
        "decisions": [
            "One row is one test day (row_kind test_day).",
            "'Atmosphere*' reads like '~21% O2 with N2': the percent is taken as approximate o2_percent and the gas after 'with' as diluent. "
            "'~30% and ~21% O2 with He' gives null with both values in multi.",
            "The column carries a spreadsheet fill series ('with N3', 'with N4' ...): a diluent that is not N2 or He is null, raw kept. "
            "The same series shows in 'Fuel Bottle' ('50% C2H4 with N3'): the fuel is kept, the fuel diluent is null.",
            "The table note says the atmosphere is '~1 atm' but pressure rises with vitiation; no cell gives a pressure, so pressure_kpa is null.",
        ],
    },
    {
        "file": "PSI-159_Experimental table_CFI-G_Normal Flames.csv",
        "psi_id": "PSI-159", "key": "normal", "header_row": 0, "row_kind": "test",
        "label": ["Test"], "date": None,
        "fuel": {"method": "pct_species", "col": "Fuel"},
        "fuel_phase": GAS, "fuel_form": None, "fuel_size": None,
        "o2_basis": ("ambient", "columns 'XO2 before test' and 'XO2 after test': the chamber gas before and after the test"),
        "columns": [
            X("Flame Type", "condition.flame_type", lower=True),
            N("Day", "condition.test_day_index", "day index"),
            X("Cool flame?", "outcome.cool_flame"),
            N("XO2 before test", "o2_percent", "mole fraction", "fraction_to_percent"),
            N("XO2  after test", "outcome.o2_final_percent", "mole fraction", "fraction_to_percent", "%"),
            N("approx p (bar)", "pressure_kpa", "bar", "bar_to_kpa", approx=True),
            N("Xf", "condition.xf", "mole fraction"),
            N("mHC (mg/s)", "condition.mhc_mg_s", "mg/s"),
            X("TFP", "condition.tfp", lower=True),
            N("Tad (K)", "condition.tad_k", "K"),
            N("Zst", "condition.zst", "dimensionless"),
            X("Hot ignition", "outcome.hot_ignition", lower=True),
            N("burn time (sec)", "outcome.burn_time_s", "s", None, "s"),
            X("Self-ext or flow term", "outcome.self_ext_or_flow_term", placeholders=("-",)),
            N("Peak burner T (C )", "outcome.peak_burner_temp_c", "C", None, "C"),
            X("Comments", "outcome.comment"),
        ],
        "decisions": [
            "The header says 'approx p (bar)': pressure_kpa is converted and marked approx in every row.",
            "'#DIV/0!' in Tad / Zst and '-' in peak burner temperature are not numbers: null, raw kept.",
            "'Xf', 'TFP', 'SE' / 'FT' are kept under the names the table uses; the table does not spell them out.",
        ],
    },
    {
        "file": "PSI-159_Experimental table_CFI-G_Inverse Flames.csv",
        "psi_id": "PSI-159", "key": "inverse", "header_row": 0, "row_kind": "test",
        "label": ["Test"], "date": None,
        "fuel": {"method": "pct_species", "col": "Fuel"},
        "fuel_phase": GAS, "fuel_form": None, "fuel_size": None,
        "o2_basis": ("burner_stream", "inverse flame: the table gives 'O2 flow rate (mg/s)' and the fuel as a chamber mole "
                                      "fraction ('Xf before test' / 'Xf after test'), so XO2 describes the supplied "
                                      "oxidizer stream, not a cabin-like atmosphere"),
        "columns": [
            X("Flame Type", "condition.flame_type", lower=True),
            N("Day", "condition.test_day_index", "day index"),
            N("Xf  before test", "condition.xf_before_test", "mole fraction"),
            N("Xf  after test", "outcome.xf_after_test", "mole fraction", None, "mole fraction"),
            N("approx p (bar)", "pressure_kpa", "bar", "bar_to_kpa", approx=True),
            N("XO2", "o2_percent", "mole fraction", "fraction_to_percent"),
            N("HC burnrate (mg/s)", "condition.hc_burnrate_mg_s", "mg/s"),
            N("O2 flow rate (mg/s)", "condition.o2_flow_rate_mg_s", "mg/s"),
            X("TFP", "condition.tfp", lower=True),
            N("Tad (K)", "condition.tad_k", "K"),
            N("Zst", "condition.zst", "dimensionless"),
            X("Hot ignition", "outcome.hot_ignition", lower=True),
            N("burn time (sec)", "outcome.burn_time_s", "s", None, "s"),
            X("Self -ext or flow term", "outcome.self_ext_or_flow_term", placeholders=("-",)),
            N("Peak burner Temp (C)", "outcome.peak_burner_temp_c", "C", None, "C"),
            N("Peak burner temp (K)", "outcome.peak_burner_temp_k", "K", None, "K", needs="Peak burner Temp (C)"),
            X("Color", "outcome.flame_color", lower=True, placeholders=("-",)),
            X("Comments", "outcome.comment"),
        ],
        "skip": [("blank row", ("blank",))],
        "decisions": [
            "The file has several hundred empty records after the last test: skipped as blank rows.",
            "The header says 'approx p (bar)': pressure_kpa is converted and marked approx in every row.",
            "'#VALUE!' and '-' in peak burner temperature are not numbers: null, raw kept.",
            "'Peak burner temp (K)' equals 'Peak burner Temp (C)' + 273.15 in every row (a spreadsheet formula). In row 130 the Celsius cell is "
            "empty and the Kelvin cell reads 273.15: that is the formula on a blank, not a measurement, so the Kelvin value is null there, raw kept.",
        ],
    },
    # ------------------------------------------------------ MSG flow duct
    {
        "file": "PSI-25_Experimental table_BASS-II.csv",
        "psi_id": "PSI-25", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["Test #"], "date": ("mdy", "Date"),
        "fuel": {"method": "bass_keywords", "col": "Fuel Sample Material"},
        "fuel_phase": ("solid", "PSI record, title 'Burning and Suppression of Solids - II' and objectives: 'solid fuels burning in low-velocity forced flows'"),
        "fuel_form": ("from the fuel cell", "shape word written in 'Fuel Sample Material' (film, sheet, slab, rod, sphere, candle)"),
        "fuel_size": "bass_regex",
        "o2_basis": ("ambient", "column 'Calibrated initial O2 % by vol'; PSI record: oxygen lowered by adding nitrogen to the working volume"),
        "columns": [
            X("Sample #", "condition.sample_number"),
            N("Flow restrictor", "condition.flow_restrictor", "setting (no unit in the table)"),
            N("Fan display", "condition.fan_display", "display reading (no unit in the table)"),
            N("Air display", "condition.air_display", "display reading (no unit in the table)"),
            N("Radiometer gain   (1000   250   50   10)", "condition.radiometer_gain", "gain setting"),
            N("Calibrated  initial O2 % by vol", "o2_percent", "percent by volume"),
            N("Calibrated final O2 % by vol", "outcome.o2_final_percent", "percent by volume", None, "%"),
            N("Initial CO2 % by vol", "condition.co2_initial_percent", "percent by volume"),
            N("Final CO2 % by vol", "outcome.co2_final_percent", "percent by volume", None, "%"),
            N("Initial CO (ppm)", "condition.co_initial_ppm", "ppm"),
            N("Final CO (ppm)", "outcome.co_final_ppm", "ppm", None, "ppm"),
        ],
        "decisions": [
            "'Fan display' and 'Air display' are instrument readings with no unit in the table and often several settings in one cell: "
            "they are kept as conditions and NOT turned into flow_cm_s, which stays null.",
            "The fuel cell is free text ('100 micron PMMA film   2 cm wide', '1/4\" clear rod'): the material is named only when the cell names it. "
            "Rods, spheres and films written without a material give fuel null with the shape in fuel_form; fuel_raw keeps the cell.",
            "fuel_size is the size phrases found in the fuel cell, as written.",
            "'none', 'OR', 'over', '>500' in the gas columns are not numbers: null, raw kept.",
            "No pressure column: pressure_kpa is null.",
            "Kept as written although they look like entry slips in the source: final O2 of 1.6, 0.6, 39.1, 0.9 and 40.4 percent "
            "(rows 2, 96, 97, 127, 128; the initial O2 of those rows is 20 to 22.2), 'Fan display' 80122 (row 114), initial CO of -3 and -1 ppm. "
            "They pass the gates, so the numbers are in outcomes / conditions; o2_percent uses the initial O2 column only.",
        ],
    },
    {
        "file": "PSI-26_Experimental table_BASS.csv",
        "psi_id": "PSI-26", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["Test #"], "date": ("mdy", "Date"),
        "fuel": {"method": "bass_keywords", "col": "Fuel Sample Material"},
        "fuel_phase": ("solid", "PSI record, title 'Burning and Suppression of Solids'"),
        "fuel_form": ("from the fuel cell", "shape word written in 'Fuel Sample Material' (film, sheet, slab, rod, sphere, candle)"),
        "fuel_size": "bass_regex",
        "o2_basis": None,
        "columns": [
            X("As Run Test #", "condition.as_run_test_number"),
            X("Sample #", "condition.sample_number"),
        ],
        "skip": [("maintenance row ('SOOT Cleaning'), not a test", ("equals", "Fuel Sample Material", "SOOT Cleaning"))],
        "decisions": [
            "The table lists date, test numbers, sample number and the fuel sample only: oxygen, pressure and flow are null.",
            "flow_direction is 'opposed' only where the fuel cell writes the word 'opposed'.",
            "A cell that reads only 'candle' (rows 47-49) names a shape and no material: fuel is null, fuel_form is 'candle'. "
            "'flat wax slab' gives 'Wax'; 'Japan wax' and 'paraffin' / 'parrafin' are named as the cell writes them.",
            "One row ('SOOT Cleaning') is a maintenance entry without a test number: skipped.",
        ],
    },
    {
        "file": "PSI-106_Experimental table_Slice.csv",
        "psi_id": "PSI-106", "key": None, "header_row": 0, "row_kind": "test_day",
        "label": "@date", "date": ("iso_mon_prefix", "Test Date"),
        "fuel": {"method": "pct_species", "col": "Fuel Type"},
        "fuel_phase": None, "fuel_form": None, "fuel_size": None, "o2_basis": None,
        "columns": [],
        "decisions": [
            "One row is one test day (row_kind test_day). The table has two columns: date and fuel type.",
            "The date cell sometimes carries spilled text ('2012-FEB-13 SLICE testing with'): the leading date is parsed and used as the label, date_raw keeps the cell.",
            "Fuel cells like '40% CH4 (balance N2) including 2 pyrometry calibration tests' give fuel, fuel_percent and fuel_diluent; the rest stays raw.",
            "fuel_phase is null: neither the table nor the PSI record states it in words.",
            "Row 12: the date cell ends '... SPICE testing with 100% C3H8 and then 100%' and the fuel cell reads '100% C2H4'. "
            "Only the fuel cell is read (Ethylene); the propane named in the date cell stays in date_raw and raw.",
        ],
    },
    {
        "file": "PSI-107_Experimental table_Spice.csv",
        "psi_id": "PSI-107", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["GMT date", "GMT ignition"], "date": ("raw", "GMT date"),
        "fuel": {"method": "pct_species", "col": "Fuel"},
        "fuel_phase": None,
        "fuel_form": ("jet from a nozzle", "table column 'Nozzle (mm)'; PSI record, objectives: 'non-buoyant jet diffusion flames'"),
        "fuel_size": [("Nozzle (mm)", "{} mm nozzle")],
        "o2_basis": None,
        "columns": [
            N("Nozzle (mm)", "condition.nozzle_mm", "mm"),
            N("Fuel Rate (sccm)", "condition.fuel_rate_sccm", "sccm"),
            N("Fuel Rate (mg/s)", "condition.fuel_rate_mg_s", "mg/s"),
            N("HC Fuel Rate (mg/s)", "condition.hc_fuel_rate_mg_s", "mg/s"),
            N("Air Rate (cm/s)", "flow_cm_s", "cm/s"),
            X("GMT  Flame Off", "condition.gmt_flame_off"),
        ],
        "decisions": [
            "'GMT date' is a day of year without a year: date is null, date_raw keeps it; the label joins day and ignition time.",
            "Several rows share one ignition time (several flow settings of one flame) and some rows are identical: all kept, identical ones carry duplicate_of.",
            "'Air Rate (cm/s)' is taken as flow_cm_s as written, negative readings included (8 rows: -0.28 and -5.92).",
            "fuel_phase is null: neither the table nor the PSI record states it in words. No oxygen or pressure column.",
        ],
    },
    # -------------------------------------------------------------- droplets
    {
        "file": "PSI-39_Experimental table_CFI.csv",
        "psi_id": "PSI-39", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["Flex Number"], "date": ("dmony", "Test Date"),
        "fuel": {"method": "alias", "col": "Fuel", "alias": {
            "C12H26": "Dodecane",
            "[.75]/[.25] C12H26/iso-dodecane": "Dodecane / iso-dodecane (0.75/0.25)",
            "[.60]/[.40] C12H26/iso-dodecane": "Dodecane / iso-dodecane (0.60/0.40)",
        }},
        "fuel_phase": ("liquid", "PSI record: sub_research_area 'Droplets'; description: 'Droplets of fuel are dispensed' from fuel syringes"),
        "fuel_form": ("droplet", "PSI record: sub_research_area 'Droplets'; hardware 'Multi-User Droplet Combustion Apparatus'"),
        "fuel_size": None,
        "o2_basis": ("ambient", "PSI record, description: 'delivers the desired gas mixture to the combustion chamber'"),
        "diluent": "from_composition",
        "columns": [
            N("Pressure", "pressure_kpa", "atm (written in the cell)", "atm_to_kpa", cell_units=("atm",), unit_required=True),
            N("Oxygen", "o2_percent", "fraction of 1 (unit not written)", "fraction_to_percent", also=("composition.o2",)),
            N("Nitrogen", "composition.n2", "fraction of 1 (unit not written)"),
            N("Helium", "composition.he", "fraction of 1 (unit not written)"),
            X("Fiber", "condition.fiber", lower=True),
            X("CIR", "condition.cir_run_id"),
        ],
        "decisions": [
            "'Oxygen', 'Nitrogen', 'Helium' have no unit in the header; the cells are fractions of 1 (0.21 / 0.79 / 0; the three add up to 0.97-1.00 in every row), read as mole fractions.",
            "The table has no CO2 column: composition.co2 is null.",
            "No droplet size column in this table: fuel_size is null.",
        ],
    },
    {
        "file": "PSI-68_Experimental table_Flex2.csv",
        "psi_id": "PSI-68", "key": None, "header_row": 0, "row_kind": "test_series",
        "label": ["Sample (Fuel Type)"], "date": None,
        "fuel": {"method": "alias", "col": "Sample (Fuel Type)", "alias": {
            "IsoOctane (pure)": "Isooctane", "n-Octane (pure)": "n-Octane", "Heptane (pure)": "Heptane",
            "Decane (pure)": "Decane", "Ethanol (pure)": "Ethanol",
            "Propanol (95%) Glycerol (5%) (mixture)": "Propanol / Glycerol (95/5)",
            "Heptane (50%) IsoOctane (50%) (mixture)": "Heptane / Isooctane (50/50)",
            "Propanol (80%) Glycerol (20%) (mixture)": "Propanol / Glycerol (80/20)",
        }},
        "fuel_phase": ("liquid", "PSI record, objectives: 'liquid-phase mixing ... of bi-component fuel droplets'"),
        "fuel_form": ("droplet", "table column 'Initial Droplet Diameter (mm)'"),
        "fuel_size": [("Initial Droplet Diameter (mm)", "{} mm")],
        "o2_basis": ("ambient", "table column 'Ambient Gas Mixture'"),
        "columns": [
            N("Initial Droplet Diameter (mm)", "condition.droplet_diameter_mm", "mm"),
            X("Ambient Gas Mixture", "diluent", alias={"O2/N2 or O2/He": "N2 or He"}),
            N("Oxygen Mole Fraction", "o2_percent", "mole fraction", "fraction_to_percent"),
            N("Ambient Pressure (atm)", "pressure_kpa", "atm", "atm_to_kpa"),
            N("Ambient Temperature (C)", "condition.ambient_temperature_c", "C"),
            N("Flow Velocity (cm/s)", "flow_cm_s", "cm/s"),
        ],
        "decisions": [
            "One row is one fuel with the ranges tested for it, not one test (row_kind test_series).",
            "Every condition cell is a list or a range ('0.17; 0.21;0.25; 0.3', '0.5; 1.0; 1.5; 2.0; or 3.0', '0.1 - 5'): the single-value fields are null and the values are in multi.",
        ],
    },
    {
        "file": "PSI-69_Experimental table_FLEX.csv",
        "psi_id": "PSI-69", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["FLEX Test #"], "date": ("mdy", "Test Date"),
        "fuel": {"method": "pct_species", "col": "Fuel"},
        "fuel_phase": ("liquid", "PSI record, objectives: 'map the flammability limits of liquid fuels'"),
        "fuel_form": ("droplet", "table column 'Droplet initial diameter; mm'"),
        "fuel_size": [("Droplet initial diameter; mm", "{} mm")],
        "o2_basis": ("ambient", "column header: 'initial ambient composition'"),
        "diluent": "from_composition",
        "columns": [
            X("FLEX Identifier", "condition.flex_identifier"),
            N("Ambient pressure; mmHg", "pressure_kpa", "mmHg", "mmhg_to_kpa"),
            N("O initial ambient composition; mole fraction", "o2_percent", "mole fraction", "fraction_to_percent", also=("composition.o2",)),
            N("N initial ambient composition; mole fraction", "composition.n2", "mole fraction"),
            N("CO initial ambient composition; mole fraction", "composition.co2", "mole fraction"),
            N("He initial ambient composition; mole fraction", "composition.he", "mole fraction"),
            N("Droplet initial diameter; mm", "condition.droplet_diameter_mm", "mm"),
            N("Visible flame extinction diameter; mm", "outcome.flame_extinction_diameter_mm", "mm", None, "mm"),
            N("Burning rate; mm", "outcome.burning_rate", "mm (as the header writes it)", None, "mm (as the header writes it)"),
            N("Burn time; s", "outcome.burn_time_s", "s", None, "s"),
            X("Test end", "outcome.test_end", lower=True),
        ],
        "decisions": [
            "The gas headers read 'O', 'N', 'CO', 'He' in the saved file: the digit 2 is missing in the first three (O2, N2). "
            "'O' is read as O2, 'N' as N2 and 'CO' as CO2; the PSI record names CO2 and He as the suppressants. "
            "This is the one place where a header is read as something it does not literally say.",
            "The file is Windows-1252, not UTF-8; cells holding only a dash mean no value: null, raw kept.",
            "One pressure cell is '0' mmHg (row 114): fails the pressure gate, null, raw kept.",
            "The header gives the burning rate unit as 'mm'; it is kept as written.",
        ],
    },
    # --------------------------------------------------------------- Saffire
    {
        "file": "PSI-98_Experimental table_SAFFIRE-1.csv",
        "psi_id": "PSI-98", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["Sample Number"], "date": None,
        "fuel": {"method": "alias", "col": "Material", "alias": {"SIBAL Fabric": "SIBAL"}, "form_alias": {"SIBAL Fabric": "fabric"}},
        "fuel_phase": ("solid", "table columns 'Sample Thickness / Length / Width' describe a solid sample; PSI record: 'composite fabric'"),
        "fuel_form": ("from the material cell", "'SIBAL Fabric'"),
        "fuel_size": [("Sample Thickness (cm)", "thickness {} cm"), ("Sample Length (cm)", "length {} cm"), ("Sample Width (cm)", "width {} cm")],
        "o2_basis": ("ambient", "table column 'Percent O2'"),
        "columns": [
            N("Air Flow (cm/s)", "flow_cm_s", "cm/s"),
            N("Percent O2", "o2_percent", "percent"),
            N("Ignition Power (W)", "condition.ignition_power_w", "W"),
            N("Ignition Time (s)", "condition.ignition_time_s", "s"),
            N("Burn Time (s)", "outcome.burn_time_s", "s", None, "s"),
            X("Flow Direction", "flow_direction", lower=True),
        ],
        "skip": [("flow visualization data row, not a burn sample", ("startswith", "Material", "Pre-test flow"))],
        "decisions": [
            "Oxygen cells are '21.5 - 21.7' (a range: null, values in multi) and '~ 21.5' (21.5, marked approx).",
            "Two rows list pre-test flow visualization data, not burn samples: skipped.",
            "fuel_size is written as the table gives it: thickness 0.37 under a '(cm)' header, length 40.6, width 94. "
            "(SAFFIRE-II writes the same fabric as '037 mm' and the PSI record says about 0.94 m long and 0.4 m wide; not corrected.)",
            "No pressure column: pressure_kpa is null.",
        ],
    },
    {
        "file": "PSI-99_Experimental table_SAFFIRE-2.csv",
        "psi_id": "PSI-99", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["Sample Number"], "date": None,
        "fuel": {"method": "alias", "col": "Material", "alias": {
            "Silicone": "Silicone", "Cotton-Fiberglass (SIBAL)": "SIBAL", "PMMA & Nomex": "PMMA + Nomex", "PMMA": "PMMA"}},
        "fuel_phase": ("solid", "table columns 'Sample Thickness / Length / Width' describe a solid sample"),
        "fuel_form": None,
        "fuel_size": [("Samle Thickness", "thickness {}"), ("Sample Length", "length {}"), ("Sample Width (cm)", "width {}")],
        "o2_basis": ("ambient", "table column 'Percent O2 (Note 1)': referenced to the initial O2 concentration reported by ISS"),
        "columns": [
            N("Air Flow (cm/s)", "flow_cm_s", "cm/s", cell_units=("cm/s",)),
            N("Percent O2 (Note 1)", "o2_percent", "percent"),
            N("Ignition Power (W)", "condition.ignition_power_w", "W", cell_units=("W",)),
            N("Ignition Time (s)", "condition.ignition_time_s", "s", cell_units=("s",)),
            N("Burn Time (s)", "outcome.burn_time_s", "s", None, "s", cell_units=("s",)),
            X("Flow Direction", "flow_direction", lower=True),
            N("?-g Burn Length", "outcome.microgravity_burn_length_cm", "cm (written in the cell)", None, "cm",
              cell_units=("cm",), unit_required=True, note_ok=True, gravity="microgravity"),
            N("?-g Spread Length", "outcome.microgravity_spread_rate_cm_s", "mm/s (written in the cell)", "mm_s_to_cm_s", "cm/s",
              cell_units=("mm/s",), unit_required=True, note_ok=True, gravity="microgravity"),
            N("1-g Burn Length", "outcome.normal_gravity_burn_length_cm", "cm (written in the cell)", None, "cm",
              cell_units=("cm",), unit_required=True, note_ok=True, gravity="normal gravity (1-g)"),
            N("1-g Spread Rate", "outcome.normal_gravity_spread_rate_cm_s", "mm/s (written in the cell)", "mm_s_to_cm_s", "cm/s",
              cell_units=("mm/s",), unit_required=True, note_ok=True, gravity="normal gravity (1-g)"),
        ],
        "skip": [
            ("flow visualization data row, not a burn sample", ("startswith", "Material", "Pre-test flow")),
            ("table note row (kept under the table's notes)", ("startswith", "Sample Number", "Note ")),
        ],
        "note_rows": ("startswith", "Sample Number", "Note "),
        "fill_hint": "Material",
        "decisions": [
            "The table has the microgravity result and the normal-gravity (1-g) result side by side: they are four separate outcomes, each tagged with its gravity. "
            "The test's own gravity stays the investigation's (microgravity).",
            "The two microgravity headers start with '?' in the saved file ('?-g Burn Length'); they sit beside the '1-g' columns and are read as the low-gravity ones. "
            "The second is titled 'Spread Length' but its cells are rates in mm/s: stored as a spread rate.",
            "Cells carry their unit ('20 cm/s', '2.1 mm/s', '29 cm'); text results ('Complete', 'Acceleratory', 'Insignificant', 'n/a', 'Note 4') are null with raw kept. '~ 0' is read as 0.",
            "Samples 2-6 and 2-9 have an empty Material cell (it looks like a merged cell under the one above): fuel stays null and "
            "'fuel_from_row_above' shows what the cell above reads, as a hint that is not asserted.",
            "Thickness cells '037 mm' and 'See Fig. 5' go into fuel_size as written.",
            "Rows for flow visualization data and the four note rows are skipped; the notes are kept as table notes.",
        ],
    },
    {
        "file": "PSI-100_Experimental table_SAFFIRE-3.csv",
        "psi_id": "PSI-100", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["Sample Number"], "date": None,
        "fuel": {"method": "alias", "col": "Material", "alias": {"SIBAL Fabric": "SIBAL"}, "form_alias": {"SIBAL Fabric": "fabric"}},
        "fuel_phase": ("solid", "table columns 'Sample Thickness / Length / Width' describe a solid sample"),
        "fuel_form": ("from the material cell", "'SIBAL Fabric'"),
        "fuel_size": [("Sample Thickness", "thickness {}"), ("Sample Length", "length {}"), ("Sample Width", "width {}")],
        "o2_basis": None,
        "columns": [
            N("Air Flow", "flow_cm_s", "cm/s (written in the cell)", cell_units=("cm/s",), unit_required=True),
            X("Direction", "flow_direction", lower=True),
        ],
        "decisions": ["No oxygen or pressure column in this table: both are null."],
    },
    # ----------------------------------------------------------------- smoke
    {
        "file": "PSI-101_Experimental table_SAME-R.csv",
        "psi_id": "PSI-101", "key": None, "header_row": 0, "row_kind": "test",
        "label": ["SAME Test #"], "date": ("raw", "Date"),
        "fuel": {"method": "alias", "col": "Sample Type", "alias": {
            "Kapton": "Kapton", "Silicone": "Silicone", "Lampwick": "Lampwick", "Teflon": "Teflon", "Pyrell": "Pyrell"}},
        "fuel_phase": None, "fuel_form": None, "fuel_size": None, "o2_basis": None,
        "columns": [
            X("Description", "condition.description"),
            N("Inlet velocity (cm/s)", "flow_cm_s", "cm/s"),
            N("Rt/R0", "condition.rt_r0", "ratio"),
            N("Duration (sec)", "condition.duration_s", "s"),
            N("Primary aging time (sec)", "condition.primary_aging_time_s", "s"),
            N("Primary mixing time (sec)", "condition.primary_mixing_time_s", "s"),
            N("Net aging time (sec)", "condition.net_aging_time_s", "s"),
        ],
        "decisions": [
            "The 'fuel' here is the sample material that is heated to make smoke (PSI calls the column 'Sample Type', not fuel).",
            "'Date' has day and month but no year ('21-Jul'): date is null, date_raw keeps it.",
            "No oxygen or pressure column.",
        ],
    },
    {
        "file": "PSI-102_Experimental table_SAME.csv",
        "psi_id": "PSI-102", "key": None, "header_row": 0, "row_kind": "test",
        "row_kind_when": [(("contains", "Sample Material", "same conditions as"), "test_group_reference")],
        "label": ["Sample #"], "date": None,
        "fuel": {"method": "alias", "col": "Sample Material", "alias": {
            "Teflon": "Teflon", "Kapton: same conditions as 1-4": "Kapton",
            "Silicone Rubber: same conditions as 1-4": "Silicone rubber",
            "Lampwick: same conditions as 1-4": "Lampwick",
            "Dibutyl Phthalate: same conditions as 1-4": "Dibutyl phthalate"}},
        "fuel_phase": None, "fuel_form": None, "fuel_size": None, "o2_basis": None,
        "columns": [
            N("Air Flow (cm/s)", "flow_cm_s", "cm/s"),
            N("Weight loss rate (mg/min)", "outcome.weight_loss_rate_mg_min", "mg/min", None, "mg/min"),
            N("Aging Duration (minutes)", "condition.aging_duration_min", "min"),
        ],
        "decisions": [
            "Rows 1-4 are Teflon tests with numbers. Rows 5-8 name another material and say 'same conditions as 1-4' with empty cells: "
            "they are kept as written (row_kind test_group_reference) and their numbers are NOT copied from rows 1-4.",
            "The 'fuel' here is the sample material that is heated to make smoke.",
        ],
    },
    {
        "file": "PSI-47_Experimental table_DAFT.csv",
        "psi_id": "PSI-47", "key": None, "header_row": 0, "row_kind": "session",
        "label": ["Session Name"], "date": ("gmt_day_year", "Actual Day"),
        "fuel": None, "fuel_phase": None, "fuel_form": None, "fuel_size": None, "o2_basis": None,
        "columns": [
            X("Hardware Description", "condition.hardware_description"),
            X("Sample Material", "condition.sample_material"),
            X("Sampled Location", "condition.sampled_location"),
        ],
        "decisions": [
            "DAFT measured dust aerosol with the SAME particle counter; nothing burns. One row is one measurement session (row_kind session).",
            "The sample material (Arizona Road Dust) is not a fuel: fuel is null and the material is a condition.",
        ],
    },
    # ---------------------------------------------------- ground investigation
    {
        "file": "PSI-142_Experimental table_Data Summary Table.csv",
        "psi_id": "PSI-142", "key": None, "header_row": 0, "row_kind": "dataset_index",
        "label": ["Data ID"], "date": None,
        "fuel": None, "fuel_phase": None, "fuel_form": None, "fuel_size": None, "o2_basis": None,
        "columns": [
            X("Data Description", "condition.data_description"),
            X("Reference Publication Link", "condition.reference_publication_link"),
            X("Figure ID in Reference", "condition.figure_id_in_reference"),
        ],
        "decisions": [
            "This table is an index of data sets (description, paper link, figure number), not a list of tests: "
            "rows are kept with row_kind dataset_index and every normalized test field is null.",
            "The PSI record is a 'Ground Investigation' and does not state a gravity level: gravity is null.",
        ],
    },
]

# ----------------------------------------------------------------------------
# Cell parsing
# ----------------------------------------------------------------------------
SINGLE_RE = re.compile(r'(~)?\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*(.*)', re.S)
NOTE_RE = re.compile(r'\s*\((note \d+)\)\s*$', re.I)
LIST_SPLIT_RE = re.compile(r';|\bor\b|\band\b')
RANGE_SPLIT_RE = re.compile(r'\s+(?:-|–|to)\s+|(?<=[\d%])-(?=[\d~.])')
MONTHS = {"jan": 1, "feb": 2, "mar": 3, "march": 3, "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
          "jul": 7, "july": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12}


def clean_num(v):
    """Round float noise away; whole numbers become ints."""
    v = round(v, 6)
    if v == int(v) and abs(v) < 1e15:
        return int(v)
    return v


def single_number(s, units, required):
    """-> (value, approx) or None."""
    m = SINGLE_RE.fullmatch(s.strip())
    if not m:
        return None
    numtxt, rest = m.group(2), m.group(3).strip()
    if re.fullmatch(r'[-+]?0\d+', numtxt.split(".")[0]):
        return None  # "037": not a clean number
    if rest and rest not in units:
        return None
    v = float(numtxt)
    if not rest and required and v != 0:
        return None
    return (v, bool(m.group(1)))


def parse_number_cell(text, spec):
    """-> dict(kind = empty | number | list | range | raw, values, approx, note)."""
    s = text.strip()
    if not s:
        return {"kind": "empty"}
    note = None
    if spec.get("note_ok"):
        m = NOTE_RE.search(s)
        if m:
            note = m.group(1)
            s = s[:m.start()].strip()
    units = spec.get("cell_units", ())
    required = spec.get("unit_required", False)
    one = single_number(s, units, required)
    if one:
        return {"kind": "number", "values": [one[0]], "approx": one[1], "note": note}
    parts = [p.strip() for p in LIST_SPLIT_RE.split(s) if p.strip()]
    if len(parts) >= 2:
        got = [single_number(p, units, required) for p in parts]
        if all(got):
            return {"kind": "list", "values": [g[0] for g in got], "approx": any(g[1] for g in got), "note": note}
    parts = [p.strip() for p in RANGE_SPLIT_RE.split(s) if p.strip()]
    if len(parts) == 2:
        got = [single_number(p, units, required) for p in parts]
        if all(got):
            return {"kind": "range", "values": [g[0] for g in got], "approx": any(g[1] for g in got), "note": note}
    return {"kind": "raw"}


def in_gate(spec, source_value, target_value):
    """Sanity gates, see the rules at the top."""
    to = spec["to"]
    if spec.get("conv") == "fraction_to_percent" or to.startswith("composition."):
        if not (0 <= source_value <= 1):
            return False
    if to == "o2_percent" and not (0 <= target_value <= 100):
        return False
    if to == "pressure_kpa" and not (target_value > 0):
        return False
    return True


def convert(spec, v):
    conv = spec.get("conv")
    if conv:
        return clean_num(v * CONVERSIONS[conv][0])
    return clean_num(v)


def parse_o2_with_diluent(text):
    """s-Flame 'Atmosphere*': '~21% O2 with N2', '~30% and ~21% O2 with He'."""
    s = text.strip()
    if not s:
        return {"kind": "empty"}
    m = re.fullmatch(r'((?:~?\s*\d+(?:\.\d+)?\s*%\s*(?:and\s*)?)+)O2 with (\S+)', s)
    if not m:
        return {"kind": "raw"}
    found = re.findall(r'(~?)\s*(\d+(?:\.\d+)?)\s*%', m.group(1))
    values = [float(n) for _, n in found]
    approx = any(a for a, _ in found)
    token = m.group(2)
    out = {"kind": "number" if len(values) == 1 else "list", "values": values, "approx": approx, "note": None,
           "diluent": token if token in ("N2", "He") else None, "diluent_raw": token}
    return out


SPECIAL_PARSERS = {"o2_with_diluent": parse_o2_with_diluent}


# ----------------------------------------------------------------------------
# Dates
# ----------------------------------------------------------------------------
def iso(y, m, d):
    try:
        return datetime.date(int(y), int(m), int(d)).isoformat()
    except (ValueError, TypeError):
        return None


def parse_date(spec, rowd):
    """-> (iso or None, raw text or None)."""
    if not spec:
        return None, None
    fmt, cols = spec[0], spec[1:]
    cells = [rowd.get(c, "").strip() for c in cols]
    raw = " ".join(c for c in cells if c) or None
    if raw is None:
        return None, None
    if fmt == "raw":
        return None, raw
    if fmt == "mdy":
        m = re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{4})', cells[0])
        return (iso(m.group(3), m.group(1), m.group(2)) if m else None), raw
    if fmt == "dmony":
        m = re.fullmatch(r'(\d{1,2})-([A-Za-z]{3})-(\d{2})', cells[0])
        if m and m.group(2).lower() in MONTHS:
            return iso(2000 + int(m.group(3)), MONTHS[m.group(2).lower()], m.group(1)), raw
        return None, raw
    if fmt == "ymd_cols":
        y, mo, d = cells
        mo_key = mo.lower().rstrip(".")
        mon = int(mo) if mo.isdigit() else MONTHS.get(mo_key)
        if y.isdigit() and d.isdigit() and mon:
            return iso(y, mon, d), raw
        return None, raw
    if fmt == "yyddd":
        m = re.fullmatch(r'(\d{2})(\d{3})', cells[0])
        if m and 1 <= int(m.group(2)) <= 366:
            try:
                day = datetime.date(2000 + int(m.group(1)), 1, 1) + datetime.timedelta(days=int(m.group(2)) - 1)
                return day.isoformat(), raw
            except (ValueError, OverflowError):
                return None, raw
        return None, raw
    if fmt == "iso_mon_prefix":
        m = re.match(r'(\d{4})-([A-Za-z]{3})-(\d{2})\b', cells[0])
        if m and m.group(2).lower() in MONTHS:
            return iso(m.group(1), MONTHS[m.group(2).lower()], m.group(3)), raw
        return None, raw
    if fmt == "gmt_day_year":
        m = re.fullmatch(r'GMT (\d{1,3}) \((\d{4})\)', cells[0])
        if m and 1 <= int(m.group(1)) <= 366:
            day = datetime.date(int(m.group(2)), 1, 1) + datetime.timedelta(days=int(m.group(1)) - 1)
            return day.isoformat(), raw
        return None, raw
    raise ValueError("unknown date format " + fmt)


# ----------------------------------------------------------------------------
# Fuel
# ----------------------------------------------------------------------------
def species(token):
    if token in SPECIES_FORMULA:
        return SPECIES_FORMULA[token]
    return SPECIES_NAME.get(token.lower())


PCT_SPECIES_RE = re.compile(r'\s*(?:(\d+(?:\.\d+)?)\s*%\s*)?([A-Za-z][A-Za-z0-9]*)\s*(.*?)\s*', re.S)


def fuel_pct_species(cell):
    """'[NN%] species [(balance X)] [free text]' -> name, percent, fuel diluent."""
    out = {"name": None}
    m = PCT_SPECIES_RE.fullmatch(cell)
    if not m:
        return out
    out["name"] = species(m.group(2))
    if m.group(1) is not None:
        out["percent"] = clean_num(float(m.group(1)))
    b = re.match(r'\(balance (\w+)\)', m.group(3))
    if b:
        out["fuel_diluent"] = b.group(1)
    return out


def fuel_sflame(cell):
    """'50% C2H4 with N2', '44.4% H2 with CH4', '25% H2, 20% CH4, with He', '100% H2'."""
    out = {"name": None}
    left, sep, right = cell.partition("with")
    items = [p.strip() for p in left.split(",") if p.strip()]
    names = []
    for it in items:
        m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*%\s*([A-Za-z0-9]+)', it)
        if not m or not species(m.group(2)):
            return out
        names.append(species(m.group(2)))
        if len(items) == 1:
            out["percent"] = clean_num(float(m.group(1)))
    token = right.strip() if sep else ""
    if token:
        if species(token):
            names.append(species(token))
        elif token in ("N2", "He"):
            out["fuel_diluent"] = token
        else:
            out["note"] = "the gas after 'with' reads '%s' (spreadsheet fill series); fuel diluent left null" % token
    if names:
        out["name"] = " / ".join(names)
    if len(names) != 1:
        out.pop("percent", None)  # '44.4% H2 with CH4': the percent belongs to one part of a mixture
    return out


def fuel_bass(cell):
    low = cell.lower()
    out = {"name": None}
    for key, name in BASS_MATERIAL_KEYWORDS:
        if key in low:
            out["name"] = name
            break
    for key, form in BASS_FORM_KEYWORDS:
        if key in low:
            out["form"] = form
            break
    sizes = []
    for m in BASS_SIZE_RE.finditer(cell):
        sizes.append(re.sub(r'\s+', ' ', m.group(0)).strip())
    if sizes:
        out["size"] = "; ".join(sizes)
    if re.search(r'\bopposed\b', low):
        out["direction"] = "opposed"
    return out


def fuel_cld(cell, type_cell, type_alias):
    out = fuel_pct_species(cell)
    bottle_name = out.get("name")
    out["name"] = None
    t = type_cell.strip()
    if t in type_alias:
        out["name"] = type_alias[t]
        if bottle_name != out["name"]:
            out["note"] = "fuel taken from 'Test Type'; the 'Fuel Bottle' cell is part of a spreadsheet fill series"
    elif bottle_name in ("Methane", "Ethylene"):
        out["name"] = bottle_name
    else:
        out["note"] = "the 'Fuel Bottle' cell is part of a spreadsheet fill series and 'Test Type' names no fuel; fuel left null"
    return out


def read_fuel(tm, rowd):
    """-> dict(name, raw, percent, fuel_diluent, form, size, direction, note)."""
    f = tm.get("fuel")
    if not f:
        return {"name": None, "raw": None}
    if f["method"] == "header":
        return {"name": f["name"], "raw": f["raw"]}
    cell = rowd.get(f["col"], "")
    raw = cell if cell.strip() else None
    if raw is None:
        return {"name": None, "raw": None}
    method = f["method"]
    if method == "alias":
        out = {"name": f["alias"].get(cell.strip())}
        form = f.get("form_alias", {}).get(cell.strip())
        if form:
            out["form"] = form
    elif method == "pct_species":
        out = fuel_pct_species(cell)
    elif method == "sflame":
        out = fuel_sflame(cell.strip())
    elif method == "bass_keywords":
        out = fuel_bass(cell)
    elif method == "cld":
        out = fuel_cld(cell, rowd.get(f["type_col"], ""), f["type_alias"])
    else:
        raise ValueError("unknown fuel method " + method)
    out["raw"] = raw
    return out


# ----------------------------------------------------------------------------
# Reading
# ----------------------------------------------------------------------------
def read_csv(path):
    data = open(path, "rb").read()
    try:
        text = data.decode("utf-8-sig")
        enc = "utf-8"
    except UnicodeDecodeError:
        text = data.decode("cp1252")
        enc = "windows-1252"
    return enc, list(csv.reader(io.StringIO(text, newline="")))


def row_test(rule, rowd, header):
    kind = rule[0]
    if kind == "blank":
        return all(not rowd[h].strip() for h in header)
    if kind == "equals":
        return rowd.get(rule[1], "").strip() == rule[2]
    if kind == "startswith":
        return rowd.get(rule[1], "").strip().startswith(rule[2])
    if kind == "contains":
        return rule[2] in rowd.get(rule[1], "")
    raise ValueError("unknown row rule " + kind)


def gravity_from_record(rec):
    pt = rec.get("project_type")
    if pt == "Microgravity Investigation":
        return "microgravity", "psi-investigations.json field project_type = 'Microgravity Investigation'"
    return None, ("psi-investigations.json field project_type = %r: the record does not state a gravity level" % pt)


def platform_from_record(rec):
    p = rec.get("platform")
    if p in (None, "", "Not Applicable"):
        return None, "psi-investigations.json field platform = %r (no platform stated)" % p
    return p, "psi-investigations.json field platform (PSI flightProgram)"


def put_entry(test, to, entry):
    group, name = to.split(".", 1)
    test["conditions" if group == "condition" else "outcomes"][name] = entry


def build_table(tm, rec, report):
    path = os.path.join(TABLE_DIR, tm["file"])
    enc, records = read_csv(path)
    hrow = tm["header_row"]
    header = [h.strip() for h in records[hrow]]
    if len(set(header)) != len(header):
        raise SystemExit("duplicate column names in " + tm["file"])
    psi_id = tm["psi_id"]
    investigation = rec.get("short_name") or rec.get("title")
    gravity, gravity_src = gravity_from_record(rec)
    platform, platform_src = platform_from_record(rec)

    # every column the mapping names has to exist in the file (drift check)
    used = {}  # column -> list of targets

    def use(col, target):
        if col not in header:
            raise SystemExit("%s: mapped column %r is not in the file header %r" % (tm["file"], col, header))
        used.setdefault(col, []).append(target)

    for c in tm["columns"]:
        use(c["col"], c["to"])
        for extra in c.get("also", ()):
            use(c["col"], extra)
        if c.get("needs") and c["needs"] not in header:
            raise SystemExit("%s: column %r needs %r, which is not in the file header" % (tm["file"], c["col"], c["needs"]))
    label_cols = tm.get("label") if isinstance(tm.get("label"), list) else []
    for c in label_cols:
        use(c, "test_label")
    if tm.get("date"):
        for c in tm["date"][1:]:
            use(c, "date" if tm["date"][0] != "raw" else "date_raw")
    f = tm.get("fuel")
    if f and f.get("col"):
        use(f["col"], "fuel")
        if f["method"] == "bass_keywords":
            use(f["col"], "fuel_form")
            use(f["col"], "fuel_size")
            use(f["col"], "flow_direction (only the word 'opposed')")
        if f.get("form_alias"):
            use(f["col"], "fuel_form")
        if f.get("type_col"):
            use(f["type_col"], "fuel")
    if isinstance(tm.get("fuel_size"), list):
        for c, _ in tm["fuel_size"]:
            use(c, "fuel_size")
    if tm.get("fuel_form_keywords"):
        use(tm["fuel_form_keywords"][0], "fuel_form")

    stats = {c["col"] + " -> " + c["to"]: {"converted": 0, "approx": 0, "multi": 0, "raw": 0, "out_of_gate": 0, "empty": 0, "text": 0}
             for c in tm["columns"]}
    fuel_stats = {"named": 0, "raw_only": 0, "empty": 0}
    has_comp = any(t.startswith("composition.") for ts in used.values() for t in ts)
    tests = []
    skipped = {}
    table_notes = []
    seen_rows = {}
    rows_read = 0
    fold = tm.get("fold")
    id_prefix = psi_id + (":" + tm["key"] if tm.get("key") else "")

    for i in range(hrow + 1, len(records)):
        cells = records[i]
        rows_read += 1
        cells = cells + [""] * (len(header) - len(cells))
        rowd = dict(zip(header, cells))

        # table notes live in a Notes column or in note rows
        for c in tm["columns"]:
            if c["to"] == "table_notes" and rowd[c["col"]].strip():
                table_notes.append({"row": i, "text": rowd[c["col"]].strip()})
        if tm.get("note_rows") and row_test(tm["note_rows"], rowd, header):
            table_notes.append({"row": i, "text": " ".join(x.strip() for x in cells if x.strip())})

        reason = None
        for why, rule in tm.get("skip", []):
            if row_test(rule, rowd, header):
                reason = why
                break
        if reason is None and row_test(("blank",), rowd, header):
            reason = "blank row"
        if reason is None and fold:
            ignore = set(fold["only_filled"]) | set(fold.get("ignore", []))
            filled_other = any(rowd[h].strip() for h in header if h not in ignore)
            if not filled_other and any(rowd[h].strip() for h in fold["only_filled"]) and tests:
                parent = tests[-1]
                spec = [c for c in tm["columns"] if c["to"] == fold["into"]][0]
                p = parse_number_cell(rowd[spec["col"]], spec)
                group, name = fold["into"].split(".", 1)
                entry = parent["conditions" if group == "condition" else "outcomes"].get(name)
                if p["kind"] == "number" and entry is not None:
                    values = entry.get("values") or ([entry["value"]] if entry["value"] is not None else [])
                    values.append(convert(spec, p["values"][0]))
                    entry["value"] = None
                    entry["kind"] = "list"
                    entry["values"] = values
                    entry["raw"] = entry["raw"] + " | " + rowd[spec["col"]].strip()
                parent.setdefault("continuation_rows", []).append({"row": i, "raw": rowd})
                reason = "continuation row (only %s filled): folded into the test day above" % ", ".join(fold["only_filled"])
        if reason:
            skipped[reason] = skipped.get(reason, 0) + 1
            continue

        row_kind = tm["row_kind"]
        for rule, kind in tm.get("row_kind_when", []):
            if row_test(rule, rowd, header):
                row_kind = kind

        date_iso, date_raw = parse_date(tm.get("date"), rowd)
        if tm.get("label") == "@date":
            label = date_iso or date_raw
        else:
            label = " ".join(rowd[c].strip() for c in label_cols if rowd[c].strip()) or None
        fu = read_fuel(tm, rowd)
        if tm.get("fuel"):
            if fu.get("name"):
                fuel_stats["named"] += 1
            elif fu.get("raw"):
                fuel_stats["raw_only"] += 1
            else:
                fuel_stats["empty"] += 1

        # fuel phase / form / size
        phase = tm["fuel_phase"][0] if tm.get("fuel_phase") else None
        form = None
        if tm.get("fuel_form"):
            form = tm["fuel_form"][0]
            if form.startswith("from "):
                form = fu.get("form")
        if tm.get("fuel_form_keywords"):
            col, pairs = tm["fuel_form_keywords"]
            form = None
            for key, val in pairs:
                if key in rowd[col]:
                    form = val
        size = None
        if tm.get("fuel_size") == "bass_regex":
            size = fu.get("size")
        elif tm.get("fuel_size"):
            parts = []
            for col, template in tm["fuel_size"]:
                v = rowd[col].strip()
                if v and v not in ("-", "–", "n/a", "none"):
                    parts.append(template.format(v))
            size = "; ".join(parts) or None

        test = {
            "id": "%s:%d" % (id_prefix, i),
            "psi_id": psi_id,
            "investigation": investigation,
            "table_file": tm["file"],
            "row": i,
            "row_kind": row_kind,
            "test_label": label,
            "date": date_iso,
            "date_raw": date_raw,
            "fuel": fu.get("name"),
            "fuel_raw": fu.get("raw"),
            "fuel_phase": phase,
            "fuel_form": form,
            "fuel_size": size,
            "o2_percent": None, "o2_raw": None,
            "o2_basis": None,
            "pressure_kpa": None, "pressure_raw": None,
            "flow_cm_s": None, "flow_raw": None,
            "flow_direction": fu.get("direction"),
            "diluent": None,
            "composition": ({"o2": None, "n2": None, "co2": None, "he": None} if has_comp else None),
            "gravity": gravity,
            "platform": platform,
            "hardware": rec.get("hardware") or None,
            "approx": [],
            "multi": {},
            "conditions": {},
            "outcomes": {},
            "raw": rowd,
        }
        if fu.get("note"):
            test["fuel_note"] = fu["note"]
        if fu.get("percent") is not None:
            test["conditions"]["fuel_percent"] = {"value": fu["percent"], "unit": "%", "raw": fu["raw"]}
        if fu.get("fuel_diluent"):
            test["conditions"]["fuel_diluent"] = {"value": fu["fuel_diluent"], "unit": None, "raw": fu["raw"]}
        if tm.get("fill_hint") and tm.get("fuel") and not fu.get("raw") and tests:
            above = tests[-1]
            if above["fuel_raw"]:
                test["fuel_from_row_above"] = {"value": above["fuel"], "raw": above["fuel_raw"], "row": above["row"],
                                               "note": "this row's cell is empty; the cell above reads this. A hint, not asserted."}

        for c in tm["columns"]:
            cell = rowd[c["col"]]
            to = c["to"]
            st = stats[c["col"] + " -> " + to]
            if to == "table_notes":
                st["text" if cell.strip() else "empty"] += 1
                continue
            short = {"o2_percent": "o2_raw", "pressure_kpa": "pressure_raw", "flow_cm_s": "flow_raw"}.get(to)
            if short and cell.strip():
                test[short] = cell.strip()

            if c["kind"] == "text":
                v = cell.strip()
                if not v:
                    st["empty"] += 1
                    continue
                if v in c.get("placeholders", ()):
                    st["raw"] += 1
                    val = None
                else:
                    st["text"] += 1
                    val = c["alias"].get(v) if "alias" in c else (v.lower() if c.get("lower") else v)
                    if "alias" in c and val is None:
                        st["text"] -= 1
                        st["raw"] += 1
                if to in ("flow_direction", "diluent"):
                    test[to] = val
                else:
                    put_entry(test, to, {"value": val, "unit": None, "raw": v})
                continue

            if c["kind"] == "special":
                p = SPECIAL_PARSERS[c["parser"]](cell)
                if p.get("diluent_raw"):
                    test["diluent"] = p["diluent"]
                    if p["diluent"] is None:
                        test["diluent_note"] = ("the gas after 'with' reads '%s' (spreadsheet fill series); diluent left null"
                                                % p["diluent_raw"])
            else:
                p = parse_number_cell(cell, c)
                if c.get("needs") and p["kind"] != "empty" and parse_number_cell(rowd[c["needs"]], {})["kind"] != "number":
                    p = {"kind": "raw"}  # computed from a cell that holds no number

            if p["kind"] == "empty":
                st["empty"] += 1
                if "." in to and to.split(".")[0] in ("condition", "outcome"):
                    pass
                continue
            unit_out = c.get("out_unit") or ("%" if to == "o2_percent" else "kPa" if to == "pressure_kpa" else "cm/s" if to == "flow_cm_s" else c.get("unit"))
            value = None
            entry_extra = {}
            if p["kind"] == "raw":
                st["raw"] += 1
            else:
                conv_values = [convert(c, v) for v in p["values"]]
                if not all(in_gate(c, sv, tv) for sv, tv in zip(p["values"], conv_values)):
                    st["out_of_gate"] += 1
                    st["raw"] += 1
                    p = {"kind": "raw"}
                elif p["kind"] == "number":
                    st["converted"] += 1
                    value = conv_values[0]
                    if p["approx"] or c.get("approx"):
                        st["approx"] += 1
                        entry_extra["approx"] = True
                    if p.get("note"):
                        entry_extra["note"] = p["note"]
                else:
                    st["multi"] += 1
                    entry_extra = {"kind": p["kind"], "values": conv_values}
                    if p["approx"] or c.get("approx"):
                        entry_extra["approx"] = True
                    if p.get("note"):
                        entry_extra["note"] = p["note"]

            if to in ("o2_percent", "pressure_kpa", "flow_cm_s"):
                test[to] = value
                if entry_extra.get("approx"):
                    test["approx"].append(to)
                if "values" in entry_extra:
                    test["multi"][to] = {"kind": entry_extra["kind"], "values": entry_extra["values"]}
            elif to.startswith("composition."):
                test["composition"][to.split(".", 1)[1]] = value
            else:
                entry = {"value": value, "unit": unit_out, "raw": cell.strip()}
                entry.update(entry_extra)
                if c.get("gravity"):
                    entry["gravity"] = c["gravity"]
                put_entry(test, to, entry)
                if entry_extra.get("approx"):
                    test["approx"].append(to)
            for extra in c.get("also", ()):
                if extra.startswith("composition.") and p["kind"] == "number":
                    test["composition"][extra.split(".", 1)[1]] = clean_num(p["values"][0])

        if tm.get("o2_basis") and test["o2_raw"] is not None:
            test["o2_basis"] = tm["o2_basis"][0]
        if tm.get("diluent") == "from_composition" and test["composition"]:
            comp = test["composition"]
            gases = [name for key, name in (("n2", "N2"), ("co2", "CO2"), ("he", "He")) if comp.get(key)]
            test["diluent"] = " + ".join(gases) or None

        key = tuple(cells)
        if key in seen_rows:
            test["duplicate_of"] = seen_rows[key]
        else:
            seen_rows[key] = test["id"]
        tests.append(test)

    # ---- table entry for the output
    by_col = {}
    for c in tm["columns"]:
        by_col.setdefault(c["col"], []).append(c)
    columns_out = []
    for h in header:
        entry = {"name": h, "mapped_to": None, "unit_in_source": None, "conversion": None}
        if h in used:
            entry["mapped_to"] = ", ".join(dict.fromkeys(used[h]))
        for c in by_col.get(h, []):
            if c["kind"] == "num":
                entry["unit_in_source"] = c["unit"]
                entry["conversion"] = CONVERSIONS[c["conv"]][1] if c.get("conv") else "none"
                if c["to"].startswith("outcome."):
                    entry["outcome"] = c["to"].split(".", 1)[1]
                    entry["unit"] = c.get("out_unit")
                    if c.get("gravity"):
                        entry["gravity"] = c["gravity"]
            elif c["kind"] == "special":
                entry["unit_in_source"] = "percent, written in the cell"
                entry["conversion"] = "none (parser: %s)" % c["parser"]
            elif c["to"].startswith("outcome."):
                entry["outcome"] = c["to"].split(".", 1)[1]
                entry["unit"] = None
            entry["cells"] = {k: v for k, v in stats[c["col"] + " -> " + c["to"]].items() if v}
        columns_out.append(entry)

    n_dup = sum(1 for t in tests if "duplicate_of" in t)
    table_out = {
        "psi_id": psi_id,
        "investigation": investigation,
        "table_file": tm["file"],
        "table_key": tm.get("key"),
        "encoding": enc,
        "header_row": hrow,
        "row_kind": tm["row_kind"],
        "rows": len(tests),
        "rows_read": rows_read,
        "rows_skipped": [{"reason": k, "rows": v} for k, v in skipped.items()],
        "rows_identical_to_an_earlier_row": n_dup,
        "gravity": gravity, "gravity_source": gravity_src,
        "platform": platform, "platform_source": platform_src,
        "fuel_rule": (tm["fuel"]["method"] if tm.get("fuel") else None),
        "fuel_phase_source": (tm["fuel_phase"][1] if tm.get("fuel_phase") else "not stated by the table or the PSI record"),
        "fuel_form_source": (tm["fuel_form"][1] if tm.get("fuel_form") else "not stated by the table or the PSI record"),
        "o2_basis": (tm["o2_basis"][0] if tm.get("o2_basis") else None),
        "o2_basis_source": (tm["o2_basis"][1] if tm.get("o2_basis") else None),
        "columns": columns_out,
        "notes": table_notes,
        "decisions": tm["decisions"],
    }

    # ---- report block
    report.append("")
    report.append("TABLE %s  (%s, %s)" % (tm["file"], psi_id, investigation))
    report.append("  encoding %s, header at record %d, one row = %s" % (enc, hrow, tm["row_kind"]))
    report.append("  rows read: %d   rows kept: %d   rows skipped: %d" % (rows_read, len(tests), rows_read - len(tests)))
    for k, v in skipped.items():
        report.append("    skipped %4d  %s" % (v, k))
    if n_dup:
        report.append("    kept rows identical to an earlier row (duplicate_of): %d" % n_dup)
    if tm.get("fuel") and tm["fuel"].get("col"):
        report.append("  fuel from %r (%s): named %d, left null with raw text %d, empty cell %d"
                      % (tm["fuel"]["col"], tm["fuel"]["method"], fuel_stats["named"], fuel_stats["raw_only"], fuel_stats["empty"]))
    elif tm.get("fuel"):
        report.append("  fuel from the column header: %s in every row" % tm["fuel"]["name"])
    else:
        report.append("  fuel: the table has no fuel column, fuel is null")
    report.append("  gravity: %r  platform: %r" % (gravity, platform))
    report.append("  mapped columns (cells of kept rows):")
    for c in tm["columns"]:
        st = stats[c["col"] + " -> " + c["to"]]
        if c["kind"] == "text":
            report.append("    %-46r -> %-38s text %d, left raw %d, empty %d"
                          % (c["col"], c["to"], st["text"], st["raw"], st["empty"]))
        else:
            conv = CONVERSIONS[c["conv"]][1] if c.get("conv") else "no conversion"
            line = ("    %-46r -> %-38s [%s, %s] converted %d (of them approx %d), list/range %d, stayed raw %d, empty %d"
                    % (c["col"], c["to"], c.get("unit", "percent in the cell"), conv, st["converted"], st["approx"], st["multi"], st["raw"], st["empty"]))
            if st["out_of_gate"]:
                line += "  (of the raw ones, %d failed the sanity gate)" % st["out_of_gate"]
            report.append(line)
    unmapped = [h for h in header if h not in used]
    if unmapped:
        report.append("  columns left uninterpreted (in raw only): " + "; ".join(repr(h) for h in unmapped))
    return table_out, tests


# ----------------------------------------------------------------------------
# Summaries
# ----------------------------------------------------------------------------
# Conditions that only identify a row (run ids, sample numbers, links): not listed as "varied".
IDENT_CONDITIONS = {"flex_identifier", "cir_run_id", "sample_number", "as_run_test_number", "gmt_flame_off",
                    "description", "data_description", "reference_publication_link", "figure_id_in_reference",
                    "hardware_description", "sampled_location"}
CORE_FIELDS = ["row_kind", "fuel", "fuel_phase", "fuel_form", "fuel_size", "o2_percent", "o2_basis", "pressure_kpa",
               "flow_cm_s", "flow_direction", "diluent", "gravity", "platform"]
COMP_FIELDS = ["composition.o2", "composition.n2", "composition.co2", "composition.he"]


def field_value(test, field):
    if field.startswith("composition."):
        return (test["composition"] or {}).get(field.split(".", 1)[1])
    if field.startswith("condition."):
        e = test["conditions"].get(field.split(".", 1)[1])
        return e["value"] if e else None
    if field.startswith("outcome."):
        e = test["outcomes"].get(field.split(".", 1)[1])
        return e["value"] if e else None
    return test.get(field)


def field_multi(test, field):
    if field in test["multi"]:
        return test["multi"][field]["values"]
    if field.startswith("condition.") or field.startswith("outcome."):
        group, name = field.split(".", 1)
        e = test["conditions" if group == "condition" else "outcomes"].get(name)
        if e and e.get("values"):
            return e["values"]
    return None


def summarize(psi_id, investigation, tests, table_files):
    n = len(tests)
    cond_names, out_names = [], []
    for t in tests:
        for k in t["conditions"]:
            if k not in cond_names:
                cond_names.append(k)
        for k in t["outcomes"]:
            if k not in out_names:
                out_names.append(k)
    fields = CORE_FIELDS + COMP_FIELDS + ["condition." + k for k in cond_names if k not in IDENT_CONDITIONS]
    varied, constant, multi_valued, not_in_table = [], [], [], []

    def describe(field):
        vals = [field_value(t, field) for t in tests]
        present = [v for v in vals if v is not None]
        multis = [m for m in (field_multi(t, field) for t in tests) if m]
        if multis:
            flat = sorted(set(v for m in multis for v in m))
            multi_valued.append({"field": field, "cells": len(multis), "min": flat[0], "max": flat[-1],
                                 "distinct_values": flat if len(flat) <= 20 else None, "distinct": len(flat)})
        if not present:
            return None
        distinct = list(dict.fromkeys(present))
        numeric = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in present)
        if len(distinct) == 1:
            return ("constant", {"field": field, "value": distinct[0], "n": len(present), "n_missing": n - len(present)})
        d = {"field": field, "distinct": len(distinct), "n": len(present), "n_missing": n - len(present)}
        if numeric:
            d["min"], d["max"] = min(present), max(present)
        else:
            d["min"], d["max"] = None, None
            counts = {}
            for v in present:
                counts[v] = counts.get(v, 0) + 1
            top = sorted(counts.items(), key=lambda kv: (-kv[1], str(kv[0])))
            d["values"] = [{"value": k, "n": c} for k, c in top[:15]]
        return ("varied", d)

    for f in fields:
        r = describe(f)
        if r is None:
            if f in CORE_FIELDS or f in COMP_FIELDS:
                if not any(m["field"] == f for m in multi_valued):
                    not_in_table.append(f)
            continue
        (varied if r[0] == "varied" else constant).append(r[1])

    outcomes = []
    for name in out_names:
        f = "outcome." + name
        entries = [t["outcomes"][name] for t in tests if name in t["outcomes"]]
        vals = [e["value"] for e in entries if e["value"] is not None]
        o = {"name": name, "unit": entries[0]["unit"], "cells": len(entries), "n": len(vals)}
        if entries[0].get("gravity"):
            o["gravity"] = entries[0]["gravity"]
        nums = [v for v in vals if isinstance(v, (int, float)) and not isinstance(v, bool)]
        if nums and len(nums) == len(vals):
            o["min"], o["max"] = min(nums), max(nums)
        elif vals:
            counts = {}
            for v in vals:
                counts[v] = counts.get(v, 0) + 1
            top = sorted(counts.items(), key=lambda kv: (-kv[1], str(kv[0])))
            o["distinct"] = len(counts)
            o["values"] = [{"value": k, "n": c} for k, c in top[:10]]
        describe(f)  # collects list/range cells of outcomes into multi_valued
        outcomes.append(o)

    kinds = {}
    for t in tests:
        kinds[t["row_kind"]] = kinds.get(t["row_kind"], 0) + 1
    # oxygen range per basis: an inverse flame's burner-stream O2 is not a cabin atmosphere,
    # so the two must not be read as one range (PSI-10 and PSI-159 hold both)
    per_basis = {}
    for t in tests:
        if t["o2_percent"] is not None:
            per_basis.setdefault(t["o2_basis"], []).append(t["o2_percent"])
    o2_by_basis = [{"basis": b, "n": len(v), "min": min(v), "max": max(v), "distinct": len(set(v))}
                   for b, v in per_basis.items()]
    return {
        "psi_id": psi_id, "investigation": investigation, "n_tests": n,
        "tables": table_files, "row_kinds": kinds,
        "n_identical_rows": sum(1 for t in tests if "duplicate_of" in t),
        "varied": varied, "constant": constant, "multi_valued": multi_valued,
        "o2_percent_by_basis": o2_by_basis,
        "not_in_table": not_in_table, "outcomes": outcomes,
    }


# ----------------------------------------------------------------------------
# Writing
# ----------------------------------------------------------------------------
def dump_json(doc, path):
    """Readable but small: one test per line."""
    parts = ["{"]
    keys = list(doc.keys())
    for k in keys:
        last = "" if k == keys[-1] else ","
        if k == "tests":
            parts.append(' "tests": [')
            for j, t in enumerate(doc["tests"]):
                parts.append("  " + json.dumps(t, ensure_ascii=False, separators=(",", ":")) + ("," if j < len(doc["tests"]) - 1 else ""))
            parts.append(" ]" + last)
        else:
            body = json.dumps(doc[k], ensure_ascii=False, indent=1)
            body = "\n".join(" " + line for line in body.split("\n"))
            parts.append(' %s: %s%s' % (json.dumps(k), body.lstrip(), last))
    parts.append("}")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(parts) + "\n")


def flat(v):
    """CSV cell: no line breaks, None -> empty."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    return re.sub(r'[\r\n]+', ' ', str(v))


def write_csv(tests, path):
    cond, outc = [], []
    for t in tests:
        for k in t["conditions"]:
            if k not in cond:
                cond.append(k)
        for k in t["outcomes"]:
            if k not in outc:
                outc.append(k)
    head = ["id", "psi_id", "investigation", "table_file", "row", "row_kind", "test_label", "date", "date_raw",
            "fuel", "fuel_raw", "fuel_phase", "fuel_form", "fuel_size",
            "o2_percent", "o2_raw", "o2_basis", "pressure_kpa", "pressure_raw", "flow_cm_s", "flow_raw", "flow_direction",
            "diluent", "comp_o2", "comp_n2", "comp_co2", "comp_he", "gravity", "platform", "hardware",
            "approx", "multi", "duplicate_of"]
    head += ["cond." + k for k in cond] + ["out." + k for k in outc] + ["raw"]
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(head)
        for t in tests:
            comp = t["composition"] or {}
            row = [t["id"], t["psi_id"], t["investigation"], t["table_file"], t["row"], t["row_kind"], t["test_label"],
                   t["date"], t["date_raw"], t["fuel"], t["fuel_raw"], t["fuel_phase"], t["fuel_form"], t["fuel_size"],
                   t["o2_percent"], t["o2_raw"], t["o2_basis"], t["pressure_kpa"], t["pressure_raw"], t["flow_cm_s"],
                   t["flow_raw"], t["flow_direction"], t["diluent"], comp.get("o2"), comp.get("n2"), comp.get("co2"),
                   comp.get("he"), t["gravity"], t["platform"], t["hardware"],
                   "; ".join(t["approx"]) or None, t["multi"] or None, t.get("duplicate_of")]
            for k in cond:
                e = t["conditions"].get(k)
                row.append(None if e is None else (e["value"] if e["value"] is not None else (e.get("values") if e.get("values") else None)))
            for k in outc:
                e = t["outcomes"].get(k)
                row.append(None if e is None else (e["value"] if e["value"] is not None else (e.get("values") if e.get("values") else None)))
            row.append(t["raw"])
            w.writerow([flat(v) for v in row])
    return len(head)


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    records = json.load(open(RECORDS_FILE, encoding="utf-8"))
    by_id = {r["psi_id"]: r for r in records}
    report = []
    report.append("VESTA unified test table - build report")
    report.append("source tables: research/raw/psi/tables/   PSI records: research/psi-investigations.json")
    report.append("script: pipeline/build_tests.py   Python %d.%d" % sys.version_info[:2])
    report.append("gravity: PSI record field project_type ('Microgravity Investigation' -> microgravity, anything else -> null)")
    report.append("platform: PSI record field platform (PSI flightProgram); hardware: PSI record field hardware")
    report.append("cell counts: converted = clean number (approx = written with '~' or under an 'approx' header); "
                  "list/range = several values in one cell (single value null, values kept); stayed raw = text kept, value null")

    # every CSV on disk is either mapped or excluded (drift check)
    on_disk = sorted(f for f in os.listdir(TABLE_DIR) if f.lower().endswith(".csv"))
    mapped = [t["file"] for t in TABLES]
    excluded_out = []
    for psi_id, why in EXCLUDED.items():
        rec = by_id.get(psi_id, {})
        files = [f for f in on_disk if f.startswith(psi_id + "_")]
        excluded_out.append({"psi_id": psi_id, "investigation": rec.get("short_name") or rec.get("title"),
                             "research_area": rec.get("research_area"), "reason": why, "tables_not_read": files})
    excluded_files = [f for e in excluded_out for f in e["tables_not_read"]]
    unknown = [f for f in on_disk if f not in mapped and f not in excluded_files]
    missing = [f for f in mapped if f not in on_disk]
    if unknown or missing:
        raise SystemExit("table list and mapping disagree. Not mapped: %r. Mapped but missing: %r" % (unknown, missing))

    tables_out, tests = [], []
    for tm in TABLES:
        rec = by_id[tm["psi_id"]]
        table_out, table_tests = build_table(tm, rec, report)
        tables_out.append(table_out)
        tests.extend(table_tests)

    summaries = []
    for psi_id in dict.fromkeys(t["psi_id"] for t in TABLES):
        own = [t for t in tests if t["psi_id"] == psi_id]
        files = [t["file"] for t in TABLES if t["psi_id"] == psi_id]
        summaries.append(summarize(psi_id, own[0]["investigation"] if own else None, own, files))

    no_table = [{"psi_id": r["psi_id"], "title": r.get("title"), "project_type": r.get("project_type")}
                for r in records if not r.get("tables") and r["psi_id"] not in EXCLUDED]

    doc = {
        "meta": {
            "what": "One normalized row per row of the PSI 'Experimental table' CSVs (NASA Physical Sciences Informatics).",
            "built_by": "pipeline/build_tests.py",
            "sources": {"tables": "research/raw/psi/tables/*.csv", "records": "research/psi-investigations.json"},
            "n_tables": len(tables_out), "n_tests": len(tests),
            "row_numbering": "row = record number in the CSV with the header as record 0 (first data row = 1; spreadsheet line = row + 1)",
            "id": "<psi_id>:<row>, or <psi_id>:<table key>:<row> when the investigation has two tables",
            "citation": "a table row cites as PSI id + table_file + row",
            "row_kind": {
                "test": "one row is one test (or one burn sample)",
                "test_day": "one row is one day of testing with several flames (ACME BRE, CLD Flame, E-FIELD Flames, s-Flame, SLICE)",
                "test_series": "one row is one fuel with the ranges tested for it (FLEX-2)",
                "test_group_reference": "a row that names a material and points to the conditions of other rows (SAME rows 5-8)",
                "session": "one measurement session, nothing burns (DAFT)",
                "dataset_index": "one data set of a ground investigation, not a test (PSI-142)",
            },
            "fields": {
                "o2_percent": "percent O2; null unless a cell gives one clean number. o2_basis says what it describes: "
                              "'ambient' (the atmosphere around the fuel) or 'burner_stream' (inverse flames: O2 fed through the burner into a fuel atmosphere). "
                              "summaries[].o2_percent_by_basis gives the range per basis; only 'ambient' compares with a cabin atmosphere",
                "pressure_kpa": "kPa, converted from the unit the table uses",
                "flow_cm_s": "cm/s as the table gives it",
                "composition": "ambient mole fractions as written, only for tables that list them (FLEX, CFI)",
                "multi": "core fields whose cell holds a list or a range: {field: {kind: list|range, values: [...]}}, values already converted",
                "approx": "fields whose cell (or header) marks the number as approximate ('~', 'approx')",
                "conditions": "other mapped test conditions: {name: {value, unit, raw}}; 'values' + 'kind' when the cell is a list or range",
                "outcomes": "mapped results: {name: {value, unit, raw}}; an outcome measured at another gravity carries 'gravity'",
                "fuel": "tidy name; null when the cell does not name the material. fuel_raw is the cell as written",
                "fuel_phase / fuel_form": "only when the table or the PSI record states it; tables[].fuel_phase_source / fuel_form_source say where",
                "gravity": "from the PSI record field project_type; tables[].gravity_source",
                "platform": "from the PSI record field platform; hardware is the record's hardware field",
                "duplicate_of": "id of an earlier row of the same table with identical cells",
                "raw": "every cell of the row, as written, keyed by column name",
            },
            "conversions_allowed": {k: v[1] for k, v in CONVERSIONS.items()},
            "sanity_gates": "o2_percent within 0..100; mole fraction within 0..1; pressure_kpa above 0; a cell outside gives null and stays raw",
        },
        "tables": tables_out,
        "tests": tests,
        "summaries": summaries,
        "excluded": excluded_out,
        "records_without_table": no_table,
    }

    # ---- self checks before writing
    ids = [t["id"] for t in tests]
    assert len(ids) == len(set(ids)), "test ids are not unique"
    for t in tests:
        for k in ("id", "psi_id", "table_file", "row", "raw"):
            assert t.get(k) not in (None, "", {}), "test %s lacks %s" % (t.get("id"), k)
    for tb in tables_out:
        n = sum(1 for t in tests if t["table_file"] == tb["table_file"])
        assert n == tb["rows"], "row count mismatch in " + tb["table_file"]
        assert tb["rows_read"] == tb["rows"] + sum(s["rows"] for s in tb["rows_skipped"]), "read != kept + skipped in " + tb["table_file"]

    os.makedirs(OUT_DIR, exist_ok=True)
    dump_json(doc, OUT_JSON)
    n_cols = write_csv(tests, OUT_CSV)

    # ---- read both files back
    back = json.load(open(OUT_JSON, encoding="utf-8"))
    assert len(back["tests"]) == len(tests)
    with open(OUT_CSV, encoding="utf-8", newline="") as fh:
        csv_rows = list(csv.reader(fh))
    assert len(csv_rows) - 1 == len(tests), "tests.csv rows != tests.json tests"
    with open(OUT_CSV, encoding="utf-8") as fh:
        physical_lines = sum(1 for _ in fh)
    assert physical_lines - 1 == len(tests), "tests.csv has line breaks inside cells"

    # ---- report tail
    report.append("")
    report.append("EXCLUDED (not read)")
    for e in excluded_out:
        report.append("  %s %s: %s  Tables: %s" % (e["psi_id"], e["investigation"], e["reason"], "; ".join(e["tables_not_read"])))
    report.append("")
    report.append("PSI RECORDS WITHOUT AN EXPERIMENTAL TABLE: " + ", ".join(r["psi_id"] for r in no_table))
    report.append("")
    report.append("PER INVESTIGATION")
    for s in summaries:
        kinds = ", ".join("%d %s" % (v, k) for k, v in s["row_kinds"].items())
        report.append("  %-8s %-22s rows kept %4d  (%s)" % (s["psi_id"], s["investigation"][:22], s["n_tests"], kinds))
        for v in s["varied"]:
            if v["field"] in ("o2_percent", "pressure_kpa", "flow_cm_s"):
                report.append("           varied   %-13s %s .. %s  (%d distinct, %d of %d rows)"
                              % (v["field"], v["min"], v["max"], v["distinct"], v["n"], s["n_tests"]))
                if v["field"] == "o2_percent" and len(s["o2_percent_by_basis"]) > 1:
                    for b in s["o2_percent_by_basis"]:
                        report.append("                    of them %-13s %s .. %s  (%d rows)" % (b["basis"], b["min"], b["max"], b["n"]))
        for v in s["constant"]:
            if v["field"] in ("o2_percent", "pressure_kpa", "flow_cm_s"):
                report.append("           constant %-13s %s  (%d of %d rows)" % (v["field"], v["value"], v["n"], s["n_tests"]))
        for v in s["multi_valued"]:
            if v["field"] in ("o2_percent", "pressure_kpa", "flow_cm_s"):
                report.append("           lists / ranges in %-13s %s .. %s  (%d cells)" % (v["field"], v["min"], v["max"], v["cells"]))
    report.append("")
    n_o2 = sum(1 for t in tests if t["o2_percent"] is not None)
    n_p = sum(1 for t in tests if t["pressure_kpa"] is not None)
    n_fl = sum(1 for t in tests if t["flow_cm_s"] is not None)
    n_fuel = sum(1 for t in tests if t["fuel"] is not None)
    report.append("TOTALS")
    report.append("  tables read: %d   rows read: %d   rows kept (tests in tests.json): %d"
                  % (len(tables_out), sum(tb["rows_read"] for tb in tables_out), len(tests)))
    report.append("  with a fuel name: %d   with o2_percent: %d   with pressure_kpa: %d   with flow_cm_s: %d"
                  % (n_fuel, n_o2, n_p, n_fl))
    report.append("  o2_percent by basis: ambient %d, burner_stream %d"
                  % (sum(1 for t in tests if t["o2_percent"] is not None and t["o2_basis"] == "ambient"),
                     sum(1 for t in tests if t["o2_percent"] is not None and t["o2_basis"] == "burner_stream")))
    report.append("  gravity: " + ", ".join("%s %d" % (g, sum(1 for t in tests if t["gravity"] == g))
                                            for g in dict.fromkeys(t["gravity"] for t in tests)))
    report.append("  rows identical to an earlier row (kept, flagged): %d" % sum(1 for t in tests if "duplicate_of" in t))
    report.append("  tests.json: %d tests, %d bytes   tests.csv: %d data rows, %d columns"
                  % (len(tests), os.path.getsize(OUT_JSON), len(csv_rows) - 1, n_cols))
    report.append("  checks passed: ids unique; id, psi_id, table_file, row, raw present in every test; "
                  "tests per table = rows kept; rows read = kept + skipped; tests.csv rows = tests.json tests")

    text = "\n".join(report) + "\n"
    with open(OUT_REPORT, "w", encoding="utf-8") as fh:
        fh.write(text)
    sys.stdout.write(text)


if __name__ == "__main__":
    main()
