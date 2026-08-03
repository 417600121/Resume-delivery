import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });
const defaultLinkOpen = markdown.renderer.rules.link_open
  || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet('target', '_blank');
  tokens[index].attrSet('rel', 'noreferrer');
  return defaultLinkOpen(tokens, index, options, env, self);
};

export function renderMarkdown(value) {
  return markdown.render(String(value || ''));
}

export function firstMarkdownLink(value) {
  const tokens = markdown.parse(String(value || ''), {});
  const queue = [...tokens];

  while (queue.length) {
    const token = queue.shift();
    if (token.type === 'link_open') {
      const href = token.attrGet('href');
      if (/^https?:\/\//i.test(href || '')) return href;
    }
    if (token.children?.length) queue.unshift(...token.children);
  }
  return '';
}
