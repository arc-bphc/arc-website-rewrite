# ARC BPHC

Welcome to the official repository for the Club Website — built using [Astro](https://astro.build/) and [React](https://reactjs.org/). This site showcases our club activities, events, and blog posts.

## Features

- Fast, optimized static site with Astro
- React components for interactive UI
- Blog system powered by MDX for markdown + React support
- Responsive and accessible design
- SEO-friendly metadata handling

## Getting Started

### Prerequisites

- Node.js (>= 16)
- npm or yarn package manager

### Installation

1. Clone this repo:

   ```bash
   git clone git@github.com:arc-bphc/arc-website-rewrite.git
   cd club-website
		```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open your browser and go to `http://localhost:4321` to view the site.

### Building for Production

```bash
npm run build
```

This will generate a production-ready build in the `dist/` folder.

### Generating search index

```bash
npm run postbuild
```
This will regnerate the site search index based on the content in the `dist/` folder 

## Folder Structure

* `/src/pages` — Astro pages and routes
* `/src/components` — React and Astro components
* `/src/content/posts` — Blog posts written in MDX
* `/src/content/projects` - Project write-ups written in MDX
* `/src/content/assets` - Blog and Project image headers
* `/public` — Static assets like images, fonts, and icons

---

## License

This project is licensed under the MIT License.

---

## Contact

For questions, reach out to the club maintainers or open an issue here on GitHub.

---