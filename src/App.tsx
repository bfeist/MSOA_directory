import { useState, useEffect, useMemo } from "react"; // Add useMemo
import missionData from "./data/mission_data.json";
import "./App.css";

// Define types based on our JSON structure
interface Person {
  person_id: number;
  last_name: string;
  first_name: string;
}

interface Mission {
  mission_id: number;
  mission_name: string;
  mission_code: string | null;
  launch_date: string | null;
  source_note: string | null;
  site_assignment: string | null;
}

interface Shift {
  shift_id: number;
  shift_name: string;
}

interface PersonMissionShift {
  pms_id: number;
  person_id: number;
  mission_id: number;
  shift_id: number;
  assignment_note: string;
}

interface MissionData {
  person: Person[];
  mission: Mission[];
  shift: Shift[];
  person_mission_shift: PersonMissionShift[];
}

// Type for grouped assignments under a person
interface PersonAssignmentGroup {
  person: Person;
  assignments: { shift: string; assignment_note: string }[];
}

// Type for grouped assignments under a mission
interface MissionAssignmentGroup {
  mission: Mission;
  assignments: { shift: string; assignment_note: string }[];
}

// Type for shift data used in filtering
interface ShiftInfo {
  id: number;
  name: string;
}

// Type for role details
interface RolePersonInfo {
  person: Person;
  missions: { mission_name: string; assignment_note: string }[]; // Include mission name
}

// Type assertion for our imported JSON
const data = missionData as unknown as MissionData;

// Helper functions moved outside the component
// Get people who worked on a specific mission
const getPeopleByMission = (
  missionId: number,
  data: MissionData
): PersonAssignmentGroup[] => {
  const assignments = data.person_mission_shift.filter(
    (pms) => pms.mission_id === missionId
  );

  // Group by person to avoid duplicates
  const personAssignments = assignments.reduce((acc, pms) => {
    if (!acc[pms.person_id]) {
      const person = data.person.find((p) => p.person_id === pms.person_id);
      if (person) {
        acc[pms.person_id] = {
          person,
          assignments: [],
        };
      }
    }

    if (acc[pms.person_id]) {
      const shift = data.shift.find((s) => s.shift_id === pms.shift_id);
      acc[pms.person_id].assignments.push({
        shift: shift?.shift_name || "Unknown",
        assignment_note: pms.assignment_note,
      });
    }

    return acc;
  }, {} as Record<number, PersonAssignmentGroup>);

  return Object.values(personAssignments);
};

// Get all missions a person worked on
const getMissionsByPerson = (
  personId: number,
  data: MissionData
): MissionAssignmentGroup[] => {
  const assignments = data.person_mission_shift.filter(
    (pms) => pms.person_id === personId
  );

  // Group by mission to avoid duplicates
  const missionAssignments = assignments.reduce((acc, pms) => {
    if (!acc[pms.mission_id]) {
      const mission = data.mission.find((m) => m.mission_id === pms.mission_id);
      if (mission) {
        acc[pms.mission_id] = {
          mission,
          assignments: [],
        };
      }
    }

    if (acc[pms.mission_id]) {
      const shift = data.shift.find((s) => s.shift_id === pms.shift_id);
      acc[pms.mission_id].assignments.push({
        shift: shift?.shift_name || "Unknown",
        assignment_note: pms.assignment_note,
      });
    }

    return acc;
  }, {} as Record<number, MissionAssignmentGroup>);

  return Object.values(missionAssignments).sort((a, b) => {
    if (!a.mission.launch_date) return 1;
    if (!b.mission.launch_date) return -1;
    return (
      new Date(a.mission.launch_date).getTime() -
      new Date(b.mission.launch_date).getTime()
    );
  });
};

