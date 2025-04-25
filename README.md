# NASA Historical Mission Control Personnel Directory

**Live Demo:** [https://apolloinrealtime.org/MOCR_directory/](https://apolloinrealtime.org/MOCR_directory/)

This project is a web application designed to explore the personnel who worked in mission control for NASA missions, spanning from the Gemini program through the Space Shuttle era.

It allows users to:

- **Browse missions:** View a timeline of missions and select one to see details.
- **Search:** Find specific missions or personnel by name.
- **View Mission Details:** See the personnel assigned to a specific mission, filterable by shift.
- **View Person Details:** See the mission history for a specific individual.

## Data Source

The application uses data converted from the `Official-Database-3-26-2025.xlsx` spreadsheet located in the `/scripts` directory. The Python script `convert_to_json.py` was used to process this spreadsheet into the `mission_data.json` file located in `/src/data`, which the application consumes.

## Tech Stack

- **Framework:** React
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** CSS

## Development

1.  **Prerequisites:** Node.js and npm (or yarn/pnpm) installed.
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    This will start the Vite development server, typically available at `http://localhost:5173`.

## Building for Production

1.  **Build:**
    ```bash
    npm run build
    ```
    This command bundles the application into the `dist` directory.
2.  **Preview Production Build:**
    ```bash
    npm run preview
    ```
    This command serves the production build locally for testing.

## Deployment

The application is configured to use relative asset paths (`base: './'` in `vite.config.ts`), allowing the contents of the `dist` folder to be deployed to any subdirectory on a web server.
