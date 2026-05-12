# Project Blueprint: Himalaya AI Client

## Overview

This document outlines the architecture, features, and development plan for the Himalaya AI Client, a modern email client built with Tauri, React, and integrated with Google Gemini for AI-powered features.

## Core Technologies

*   **Frontend:** React (with Vite and TypeScript)
*   **Backend & Native UI:** Tauri v2
*   **AI:** Google Gemini API
*   **Development Environment:** Project IDX (Nix-based)

## Implemented Features (As of Week 2)

*   **Modern 2-Pane UI:** A sidebar for navigation and a main content area for email lists, built with React.
*   **Mock Data Display:** The UI currently displays hardcoded dummy email data.
*   **AI Category Badge:** The UI includes a placeholder for an AI-generated category badge (`aiCategory`).

## Current Plan: Week 3 - Gemini API Integration

### 1. Setup API Client

*   **Install SDK:** Add the `@google/generative-ai` package to the project.
*   **API Key Management:** Create a `.env` file to securely store the Gemini API key. Access it in the Vite frontend using `import.meta.env.VITE_GEMINI_API_KEY`.

### 2. Implement AI Logic

*   **Create Service File:** Create a new file `src/lib/gemini.ts` to encapsulate all Gemini API interactions.
*   **Develop AI Prompt:** Engineer a system prompt that instructs the Gemini model to analyze an email's sender, subject, and body, and return a JSON object with:
    *   `aiCategory`: A predefined category (e.g., "重要", "要確認", "社内業務", "プロモーション").
    *   `snippet`: A short, one-sentence summary of the email content.
*   **Create Function:** Implement an async function `getAiCategorization(from: string, subject: string, body: string)` that sends the data and prompt to the Gemini API and returns the parsed JSON response.

### 3. Integrate into React Component

*   **Modify `App.tsx`:**
    *   Import the `getAiCategorization` function.
    *   Introduce a loading state (`isAiAnalyzing`) to track the status of the API calls.
    *   Use a `useEffect` hook to trigger the AI analysis when the component mounts.
    *   Iterate through the (currently mocked) email data.
    *   For each email, call `getAiCategorization` with its details.
    *   Update the state of the email list with the new `aiCategory` and `snippet` received from the API.
*   **Enhance UI for Loading State:**
    *   While `isAiAnalyzing` is true, display a clear loading indicator to the user (e.g., "AIが分析中...").
    *   Once complete, the UI should seamlessly update to show the new AI-generated data.
