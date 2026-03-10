"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface DocContentProps {
  content: string
}

export function DocContent({ content }: DocContentProps) {
  return (
    <div className="prose-dark">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const isInline = !className
            if (isInline) {
              return <code className={className} {...props}>{children}</code>
            }
            return (
              <pre>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            )
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4">
                <table>{children}</table>
              </div>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
