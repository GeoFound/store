import { Container, Heading, Text } from "@medusajs/ui"
import type { ReactNode } from "react"

export function AdminSection(props: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">{props.title}</Heading>
        {props.description ? (
          <Text className="mt-1 text-ui-fg-subtle">{props.description}</Text>
        ) : null}
      </div>
      <div className="p-6">{props.children}</div>
    </Container>
  )
}
