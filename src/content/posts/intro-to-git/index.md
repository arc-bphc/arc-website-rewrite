---
title: "An Introduction to Git: Version Control for Everyone"
description: "A beginner's guide to understanding Git, its features, and how to get started with version control."
image: "./intro-to-git.jpg"
createdAt: 07-14-2025
draft: false
tags:
  - guide
  - github
  - "getting started" 

---

# Contributing to Our Club Website

Welcome!  
Whether you're a seasoned developer or just starting out, contributing to our club website is a great way to build real-world skills, collaborate with others, and leave your mark on something meaningful.

This guide will walk you through the process of getting started, understanding the project, and making your first contribution.

---

## Why Contribute?

- Improve your web development skills (frontend/backend)
- Collaborate with fellow club members
- Build something real that represents our club
- Add an awesome project to your resume

---

## Tech Stack

Our website is built using:

- **Frontend**: React + Tailwind CSS (via Vite)
- **Backend**: Node.js + Express (or relevant framework)
- **Database**: PostgreSQL (via Supabase / Drizzle / Prisma etc.)
- **Deployment**: Docker, hosted via Coolify / Vercel / Netlify

*Note: Replace these as per your actual stack.*

---

## Setting Up the Project

1. **Clone the Repository**

```bash
git clone https://github.com/<your-org>/<club-website>.git
cd club-website
````

2. **Install Dependencies**

```bash
pnpm install
```

3. **Set Up Environment Variables**

   Create a `.env` file in the root directory with the required environment variables:

   ```
   DATABASE_URL=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

   Ask a maintainer for development secrets if needed.

4. **Run the Development Server**

   ```bash
   pnpm dev
   ```

   The site should now be running on `http://localhost:3000`.

---

## How to Contribute

1. **Find an Issue**

   * Check the Issues tab on GitHub
   * Look for labels like `good first issue`, `help wanted`, or `frontend/backend`

2. **Create a Branch**

   ```bash
   git checkout -b feature/<your-feature-name>
   ```

3. **Make Changes**

   * Follow code style and conventions
   * Add comments where necessary
   * If it's a UI change, include a screenshot in your PR

4. **Commit Your Work**

   ```bash
   git add .
   git commit -m "feat: add <your-feature-description>"
   git push origin feature/<your-feature-name>
   ```

5. **Open a Pull Request**

   * Go to GitHub and create a pull request
   * Mention the issue number if applicable
   * Request a review from one of the maintainers

---

## Tips for First-Time Contributors

* Don’t hesitate to ask questions in our communication channels
* Make small, focused PRs
* Keep commits clean and meaningful
* Document new features or components
* Run `pnpm lint` and `pnpm format` before pushing

---

## Things You Can Work On

* Fix bugs or typos
* Add new sections (Events, Projects, Gallery, etc.)
* Improve responsiveness and accessibility
* Connect new APIs (weather, news, etc.)
* Write blog posts for the website

---

## Need Help?

Ping us in the dev group or open a GitHub Discussion.

We’re excited to build this together. Happy coding!