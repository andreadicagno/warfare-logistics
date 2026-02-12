import './styles.css';
import { findMarkerElements, renderMarkdown } from './markdownLoader';

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
];

const nav = document.getElementById('bible-nav')!;
const content = document.getElementById('bible-content')!;

let activePage = 'index';

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
  for (const comp of components) {
    comp.element.textContent = `[Preview: ${comp.type}]`;
  }
}

buildNav();
loadPage('index');
