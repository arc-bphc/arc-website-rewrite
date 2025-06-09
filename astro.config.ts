import { loadEnv } from "vite";
import { defineConfig } from 'astro/config';

import expressiveCode from 'astro-expressive-code';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import spectre from './package/src';

import node from '@astrojs/node';
import vercel from "@astrojs/vercel"
import { spectreDark } from './src/ec-theme';

import react from '@astrojs/react'

const {
  GISCUS_REPO,
  GISCUS_REPO_ID,
  GISCUS_CATEGORY,
  GISCUS_CATEGORY_ID,
  GISCUS_MAPPING,
  GISCUS_STRICT,
  GISCUS_REACTIONS_ENABLED,
  GISCUS_EMIT_METADATA,
  GISCUS_LANG
} = loadEnv(process.env.NODE_ENV!, process.cwd(), "");

// https://astro.build/config
const config = defineConfig({
  site: 'https://staging.arc.aten2005.dev',
  output: 'static',
  integrations: [
    react(),
    expressiveCode({
      themes: [spectreDark],
    }),
    mdx(),
    sitemap(),
    spectre({
      name: 'ARC BPHC',
      openGraph: {
        home: {
          title: 'ARC BPHC',
          description: 'ARC (Automation and Robotics Club) of BITS Pilani, Hyderabad Campus'
        },
        blog: {
          title: 'Blog',
          description: 'Find out what is cooking at ARC BPHC.'
        },
        projects: {
          title: 'Projects'
        }
      },
    })
  ],
  adapter: vercel(),
});

export default config;