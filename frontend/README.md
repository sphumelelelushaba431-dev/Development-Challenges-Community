# DCC front end — HTML, CSS and JavaScript

Static pages, with no framework and no build step. `css/app.css` is already compiled.

## Run
```
python -m http.server 3000        # or: npx serve -l 3000 .
```
Then open http://localhost:3000. The backend must be running (see `../backend/README.md`).

## Configuration — `js/config.js`
```js
window.DCC_CONFIG = {
  apiBase: 'http://127.0.0.1:5000/api',   // where the Flask API runs
  demo: false                              // true = no backend: sample data, no sign-in needed
};
```
`js/api.js` handles the rest:
- it sends the sign-in token with every request;
- it sends members to their own dashboard, and back to Login when they are not signed in;
- it turns server dates into JavaScript dates;
- it shows server errors as messages.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home: background photo, How it can assist, Contact, and Register / Login / Dashboard buttons |
| `public.html` + `js/public.js` | Public dashboard for visitors: impact metrics, progress strip, previous solutions, submissions by area, date-range calendar, dark mode |
| `login.html` + `js/login.js` | Login and forgotten password |
| `register.html` + `js/register.js` | Step 1: Terms and Conditions + POPIA consent. Step 2: the member form |
| `student.html` + `js/student.js` | My challenges, progress, and recommended challenges with **Request** |
| `supervisor.html` + `js/supervisor.js` | Reviews, allocation, decisions, student requests, verification, meetings and **Submit challenge** |
| `representative.html` + `js/representative.js` | **Submit challenge** (funding question), Supervisors Attention and Progress Tracking |
| `admin.html` + `js/admin.js` | Approvals, locked accounts, members, organisations and activity |
| `terms.html`, `privacy.html` | Terms and Conditions, and the Privacy Policy (POPIA) |

## Shared code

| File | What it does |
|---|---|
| `js/config.js`, `js/api.js` | Backend address and API client |
| `js/ui.js` | Header, notifications, profile panel, settings, meetings, pop-up windows, date-range calendar, layout helpers |
| `js/charts.js` | Donut, bar and bullet charts drawn in SVG, with hover tooltips |
| `js/keywords.js`, `js/matching.js` | A browser copy of the keyword extraction and matching, used in demo mode and by `tools/keyword-tester.html`. With the backend, the server's Python model decides |
| `images/` | Home photo and favicon |
| `src/input.css`, `build.mjs` | Tailwind source of `css/app.css`. Only needed if you change the styles (`npm install tailwindcss@4 && node build.mjs`) |