// Get all people who held a specific role
const getPeopleByRole = (role: string, data: MissionData): RolePersonInfo[] => {
  // Find all assignments matching the role (case-insensitive)
  const roleAssignments = data.person_mission_shift.filter(
    (pms) =>
      pms.assignment_note.trim().toLowerCase() === role.trim().toLowerCase()
  );

  const peopleInRole = roleAssignments.reduce((acc, pms) => {
    const personId = pms.person_id;
    if (!acc[personId]) {
      const person = data.person.find((p) => p.person_id === personId);
      if (person) {
        acc[personId] = {
          person,
          missions: [], // Initialize missions array
        };
      }
    }

    // Add the mission *only if* the person exists in the accumulator
    if (acc[personId]) {
      const mission = data.mission.find((m) => m.mission_id === pms.mission_id);
      // Check if this mission is already added for this person to avoid duplicates
      // (A person might have the same role on multiple shifts for the same mission)
      if (
        mission &&
        !acc[personId].missions.some(
          (m) => m.mission_name === mission.mission_name
        )
      ) {
        acc[personId].missions.push({
          mission_name: mission.mission_name || "Unknown Mission",
          assignment_note: pms.assignment_note, // Keep original note casing if needed
        });
      }
    }

    return acc;
  }, {} as Record<number, RolePersonInfo>);

  // Sort people by last name, then first name
  return Object.values(peopleInRole).sort((a, b) => {
    const lastNameComparison = a.person.last_name.localeCompare(
      b.person.last_name
    );
    if (lastNameComparison !== 0) {
      return lastNameComparison;
    }
    return a.person.first_name.localeCompare(b.person.first_name);
  });
};

