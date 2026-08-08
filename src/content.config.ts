import { file, glob } from "astro/loaders";
import { defineCollection, z, reference } from "astro:content";
import type { icons as lucideIcons } from '@iconify-json/lucide/icons.json';
import type { icons as simpleIcons } from '@iconify-json/simple-icons/icons.json';

const other = defineCollection({
  loader: glob({ base: "src/content/other", pattern: "**/*.{md,mdx}" }),
});

const lucideIconSchema = z.object({
  type: z.literal("lucide"),
  name: z.custom<keyof typeof lucideIcons>(),
});

const simpleIconSchema = z.object({
  type: z.literal("simple-icons"),
  name: z.custom<keyof typeof simpleIcons>(),
});

const quickInfo = defineCollection({
  loader: file("src/content/info.json"),
  schema: z.object({
    id: z.number(),
    icon: z.union([lucideIconSchema, simpleIconSchema]),
    text: z.string(),
  })
});

const socials = defineCollection({
  loader: file("src/content/socials.json"),
  schema: z.object({
    id: z.number(),
    icon: z.union([lucideIconSchema, simpleIconSchema]),
    text: z.string(),
    link: z.string().url(),
  })
});

/**
 * Channels shown as scannable QR tiles in the About section. `qr` is the file
 * name of the code inside `src/assets/qr` — the tile falls back to a "pending"
 * frame while that file is missing, so entries can be added before the image is.
 */
const connect = defineCollection({
  loader: file("src/content/connect.json"),
  schema: z.object({
    id: z.string(),
    order: z.number(),
    label: z.string(),
    handle: z.string(),
    description: z.string(),
    icon: z.union([lucideIconSchema, simpleIconSchema]),
    link: z.string().url(),
    qr: z.string(),
  })
});

/**
 * Upcoming events. `date` drives ordering and the "is it still upcoming" filter;
 * entries with no fixed date yet use `when` instead and are listed last.
 */
const events = defineCollection({
  loader: file("src/content/events.json"),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    date: z.coerce.date().optional(),
    when: z.string().optional(),
    location: z.string().optional(),
    description: z.string(),
    link: z.string().url().optional(),
  })
});

const members = defineCollection({
  loader: glob({ base: "src/content/members", pattern: "**/*.{yaml,yml,toml}"}),
  schema: ({ image }) => z.object({
    name: z.string(),
    id: z.string(),
    image: image(),
    about : z.string(),
    branch: z.string(),
    socials: z.object({
      github: z.string(),
      linkedin: z.string(),
    }),

  })
})

const tags = defineCollection({
  loader: file("src/content/tags.json"),
  schema: z.object({
    id: z.string()
  })
});

const newsletter = defineCollection({
  loader: glob({ base: "src/content/newsletter", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    description: z.string(),
    tags: z.array(
      reference("tags")
    ),
    draft: z.boolean().optional().default(false),
    image: image(),
  })
});

const posts = defineCollection({
  loader: glob({ base: "src/content/posts", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    description: z.string(),
    tags: z.array(
      reference("tags")
    ),
    draft: z.boolean().optional().default(false),
    image: image(),
  })
});

const projects = defineCollection({
  loader: glob({ base: "src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    image: image(),
    link: z.string().url().optional(),
    info: z.array(
      z.object({
        text: z.string(),
        icon: z.union([lucideIconSchema, simpleIconSchema]),
        link: z.string().url().optional(),
      })
    )
  })
});

export const collections = { tags, posts, projects, other, quickInfo, socials, members, newsletter, connect, events };