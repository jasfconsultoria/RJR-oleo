# AI Rules for RJR Óleo Application

This document outlines the core technologies and libraries used in the RJR Óleo web application, along with guidelines for their usage.

## Tech Stack Overview

*   **Frontend Framework:** React (version 18.2.0) for building the user interface.
*   **Language:** JavaScript (JSX) is currently used for existing files, but **TypeScript (TSX)** is preferred for all new components, pages, and utility files to enhance maintainability and type safety.
*   **Routing:** React Router (v6) for declarative client-side routing.
*   **UI Components:** Shadcn/ui components are used for a consistent and accessible user interface.
*   **Styling:** Tailwind CSS for utility-first CSS styling, ensuring responsive and modern designs.
*   **Backend & Database:** Supabase for authentication, real-time database, and storage.
*   **Animations:** Framer Motion for smooth and engaging UI animations.
*   **Icons:** Lucide React for a comprehensive set of customizable SVG icons.
*   **Date Management:** `date-fns` and `date-fns-tz` for robust date parsing, formatting, and timezone handling.
*   **Input Masking:** `react-imask` for formatted input fields (e.g., CPF/CNPJ, phone numbers).
*   **PDF Generation:** `html2canvas` and `jspdf` for client-side generation of PDF documents from HTML content.
*   **Data Visualization:** Recharts for creating interactive charts and graphs on the dashboard.
*   **Excel Export:** `xlsx` library for exporting tabular data to Excel spreadsheets.

## Library Usage Guidelines

To maintain consistency, performance, and readability, please adhere to the following rules when using libraries:

*   **UI Components (`shadcn/ui`):**
    *   Always prioritize using existing `shadcn/ui` components (e.g., `Button`, `Input`, `Card`, `Table`, `Select`, `Dialog`, `AlertDialog`).
    *   If a required component is not available in `shadcn/ui` or needs significant customization that would involve modifying the original `shadcn/ui` files, create a new, separate component in `src/components/`. Do **not** modify `shadcn/ui`'s source files directly.
*   **Styling (`Tailwind CSS`):**
    *   All styling must be done using Tailwind CSS utility classes. Avoid inline styles or custom CSS files unless absolutely necessary for very specific, isolated cases (e.g., global overrides in `src/index.css`).
    *   Ensure designs are responsive by utilizing Tailwind's responsive prefixes (e.g., `md:`, `lg:`).
*   **Routing (`react-router-dom`):**
    *   All application routes should be defined and managed within `src/App.jsx` (or `src/App.tsx` if converted).
    *   Use `Link` and `NavLink` components for navigation within the app.
    *   Use `useNavigate` hook for programmatic navigation.
*   **Backend Interaction (`Supabase`):**
    *   All data fetching, mutations, and authentication operations must be performed using the Supabase client (`@supabase/supabase-js`).
    *   Centralize Supabase client initialization in `src/lib/customSupabaseClient.js`.
    *   Utilize Supabase's built-in features like Row Level Security (RLS) and PostgreSQL functions (RPCs) for secure and efficient data access.
*   **State Management:**
    *   Prefer React's built-in state management features (`useState`, `useContext`, `useReducer`) and custom hooks for local and global state.
    *   The `SupabaseAuthContext` and `ProfileContext` in `src/contexts/` are the primary sources for user authentication and profile data.
    *   Avoid introducing external state management libraries unless explicitly requested and justified.
*   **Icons (`lucide-react`):**
    *   Always use icons from the `lucide-react` library.
*   **Date & Time (`date-fns`, `date-fns-tz`):**
    *   Use `date-fns` for all date formatting, parsing, and manipulation.
    *   Use `date-fns-tz` for handling timezones, especially when dealing with dates from the database or external sources.
*   **Input Masking (`react-imask`):**
    *   Apply `react-imask` for any input fields requiring specific formatting (e.g., CPF/CNPJ, phone numbers).
*   **PDF Generation (`html2canvas`, `jspdf`):**
    *   When generating PDFs from HTML content, use `html2canvas` to convert HTML elements to canvas images, and then `jspdf` to create the PDF document from these images.
*   **Data Visualization (`recharts`):**
    *   For any new charts or graphs, use components provided by `recharts`.
*   **Excel Export (`xlsx`):**
    *   Use the `xlsx` library for any functionality requiring data export to Excel files.
*   **Animations (`framer-motion`):**
    *   Apply `framer-motion` for any new animations to ensure a consistent and performant animation experience.
*   **Utility Functions:**
    *   Common utility functions (e.g., `cn`, `formatDate`, `formatCnpjCpf`) should be placed in `src/lib/utils.js`.
    *   Custom hooks should reside in `src/hooks/`.
    *   Location data (states, municipalities) is available in `src/lib/brazilian-locations.js` and `src/lib/location.js`.
*   **Logging:**
    *   Use the `logAction` utility from `src/lib/logger.js` to record significant user actions or system events in the `logs` table.