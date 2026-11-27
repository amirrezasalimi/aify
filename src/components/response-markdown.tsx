import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ href, title, children }) => href && /^https?:\/\//i.test(href) ? (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2">
      <bdi>{children}</bdi>
    </a>
  ) : <span>{children}</span>,
  // Do not let a generated response cause background requests to remote images.
  img: ({ alt }) => alt ? <span>{alt}</span> : null,
  pre: ({ children }) => (
    <pre dir="ltr" className="overflow-x-auto rounded bg-gray-200 p-2 text-left text-xs">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm [&_td]:border [&_td]:border-gray-300 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-200 [&_th]:p-1.5">
        {children}
      </table>
    </div>
  ),
};

export const ResponseMarkdown = memo(function ResponseMarkdown({ text }: { text: string }) {
  return (
    <div dir="auto" className="aify-message-text space-y-2 [overflow-wrap:anywhere] [&_p]:whitespace-pre-line [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5 [&_blockquote]:border-s-2 [&_blockquote]:border-gray-300 [&_blockquote]:ps-3 [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_h1]:text-lg [&_h2]:text-base [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-gray-200 [&_:not(pre)>code]:px-1">
      <Markdown skipHtml remarkPlugins={[remarkGfm]} components={components}>{text}</Markdown>
    </div>
  );
});
