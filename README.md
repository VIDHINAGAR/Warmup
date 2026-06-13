# 🍳 Fridge-to-Meal AI

Single-page React app. Enter your ingredients, budget, time, energy and diet → Gemini returns breakfast, lunch, dinner, a cooking to-do list, missing groceries, substitutions and a budget analysis. Dark theme, mobile responsive.

## Folder structure

```
fridge-to-meal-ai/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── README.md
└── src/
    ├── main.jsx        # React entry
    ├── index.css       # Tailwind + animations
    └── App.jsx         # Everything: form + Gemini integration + UI
```

## Setup (≈2 min)

```bash
# 1. install
npm install

# 2. add your Gemini API key (free: https://aistudio.google.com/app/apikey)
#    create a .env file with:
#    VITE_GEMINI_API_KEY=your_key_here
cp .env.example .env        # PowerShell: Copy-Item .env.example .env

# 3. run
npm run dev
```

Open the printed URL (default http://localhost:5173). No `.env`? Paste a key into the **“Gemini API Key”** field in the form.

## Build

```bash
npm run build
npm run preview
```

## Stack

React 18 · Vite 6 · Tailwind CSS v4 · Gemini API (`gemini-2.0-flash`)

> Note: the Gemini call runs in the browser, so the key is exposed. Fine for a hackathon/local demo; proxy through a backend for production.
