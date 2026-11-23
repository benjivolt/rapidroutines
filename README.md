# RapidRoutines

RapidRoutines is a free calisthenics platform at https://rapidroutines.org. It has an exercise library, RapidTree (a skill tree for tracking progressions such as the front lever and planche), an AI chatbot that answers training questions using Gemini and a knowledge base stored in MongoDB, RepBot, which counts reps from your webcam, and an exercise tracker. RepBot runs MediaPipe Pose in the browser and sends the pose landmarks to the server, which does the rep counting. Accounts save your exercises, chat history, RapidTree progress and workout log.

## Architecture

One Express server, hosted on Render, serves everything:

- the marketing pages at the site root (a static export of the old WordPress/Elementor site)
- the dashboard, a React single-page app, under `/dashboard`
- the API under `/api`

Data lives in MongoDB Atlas. Account email (welcome, password reset and reset confirmation messages) goes out through Resend. The contact form on `contact-us.html` posts to `/api/contact`, which sends the message through Zoho SMTP.

The chatbot, RepBot and exercise tracker are standalone pages in `chatbot/`, `repbot/` and `exercise-tracker/`. The dashboard shows them in iframes and talks to them with `postMessage`, restricted to the site's own origin.

## Project layout

```
*.html                  marketing pages (index, about, faq, contact-us, testimonials)
css/ js/ fonts/         WordPress and Elementor assets, plus js/contact-form.js and css/custom.css
images/ media/          site images and video
chatbot/                chatbot page
repbot/                 RepBot page (MediaPipe Pose from jsDelivr, pinned with integrity hashes)
exercise-tracker/       exercise tracker page
dashboard_main/src/     dashboard source (React, Vite, Tailwind)
dashboard_main/backend/ Express API and site server, with tests in test/
dashboard/              committed dashboard build, used when dashboard_main/dist is missing
render.yaml             Render service definition
```

## Local development

You need Node 20.19 or later (Vite 7 does not run on older Node 20 releases).

```
npm run build
```

This installs the dashboard's dependencies, builds it into `dashboard_main/dist`, and installs the backend's production dependencies.

The server reads its settings from environment variables. Copy `dashboard_main/backend/.env.example` to `.env` in the repository root, since `npm start` runs from there and dotenv reads `.env` from the working directory. Then fill in the values. The server will not start without `MONGO_URI`, `JWT_SECRET` and `RESEND_API_KEY`. The chatbot also needs `GEMINI_API_KEY`, and the contact form needs the `ZOHO_SMTP_*` values. `.env` is listed in `.gitignore`.

```
npm start
```

The site is then at http://localhost:5000 (or the `PORT` you set).

To refresh the committed `dashboard/` folder after changing the dashboard, run `npm run build:dashboard`. Lint the dashboard with `npm --prefix dashboard_main run lint`.

## Tests

```
npm --prefix dashboard_main/backend ci
npm test
```

The tests use Node's built-in test runner, supertest and an in-memory MongoDB, so they do not need a database or API keys. `npm run build` skips the backend's dev dependencies, which is why the tests need their own install first.

## Deployment

Render deploys from `render.yaml` at the repository root. The build command is `npm run build`, the start command is `npm start`, and the health check is `GET /api`. Render generates `JWT_SECRET`. Set `MONGO_URI`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `ZOHO_SMTP_USER` and `ZOHO_SMTP_PASS` in the Render dashboard.

## Security

- Sign-in uses JWTs that expire after 7 days. Each user has a token version stored on the server, and signing out, resetting the password or changing the email address increments it, so older tokens stop working. Passwords are hashed with bcrypt.
- Sign-in, sign-up, password reset, contact, chatbot, RepBot and saved-data requests are rate limited per IP address.
- Helmet sets a Content Security Policy and the usual security headers. Pages can only be framed by the site itself, and a Permissions-Policy allows the camera only on the site's own pages.
- Request bodies are capped at 300 KB, and each user's saved data at 256 KB. The server checks the length and format of names, emails, passwords, chat messages and contact form fields.
- The server returns 404 for dotfiles and for private paths such as `dashboard_main/`, `node_modules/`, `package.json` and this README.
- Password reset links are built from the `FRONTEND_URL` setting, never from the request's Host header. Reset tokens are stored hashed and expire.
- Changing the account email or deleting the account requires the current password.
- The chatbot shows the model's replies as plain text by building DOM nodes, so HTML in a reply is never rendered.

## Contributors

Built by [Ben G](https://github.com/benjivolt) and the RapidRoutines team, with contributions from Jaip1019.
