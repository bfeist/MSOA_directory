import pandas as pd
import json
import os

# Use script directory to locate the Excel file
script_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(script_dir, "Official-Database-3-26-2025.xlsx")

print(f"Reading Excel file: {file_path}")
# Read the sheet with default header (first row becomes df.columns)
df = pd.read_excel(file_path, sheet_name="Sheet1", engine="openpyxl")

# Extract header rows
launch_row = df.iloc[0]
source_row = df.iloc[1]
site_row = df.iloc[2]
shift_row = df.iloc[3]

# Data starts at row index 5
data = df.iloc[5:].reset_index(drop=True)
print(f"Processing {len(data)} person records...")

# Prepare PERSON table
persons = []
person_id_lookup = {}
pid = 1
for _, row in data.iterrows():
    last = row[df.columns[0]]
    first = row[df.columns[1]]
    if pd.isna(last) and pd.isna(first):
        continue
    person = {
        "person_id": pid, 
        "last_name": None if pd.isna(last) else last, 
        "first_name": None if pd.isna(first) else first
    }
    persons.append(person)
    person_id_lookup[(last, first)] = pid
    pid += 1
print(f"Created {len(persons)} person records")

# Identify mission start columns (where launch date is present)
mission_cols = [col for col in df.columns[2:] if not pd.isna(launch_row[col])]
col_positions = {col: i for i, col in enumerate(df.columns)}

# Prepare MISSION table
print(f"Processing {len(mission_cols)} missions...")
missions = []
mission_id_lookup = {}
mid = 1
start_positions = sorted(col_positions[col] for col in mission_cols)
for i, col in enumerate(mission_cols):
    start_idx = col_positions[col]
    end_idx = (
        start_positions[i + 1] if i + 1 < len(start_positions) else len(df.columns)
    )
    mission_name_code = col
    if "," in mission_name_code:
        name, code = [s.strip() for s in mission_name_code.split(",", 1)]
    else:
        name, code = mission_name_code, None
    launch_date = None if pd.isna(launch_row[col]) else str(launch_row[col]).replace("Launch ", "").strip()
    source_note = None if pd.isna(source_row[col]) else str(source_row[col]).strip()
    site_assignment = None if pd.isna(site_row[col]) else str(site_row[col]).strip()

    missions.append(
        {
            "mission_id": mid,
            "mission_name": name,
            "mission_code": code,
            "launch_date": launch_date,
            "source_note": source_note,
            "site_assignment": site_assignment,
        }
    )
    mission_id_lookup[col] = mid
    mid += 1

# Prepare SHIFT table
print("Processing shifts...")
shifts = []
shift_id_lookup = {}
sid = 1
for col in mission_cols:
    start_idx = col_positions[col]
    end_idx = (
        start_positions[mission_cols.index(col) + 1]
        if mission_cols.index(col) + 1 < len(start_positions)
        else len(df.columns)
    )
    for cidx in range(start_idx, end_idx):
        shift_name = shift_row[df.columns[cidx]]
        if pd.isna(shift_name):
            continue
        shift_name = str(shift_name).strip()
        if shift_name not in shift_id_lookup:
            shift_id_lookup[shift_name] = sid
            shifts.append({"shift_id": sid, "shift_name": shift_name})
            sid += 1

# Prepare PERSON_MISSION_SHIFT table
print("Processing person mission shift assignments (optimized)...")

# Pre-compute column to shift/mission mapping
col_to_shift_mission = {}
for col in mission_cols:
    start_idx = col_positions[col]
    end_idx = (
        start_positions[mission_cols.index(col) + 1]
        if mission_cols.index(col) + 1 < len(start_positions)
        else len(df.columns)
    )
    mid = mission_id_lookup[col]
    for cidx in range(start_idx, end_idx):
        shift_name = shift_row[df.columns[cidx]]
        if pd.isna(shift_name):
            continue
        shift_name = str(shift_name).strip()
        sid = shift_id_lookup[shift_name]
        col_to_shift_mission[df.columns[cidx]] = (sid, mid)

# Process assignments more efficiently
pms = []
pms_id = 1
total_persons = len(persons)
for idx, (_, row) in enumerate(data.iterrows()):
    if idx % 10 == 0:  # Show progress every 10 persons
        print(f"  Processing person {idx}/{total_persons}...", end="\r")

    last = row[df.columns[0]]
    first = row[df.columns[1]]
    if pd.isna(last) and pd.isna(first):
        continue

    pid = person_id_lookup[(last, first)]

    # Only process columns that have shift/mission mappings
    for col, (sid, mid) in col_to_shift_mission.items():
        assignment = row[col]
        if not pd.isna(assignment):
            pms.append(
                {
                    "pms_id": pms_id,
                    "person_id": pid,
                    "mission_id": mid,
                    "shift_id": sid,
                    "assignment_note": str(assignment).strip(),
                }
            )
            pms_id += 1

print(f"Completed processing {len(pms)} assignments for {total_persons} persons")

# Combine all into a single JSON object
output = {
    "person": persons,
    "mission": missions,
    "shift": shifts,
    "person_mission_shift": pms,
}

# Write output to JSON file in the src/data directory relative to the project root
project_root = os.path.dirname(script_dir) # Go up one level from scripts
output_dir = os.path.join(project_root, "src", "data")
output_file = os.path.join(output_dir, "mission_data.json")

# Ensure the output directory exists
os.makedirs(output_dir, exist_ok=True)

print(f"Writing output to {output_file}")
with open(output_file, "w", encoding="utf-8") as f:
    # Use json.dump with a custom function to replace NaN values with None (which becomes null in JSON)
    # Also handle 'nan' strings that might have been created
    def json_serializer(obj):
        if pd.isna(obj) or obj is pd.NA or (isinstance(obj, str) and obj.lower() == "nan"):
            return None
        return obj

    json.dump(output, f, indent=2, default=json_serializer)

print(f"Processing complete. JSON file created with:")
print(f" - {len(persons)} person records")
print(f" - {len(missions)} mission records")
print(f" - {len(shifts)} shift records")
print(f" - {len(pms)} person-mission-shift assignments")
