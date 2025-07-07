# Contributing to the Club Website

Thank you for your interest in contributing! We welcome contributions that improve the website, fix bugs, or add new blog posts.

---

## How to Add a New Blog Post

Our blog posts use MDX, which allows you to write markdown enhanced with React components.

### Step 1: Create a new MDX file

1. Navigate to the blog content directory:

```
/src/content/blog/
```

2. Create a new `.mdx` file with a filename that reflects your post title, e.g.:

```
my-first-post.mdx
````

### Step 2: Write your blog post

Each blog post must include frontmatter metadata at the top:

```md
---
title: "My First Blog Post"
date: "2025-06-07"
description: "A short summary of my blog post."
tags: ["announcement", "update"]
---

# Heading

Write your blog content here using markdown.

You can also embed React components:

<MyCustomComponent />
````

### Step 3: Save and test locally

Run the development server to preview your post:

```bash
npm run dev
```

Visit `http://localhost:4321/blog/my-first-post` (adjust path if needed) to see your new blog post live.

---

## Code Style & Guidelines

* Use semantic HTML where possible
* Keep components reusable and modular
* Write clear and concise commit messages

---

## Submitting Your Changes

1. Fork the repository.

2. Create a new branch for your feature or fix:

   ```bash
   git checkout -b feature/my-new-blog
   ```

3. Make your changes and commit them.

4. Push to your fork and open a Pull Request.

---

Thanks for contributing! If you have any questions, feel free to open an issue or contact the maintainers.

