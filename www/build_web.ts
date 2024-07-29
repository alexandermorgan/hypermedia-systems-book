#!/usr/bin/env -S deno run -A --unstable

import { Element, Text } from "https://codeberg.org/dz4k/muteferrika/raw/commit/01fd5d0aadb6955c8f5f604312fd32f8db3d6bfc/lib/deps/deno-dom.ts";
import { build, Book, Frontmatter, Copyright, Dedication, Foreword, Part, Introduction, Chapter, write, TableOfContents, LandingPage, Division } from "https://codeberg.org/dz4k/muteferrika/raw/commit/01fd5d0aadb6955c8f5f604312fd32f8db3d6bfc/lib/muteferrika.ts";
import { copySync } from "https://deno.land/std@0.157.0/fs/copy.ts";


const compile = async (path: string) => {
  const pandoc = new Deno.Command("pandoc", {
    args: ["-f", "typst", "-t", "html", "--", path],
  });
  const pandocOutput = await pandoc.output()
  if (!pandocOutput.success) {
    console.error("pandoc:", new TextDecoder().decode(pandocOutput.stderr))
    Deno.exit(pandocOutput.code)
  }
  const compiled = new TextDecoder().decode(pandocOutput.stdout);
  const headingsUpleveled = compiled.replace(/<(\/?)h(\d)/g, (_, slash, level) => `<${slash}h${+level - 1}`);
  const title = headingsUpleveled.match(/<h1>(.*)<\/h1>/)?.[1];
  const h1Removed = headingsUpleveled.replace(/<h1>.*<\/h1>/, "");
  const url = path
    .replace(/\.typ$/, "/")
    .replace(/ch\d\d-|-\d-/, "/");
  return {
    compiledContent: h1Removed,
    title,
    url,
    // add ids to headings
    process(this: Division): undefined {
      const ids = new Map<string, number>();
      this.dom.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((node) => {
        const heading = node as Element
        if (heading.hasAttribute("id")) return;
        let id = heading.textContent.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const count = ids.get(id) || 0;
        if (count) id += `-${count}`;
        ids.set(id, count + 1);
        heading.setAttribute("id", id);
      })
      this.dom.querySelectorAll("img").forEach((node) => {
        const img = node as Element
        if (img.hasAttribute("src") && !img.getAttribute("src")?.startsWith("http")) {
          img.setAttribute("src", `/${img.getAttribute("src")}`);
        }
      })
      this.dom.querySelectorAll("blockquote p:last-child").forEach((node) => {
        const line = node as Element
        if (line.textContent?.startsWith("℄")) {
          line.classList.add("quote-attribution");
          line.parentElement!.after(line);
          const text = line.firstChild as Text
          text.data = text.data.replace("℄", "");
        }
      })
    }
  };
}

const HypermediaSystems = new Book("Hypermedia Systems").with(
  {
    lang: "en",
    htmlHead: `
    <meta charset=utf8 name=viewport content=width=device-width>
    <link rel="stylesheet" href="/style.css">
    <script type="module" src="/color-customizer.js"></script>
    <header class="book-header">
      <a href="/" class="homepage-link">Hypermedia Systems</a>
    </header>
    `,
    htmlFooter: `
    <footer class="book-footer">
      <a href="/" class="footer-book-title">Hypermedia Systems</a>
      <a href="/book/contents/">Contents</a>
      <color-customizer></color-customizer>
    </footer>
    `
  },
  new LandingPage("Hypermedia Systems").with({ url: '/', content: await Deno.readTextFile("www/cover.html") }),
  new Frontmatter().with(
    new Copyright("Copyright & Acknowledgments").with(await compile("-1-copy-ack.typ")),
    new Dedication("Dedication").with(await compile("-2-dedication.typ")),
    new Foreword("Foreword").with(await compile("-3-foreword.typ")),
    new TableOfContents("Contents").with({
      url: '/book/contents/',
      file: "www/tocheader.html",
      compile: it => it
    }),
  ),
  new Part("Hypermedia Concepts").with(
    { url: '/part/hypermedia-concepts/' },
    new Introduction().with(await compile("ch00-introduction.typ")),
    new Chapter().with(await compile("ch01-hypermedia-a-reintroduction.typ")),
    new Chapter().with(await compile("ch02-components-of-a-hypermedia-system.typ")),
    new Chapter().with(await compile("ch03-a-web-1-0-application.typ")),
  ),
  new Part("Hypermedia-Driven Web Applications With Htmx").with(
    { url: '/part/htmx/' },
    new Chapter().with(await compile("ch04-extending-html-as-hypermedia.typ")),
    new Chapter().with(await compile("ch05-htmx-patterns.typ")),
    new Chapter().with(await compile("ch06-more-htmx-patterns.typ")),
    new Chapter().with(await compile("ch07-a-dynamic-archive-ui.typ")),
    new Chapter().with(await compile("ch08-tricks-of-the-htmx-masters.typ")),
    new Chapter().with(await compile("ch09-client-side-scripting.typ")),
    new Chapter().with(await compile("ch10-json-data-apis.typ")),
  ),
  new Part("Bringing Hypermedia To Mobile").with(
    { url: '/part/hyperview/' },
    new Chapter().with(await compile("ch11-hyperview-a-mobile-hypermedia.typ")),
    new Chapter().with(await compile("ch12-building-a-contacts-app-with-hyperview.typ")),
    new Chapter().with(await compile("ch13-extending-the-hyperview-client.typ")),
  ),
  new Part("Conclusion").with(
    { url: '/part/conclusion/' },
    new Chapter().with(await compile("ch14-conclusion.typ")),
  ),
);

const built = await build(HypermediaSystems);
console.log(built.length);
write(built, { directory: "_site" })
copySync("www/style.css", "_site/style.css");
copySync("fonts", "_site/fonts");
copySync("www/color-customizer.js", "_site/color-customizer.js");
