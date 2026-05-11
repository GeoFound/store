import { Text } from "@medusajs/ui"

export function MessageBox(props: { error?: string; success?: string }) {
  if (!props.error && !props.success) {
    return null
  }

  return (
    <Text
      className={
        props.error ? "text-ui-fg-error" : "text-ui-fg-interactive"
      }
    >
      {props.error || props.success}
    </Text>
  )
}
