import './styles.css';
import './components/TerrainPreview';
import './components/SupplyLinePreview';
import './components/FacilityPreview';
import './components/UnitPreview';
import { findMarkerElements, renderMarkdown } from './markdownLoader';
import { mountComponents } from './mountComponent';

interface BiblePage {
  slug: string;
  title: string;
  load: () => Promise<string>;
}

const pages: BiblePage[] = [
  {
    slug: 'index',
    title: 'Overview',
    load: () => import('../../docs/bible/index.md?raw').then((m) => m.default),
  },
  {
    slug: 'terrain',
    title: 'Terrain',
    load: () => import('../../docs/bible/terrain.md?raw').then((m) => m.default),
  },
  {
    slug: 'supply-lines',
    title: 'Supply Lines',
    load: () => import('../../docs/bible/supply-lines.md?raw').then((m) => m.default),
  },
  {
    slug: 'facilities',
    title: 'Facilities',
    load: () => import('../../docs/bible/facilities.md?raw').then((m) => m.default),
  },
  {
    slug: 'units',
    title: 'Units',
    load: () => import('../../docs/bible/units.md?raw').then((m) => m.default),
  },
];

const nav = document.getElementById('bible-nav')!;
const content = document.getElementById('bible-content')!;

let activePage = 'index';
let activeCleanups: Array<() => void> = [];

function buildNav(): void {
  nav.innerHTML = '';
  for (const page of pages) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${page.slug}`;
    a.textContent = page.title;
    if (page.slug === activePage) a.classList.add('active');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      loadPage(page.slug);
    });
    li.appendChild(a);
    nav.appendChild(li);
  }
}

async function loadPage(slug: string): Promise<void> {
  for (const cleanup of activeCleanups) {
    cleanup();
  }
  activeCleanups = [];

  activePage = slug;
  buildNav();

  const page = pages.find((p) => p.slug === slug);
  if (!page) {
    content.innerHTML = '<h1>Not Found</h1>';
    return;
  }

  const source = await page.load();
  const { html, markers } = renderMarkdown(source);
  content.innerHTML = html;

  const components = findMarkerElements(content, markers);
  activeCleanups = await mountComponents(components);
}

buildNav();
loadPage('index');
