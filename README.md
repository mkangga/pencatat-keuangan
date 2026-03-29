# Keuangan App

A personal finance application built with React, Vite, Tailwind CSS, and Firebase.

## Deployment to Cloudflare Pages

This application is a Single Page Application (SPA). To deploy to Cloudflare Pages:

1.  **Push your code to GitHub.**
2.  **Log in to the Cloudflare Dashboard.**
3.  **Navigate to Workers & Pages > Create application > Pages > Connect to Git.**
4.  **Select your repository.**
5.  **Configure build settings:**
    *   **Framework preset:** Vite
    *   **Build command:** `npm run build`
    *   **Build output directory:** `dist`
6.  **Environment variables:**
    *   Add your Firebase configuration variables (e.g., `VITE_FIREBASE_API_KEY`, etc.) if they are not already handled via client-side code.
    *   Add `VITE_GEMINI_API_KEY` if required.
7.  **Save and Deploy.**

## Development

1.  `npm install`
2.  `npm run dev`