function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMission, setSelectedMission] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<
    "search" | "mission" | "person" | "role"
  >("search"); // Add 'role'
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null);
  const [selectedShifts, setSelectedShifts] = useState<number[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null); // Add selectedRole state

  // Get sorted missions by launch date
  const sortedMissions = [...data.mission].sort((a, b) => {
    if (!a.launch_date) return 1;
    if (!b.launch_date) return -1;
    return (
      new Date(a.launch_date).getTime() - new Date(b.launch_date).getTime()
    );
  });

  // Filter missions by search term
  const filteredMissions = sortedMissions.filter((mission) =>
    mission.mission_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter people by search term
  const filteredPeople = data.person.filter((person) => {
    const fullName = `${person.first_name} ${person.last_name}`.toLowerCase();
    return (
      fullName.includes(searchTerm.toLowerCase()) ||
      person.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (person.first_name &&
        person.first_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  // Get unique roles using useMemo
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    data.person_mission_shift.forEach((pms) => {
      if (pms.assignment_note) {
        // Basic normalization: trim whitespace and convert to title case for consistency
        const normalizedRole = pms.assignment_note
          .trim()
          .toLowerCase()
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        roles.add(normalizedRole);
      }
    });
    return Array.from(roles).sort();
  }, []); // Empty dependency array means this runs once

  // Effect to handle initializing selected shifts when mission view loads
  useEffect(() => {
    if (selectedMission !== null && viewMode === "mission") {
      // Pass data explicitly now
      const personAssignments = getPeopleByMission(selectedMission, data);
      const missionShifts = new Set<number>();
      personAssignments.forEach((pa) => {
        pa.assignments.forEach((assignment) => {
          // Find the corresponding shift ID from the main data source
          const shiftId = data.person_mission_shift.find(
            (pms) =>
              pms.person_id === pa.person.person_id &&
              pms.mission_id === selectedMission && // Use selectedMission directly
              pms.assignment_note === assignment.assignment_note
          )?.shift_id;
          if (shiftId) missionShifts.add(shiftId);
        });
      });

      const shiftsArray = Array.from(missionShifts)
        .map((id): ShiftInfo => {
          const shift = data.shift.find((s) => s.shift_id === id);
          return { id, name: shift?.shift_name || "Unknown" };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      // Set selected shifts to all available shifts for the new mission
      setSelectedShifts(shiftsArray.map((s) => s.id));
    } else if (viewMode !== "mission") {
      // Clear selected shifts when leaving mission view or no mission selected
      setSelectedShifts([]);
    }
    // Dependency array: run when selectedMission or viewMode changes
  }, [selectedMission, viewMode]);

  // Render selected person's details
  const renderPersonDetails = () => {
    if (!selectedPerson) return null;

    const person = data.person.find((p) => p.person_id === selectedPerson);
    if (!person) return <div>Person not found</div>;

    // Pass data explicitly
    const missionAssignments = getMissionsByPerson(person.person_id, data);

    return (
      <div className="person-details">
        <button
          className="back-button"
          onClick={() => {
            setViewMode("search");
            setSelectedPerson(null);
          }}
        >
          ← Back to Search
        </button>

        <h2>
          {person.first_name} {person.last_name}
        </h2>

        <h3>Mission History</h3>
        <div className="mission-list">
          {missionAssignments.map((ma) => (
            <div key={ma.mission.mission_id} className="mission-card">
              <h4>
                {ma.mission.mission_name}
                {ma.mission.launch_date && (
                  <span className="launch-date">
                    ({ma.mission.launch_date})
                  </span>
                )}
              </h4>

              <ul className="assignment-list">
                {ma.assignments.map((assignment, idx) => (
                  <li key={idx}>
                    <strong>{assignment.shift}:</strong>{" "}
                    {assignment.assignment_note}
                  </li>
                ))}
              </ul>

              <button
                className="small-button"
                onClick={() => {
                  setSelectedMission(ma.mission.mission_id);
                  setViewMode("mission");
                }}
              >
                View Mission Details
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render selected mission's details
  const renderMissionDetails = () => {
    if (!selectedMission) return null;

    const mission = data.mission.find((m) => m.mission_id === selectedMission);
    if (!mission) return <div>Mission not found</div>;

    // Pass data explicitly
    const personAssignments = getPeopleByMission(mission.mission_id, data);

    // Get all unique shifts for this mission
    const missionShifts = new Set<number>();
    personAssignments.forEach((pa) => {
      pa.assignments.forEach((assignment) => {
        const shiftId = data.person_mission_shift.find(
          (pms) =>
            pms.person_id === pa.person.person_id &&
            pms.mission_id === mission.mission_id &&
            pms.assignment_note === assignment.assignment_note
        )?.shift_id;

        if (shiftId) missionShifts.add(shiftId);
      });
    });

    // Convert to array and sort by shift name
    const shiftsArray = Array.from(missionShifts)
      .map((id): ShiftInfo => {
        const shift = data.shift.find((s) => s.shift_id === id);
        return { id, name: shift?.shift_name || "Unknown" };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Filter personnel by selected shifts
    const filteredPersonnel = personAssignments.filter((pa) => {
      // If no shifts are selected, show NOBODY
      if (selectedShifts.length === 0) return false;
      // Otherwise, check if any of the person's assignments match a selected shift
      return pa.assignments.some((assignment) => {
        const shiftId = data.person_mission_shift.find(
          (pms) =>
            pms.person_id === pa.person.person_id &&
            pms.mission_id === mission.mission_id &&
            pms.assignment_note === assignment.assignment_note
        )?.shift_id;
        return shiftId && selectedShifts.includes(shiftId);
      });
    });

    const toggleShift = (shiftId: number) => {
      setSelectedShifts((prev) => {
        if (prev.includes(shiftId)) {
          return prev.filter((id) => id !== shiftId);
        } else {
          return [...prev, shiftId];
        }
      });
    };

    const selectAllShifts = () => {
      const allShiftIds = shiftsArray.map((s) => s.id);
      setSelectedShifts([...allShiftIds]); // Create a new array reference
    };

    const selectNoneShifts = () => {
      setSelectedShifts([]); // Explicitly set to empty array
    };

    return (
      <div className="mission-details">
        <button
          className="back-button"
          onClick={() => {
            setViewMode("search");
            setSelectedMission(null);
            // selectedShifts is cleared by useEffect
          }}
        >
          ← Back to Search
        </button>

        <h2>{mission.mission_name}</h2>

        {mission.launch_date && (
          <p className="mission-date">Launch Date: {mission.launch_date}</p>
        )}

        {mission.mission_code && (
          <p className="mission-code">Mission Code: {mission.mission_code}</p>
        )}

        {mission.source_note && (
          <p className="mission-source">{mission.source_note}</p>
        )}

        <h3>Mission Personnel</h3>
        <p>Total personnel: {filteredPersonnel.length}</p>

        {shiftsArray.length > 0 && (
          <div className="shift-filter">
            <div className="shift-filter-header">
              <p>Filter by shift:</p>
              <div className="shift-filter-buttons">
                <button className="filter-button" onClick={selectAllShifts}>
                  Select All
                </button>
                <button className="filter-button" onClick={selectNoneShifts}>
                  Select None
                </button>
              </div>
            </div>
            <div className="shift-checkboxes">
              {shiftsArray.map((shift) => (
                <label key={shift.id} className="shift-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedShifts.includes(shift.id)}
                    onChange={() => toggleShift(shift.id)}
                  />
                  {shift.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="people-list">
          {filteredPersonnel.map((pa) => (
            <div
              key={pa.person.person_id}
              className="person-card"
              onClick={() => {
                setSelectedPerson(pa.person.person_id);
                setViewMode("person");
              }}
            >
              <h4>
                {pa.person.first_name} {pa.person.last_name}
              </h4>

              <ul className="assignment-list">
                {pa.assignments.map((assignment, idx) => (
                  <li key={idx}>
                    <strong>{assignment.shift}:</strong>{" "}
                    {assignment.assignment_note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render details for a selected role
  const renderRoleDetails = () => {
    if (!selectedRole) return null;

    const peopleInRole = getPeopleByRole(selectedRole, data);

    return (
      <div className="role-details">
        <button
          className="back-button"
          onClick={() => {
            setViewMode("search");
            setSelectedRole(null);
          }}
        >
          ← Back to Search
        </button>

        <h2>{selectedRole}</h2>
        <p>Total personnel found: {peopleInRole.length}</p>

        <div className="people-list">
          {" "}
          {/* Reuse people-list for layout */}
          {peopleInRole.map((pr) => (
            <div
              key={pr.person.person_id}
              className="person-card" // Reuse person-card style
              onClick={() => {
                setSelectedPerson(pr.person.person_id);
                setViewMode("person");
              }}
            >
              <h4>
                {pr.person.first_name} {pr.person.last_name}
              </h4>
              {/* List missions where the person held this role */}
              {pr.missions.length > 0 && (
                <div className="role-mission-list">
                  <p>Missions as {selectedRole}:</p>
                  <ul>
                    {pr.missions.map((missionInfo, index) => (
                      <li key={index}>{missionInfo.mission_name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render search results
  const renderSearchResults = () => {
    return (
      <div className="search-results">
        {searchTerm && (
          <>
            <div className="results-section">
              {/* Show full count */}
              <h3>People ({filteredPeople.length})</h3>
              <div className="result-grid">
                {/* Remove slice */}
                {filteredPeople.map((person) => (
                  <div
                    key={person.person_id}
                    className="result-card"
                    onClick={() => {
                      setSelectedPerson(person.person_id);
                      setViewMode("person");
                    }}
                  >
                    <span className="person-name">
                      {person.last_name}, {person.first_name}
                    </span>
                  </div>
                ))}
                {/* Remove more results indicator */}
              </div>
            </div>

            <div className="results-section">
              {/* Show full count */}
              <h3>Missions ({filteredMissions.length})</h3>
              <div className="result-grid">
                {/* Remove slice */}
                {filteredMissions.map((mission) => (
                  <div
                    key={mission.mission_id}
                    className="result-card mission-result"
                    onClick={() => {
                      setSelectedMission(mission.mission_id);
                      setViewMode("mission");
                    }}
                  >
                    <span className="mission-name">{mission.mission_name}</span>
                    {mission.launch_date && (
                      <span className="launch-date">{mission.launch_date}</span>
                    )}
                  </div>
                ))}
                {/* Remove more results indicator */}
              </div>
            </div>
          </>
        )}

        {!searchTerm && (
          <>
            {" "}
            {/* Wrap multiple sections */}
            <div className="browse-missions">
              <h3>Browse Missions</h3>
              <div className="mission-timeline">
                {sortedMissions.map((mission) => (
                  <div
                    key={mission.mission_id}
                    className="mission-item"
                    onClick={() => {
                      setSelectedMission(mission.mission_id);
                      setViewMode("mission");
                    }}
                  >
                    <div className="mission-dot"></div>
                    <div className="mission-label">
                      <span className="mission-name">
                        {mission.mission_name}
                      </span>
                      {mission.launch_date && (
                        <span className="launch-date">
                          {mission.launch_date}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Add Browse by Role section */}
            <div className="browse-roles">
              <h3>Browse by Role ({uniqueRoles.length})</h3>
              <div className="role-list">
                {uniqueRoles.map((role) => (
                  <div
                    key={role}
                    className="role-item" // Use a new class for styling
                    onClick={() => {
                      setSelectedRole(role);
                      setViewMode("role");
                    }}
                  >
                    {role}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header>
        <h1>NASA Historical Mission Control Personnel Directory</h1>
        <p className="subtitle">
          Explore the people behind NASA's missions from Gemini to Shuttle
        </p>
      </header>
      {viewMode === "search" && (
        <div className="search-container">
          {/* Wrap input and button for positioning */}
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search by name or mission..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {/* Conditionally render clear button */}
            {searchTerm && (
              <button
                className="clear-button"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                &times; {/* HTML entity for X */}
              </button>
            )}
          </div>

          <div className="search-stats">
            <p>
              Database contains {data.person.length} people across{" "}
              {data.mission.length} missions
            </p>
          </div>

          {renderSearchResults()}
        </div>
      )}
      {viewMode === "mission" && renderMissionDetails()}
      {viewMode === "person" && renderPersonDetails()}
      {viewMode === "role" && renderRoleDetails()}{" "}
      {/* Add role view rendering */}
    </div>
  );
}

export default App;
